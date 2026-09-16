import {
  PriceRange,
  DeliveryEconomics,
  ProblemValueAssessment,
  MarketBenchmark,
  BusinessScale,
  AbilityToPay,
  WbsDeliverable,
} from "./types";
import { MarketContextResult } from "./MarketContext";
import { FindingWbsEngine } from "./FindingWbsEngine";
import { AuditTelemetry } from "@/core/db/schema";

export interface OfferEngineParams {
  businessScale: BusinessScale;
  abilityToPay: AbilityToPay;
  problemValue: ProblemValueAssessment;
  marketBenchmark: MarketBenchmark;
  clientCommercialCeiling: PriceRange;
  marketContext: MarketContextResult;
  serviceType: string;
  hasWebsite?: boolean;
  isGbpDisconnected?: boolean;
  auditTelemetry?: AuditTelemetry | null;
  relevantWorkflows?: any;
}

export interface FeasibleOfferResult {
  feasibleOfferWindow: {
    status: "HEALTHY" | "DOWN_SCOPED" | "IMPOSSIBLE" | "INSUFFICIENT_EVIDENCE";
    agencyDeliveryFloor: number;
    clientCommercialCeiling: number;
    gapAmount?: number;
  };
  agencyDeliveryEconomics: DeliveryEconomics;
  recommendedBuildOffer: PriceRange;
  recommendedMonthlyCare: PriceRange;
  downscopedScopeDescription?: string;
  wbsDeliverables?: WbsDeliverable[];
  totalEngineeringHours?: number;
  commercialRationale: string;
}

export class OfferEngine {
  private static readonly HOURLY_BASELINE_INR = 1000; // ₹1,000 / engineering hour
  private static readonly HOURLY_BASELINE_USD = 40;   // $40 / engineering hour

  public static calculateOffer(params: OfferEngineParams): FeasibleOfferResult {
    const currency = params.marketContext.currency;
    const isINR = currency === "INR";
    const hourlyRate = isINR ? this.HOURLY_BASELINE_INR : this.HOURLY_BASELINE_USD;

    // 1. Dynamic Bottom-Up Finding-Driven Work Breakdown Structure (WBS)
    const wbsResult = FindingWbsEngine.itemize({
      hasWebsite: params.hasWebsite ?? !params.serviceType?.toLowerCase().includes("storefront"),
      isGbpDisconnected: params.isGbpDisconnected ?? params.serviceType?.toLowerCase().includes("gbp"),
      auditTelemetry: params.auditTelemetry,
      businessScale: params.businessScale,
      relevantWorkflows: params.relevantWorkflows,
      currency,
      hourlyRate,
    });

    const fullHours = wbsResult.totalScaledHours;
    const fullTheoreticalFloor = wbsResult.wbsFloorPrice;
    const serviceDesc = wbsResult.scopeSummary;
    const clientCeilingMax = params.clientCommercialCeiling.max;
    const clientCeilingMin = params.clientCommercialCeiling.min;

    // 2. Insufficient Evidence Safeguard
    if (params.businessScale === "UNKNOWN" && params.problemValue.confidence <= 0.3) {
      const fallbackPrice = isINR ? 10000 : 1000;
      return {
        feasibleOfferWindow: {
          status: "INSUFFICIENT_EVIDENCE",
          agencyDeliveryFloor: fallbackPrice,
          clientCommercialCeiling: fallbackPrice,
        },
        agencyDeliveryEconomics: {
          estimatedEngineeringHours: 10,
          minimumViableDeliveryPrice: {
            min: fallbackPrice,
            max: fallbackPrice,
            currency,
            confidence: 0.25,
            basis: "CATEGORY_PRIOR_FALLBACK",
          },
          hourlyRateBaseline: hourlyRate,
        },
        recommendedBuildOffer: {
          min: fallbackPrice,
          max: fallbackPrice,
          currency,
          confidence: 0.25,
          basis: "CATEGORY_PRIOR_FALLBACK",
        },
        recommendedMonthlyCare: {
          min: isINR ? 1000 : 100,
          max: isINR ? 2000 : 200,
          currency,
          confidence: 0.25,
          basis: "CATEGORY_PRIOR_FALLBACK",
        },
        wbsDeliverables: wbsResult.deliverables,
        totalEngineeringHours: 10,
        commercialRationale: "Insufficient empirical evidence observed to construct a reliable commercial proposal.",
      };
    }

    // 3. Evaluate Feasibility: Healthy vs Down-Scope vs Impossible
    if (fullTheoreticalFloor <= clientCeilingMax) {
      // HEALTHY WINDOW: Full theoretical solution fits client's commercial reality
      const offerMin = Math.max(fullTheoreticalFloor, clientCeilingMin);
      const offerMax = Math.min(Math.max(wbsResult.wbsCeilingPrice, offerMin), clientCeilingMax);

      const careMin = isINR ? Math.round(offerMin * 0.08) : Math.round(offerMin * 0.1);
      const careMax = isINR ? Math.round(offerMax * 0.12) : Math.round(offerMax * 0.15);

      return {
        feasibleOfferWindow: {
          status: "HEALTHY",
          agencyDeliveryFloor: fullTheoreticalFloor,
          clientCommercialCeiling: clientCeilingMax,
        },
        agencyDeliveryEconomics: {
          estimatedEngineeringHours: fullHours,
          minimumViableDeliveryPrice: {
            min: fullTheoreticalFloor,
            max: Math.round(fullTheoreticalFloor * 1.2),
            currency,
            confidence: 0.85,
            basis: "BOTTOM_UP_WBS",
          },
          hourlyRateBaseline: hourlyRate,
        },
        recommendedBuildOffer: {
          min: Math.round(offerMin / 1000) * 1000,
          max: Math.round(offerMax / 1000) * 1000,
          currency,
          confidence: 0.85,
          basis: "BOTTOM_UP_WBS",
        },
        recommendedMonthlyCare: {
          min: Math.max(isINR ? 1000 : 100, Math.round(careMin / 500) * 500),
          max: Math.max(isINR ? 2000 : 200, Math.round(careMax / 500) * 500),
          currency,
          confidence: 0.8,
          basis: "BOTTOM_UP_WBS",
        },
        wbsDeliverables: wbsResult.deliverables,
        totalEngineeringHours: fullHours,
        commercialRationale: `Client commercial capacity comfortably covers dynamic WBS scope (${serviceDesc}) within healthy margin boundaries.`,
      };
    }

    // Client commercial ceiling is lower than full theoretical scope: Attempt Scope Transformation
    // Scope Transformation: Prioritize critical deliverables that fit within clientCeilingMax and 10-hour lean ceiling
    const sortedDeliverables = [...wbsResult.deliverables].sort((a, b) => {
      const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
    });

    const maxDownscopeHours = Math.min(10, Math.floor(clientCeilingMax / hourlyRate));
    const leanDeliverables: WbsDeliverable[] = [];
    let accumulatedValue = 0;
    let accumulatedHours = 0;
    for (const d of sortedDeliverables) {
      if (accumulatedValue + d.value <= clientCeilingMax && accumulatedHours + d.scaledHours <= maxDownscopeHours) {
        leanDeliverables.push(d);
        accumulatedValue += d.value;
        accumulatedHours += d.scaledHours;
      }
    }

    const leanHours = Math.max(4, Math.min(maxDownscopeHours, accumulatedHours || maxDownscopeHours));
    const leanDeliveryFloor = Math.min(clientCeilingMax, Math.max(leanHours * hourlyRate, accumulatedValue || leanHours * hourlyRate));

    if (leanDeliveryFloor <= clientCeilingMax && leanHours >= 4) {
      // DOWN-SCOPED SOLUTION: Viable lean package constructed via WBS transformation
      const leanMin = Math.max(leanDeliveryFloor, clientCeilingMin);
      const leanMax = clientCeilingMax;
      const careMin = isINR ? 500 : 50;
      const careMax = isINR ? 2000 : 200;

      const currSym = isINR ? "₹" : currency === "GBP" ? "£" : currency === "AED" ? "د.إ " : "$";
      return {
        feasibleOfferWindow: {
          status: "DOWN_SCOPED",
          agencyDeliveryFloor: leanDeliveryFloor,
          clientCommercialCeiling: clientCeilingMax,
        },
        agencyDeliveryEconomics: {
          estimatedEngineeringHours: leanHours,
          minimumViableDeliveryPrice: {
            min: leanDeliveryFloor,
            max: leanDeliveryFloor,
            currency,
            confidence: 0.8,
            basis: "COMMERCIAL_CEILING_CLAMPED",
          },
          hourlyRateBaseline: hourlyRate,
        },
        recommendedBuildOffer: {
          min: Math.round(leanMin / 500) * 500,
          max: Math.round(leanMax / 500) * 500,
          currency,
          confidence: 0.8,
          basis: "COMMERCIAL_CEILING_CLAMPED",
        },
        recommendedMonthlyCare: {
          min: careMin,
          max: careMax,
          currency,
          confidence: 0.75,
          basis: "COMMERCIAL_CEILING_CLAMPED",
        },
        wbsDeliverables: leanDeliverables.length > 0 ? leanDeliverables : wbsResult.deliverables,
        totalEngineeringHours: leanHours,
        downscopedScopeDescription: "Lean High-Conversion MVP: Prioritized core conversion triggers, mobile layout containment, and entity linkage (heavy custom modules deferred).",
        commercialRationale: `Full scope exceeds client ceiling (${currSym}${clientCeilingMax.toLocaleString()}). Transformed scope to high-ROI lean MVP (${leanHours} hrs) to preserve delivery margin and match buyer reality.`,
      };
    }

    const currSym = isINR ? "₹" : currency === "GBP" ? "£" : currency === "AED" ? "د.إ " : "$";

    // IMPOSSIBLE WINDOW: Even minimal viable delivery floor exceeds client's commercial ceiling
    return {
      feasibleOfferWindow: {
        status: "IMPOSSIBLE",
        agencyDeliveryFloor: fullTheoreticalFloor,
        clientCommercialCeiling: clientCeilingMax,
        gapAmount: fullTheoreticalFloor - clientCeilingMax,
      },
      agencyDeliveryEconomics: {
        estimatedEngineeringHours: fullHours,
        minimumViableDeliveryPrice: {
          min: fullTheoreticalFloor,
          max: fullTheoreticalFloor,
          currency,
          confidence: 0.8,
          basis: "BOTTOM_UP_WBS",
        },
        hourlyRateBaseline: hourlyRate,
      },
      recommendedBuildOffer: {
        min: clientCeilingMin,
        max: clientCeilingMax,
        currency,
        confidence: 0.4,
        basis: "COMMERCIAL_CEILING_CLAMPED",
      },
      recommendedMonthlyCare: {
        min: isINR ? 500 : 50,
        max: isINR ? 1000 : 100,
        currency,
        confidence: 0.4,
        basis: "COMMERCIAL_CEILING_CLAMPED",
      },
      wbsDeliverables: wbsResult.deliverables,
      totalEngineeringHours: fullHours,
      commercialRationale: `Commercial ceiling (${currSym}${clientCeilingMax.toLocaleString()}) is below minimum profitable delivery cost (${currSym}${fullTheoreticalFloor.toLocaleString()}). Unfavorable unit economics.`,
    };
  }
}

