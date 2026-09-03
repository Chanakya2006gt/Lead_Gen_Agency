import {
  PriceRange,
  DeliveryEconomics,
  ProblemValueAssessment,
  MarketBenchmark,
  BusinessScale,
  AbilityToPay,
} from "./types";
import { MarketContextResult } from "./MarketContext";

export interface OfferEngineParams {
  businessScale: BusinessScale;
  abilityToPay: AbilityToPay;
  problemValue: ProblemValueAssessment;
  marketBenchmark: MarketBenchmark;
  clientCommercialCeiling: PriceRange;
  marketContext: MarketContextResult;
  serviceType: string;
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
  commercialRationale: string;
}

export class OfferEngine {
  private static readonly HOURLY_BASELINE_INR = 1000; // ₹1,000 / engineering hour
  private static readonly HOURLY_BASELINE_USD = 40;   // $40 / engineering hour

  public static calculateOffer(params: OfferEngineParams): FeasibleOfferResult {
    const currency = params.marketContext.currency;
    const isINR = currency === "INR";
    const hourlyRate = isINR ? this.HOURLY_BASELINE_INR : this.HOURLY_BASELINE_USD;

    // 1. Initial Theoretical Solution Estimation (Full WBS)
    let fullHours = 18;
    let serviceDesc = "Complete Responsive Storefront & Conversion Funnel";

    const servLower = (params.serviceType || "").toLowerCase();
    if (servLower.includes("custom") || servLower.includes("software") || servLower.includes("ops")) {
      fullHours = 45;
      serviceDesc = "Custom Operational Software, Multi-Doctor Intake & WhatsApp Reminders";
    } else if (servLower.includes("gbp") || servLower.includes("sync") || servLower.includes("local seo")) {
      fullHours = 8;
      serviceDesc = "Google Business Profile Sync, Local Schema & Mobile Linkage";
    }

    const fullTheoreticalFloor = fullHours * hourlyRate;
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
        commercialRationale: "Insufficient empirical evidence observed to construct a reliable commercial proposal.",
      };
    }

    // 3. Evaluate Feasibility: Healthy vs Down-Scope vs Impossible
    if (fullTheoreticalFloor <= clientCeilingMax) {
      // HEALTHY WINDOW: Full theoretical solution fits client's commercial reality
      const offerMin = Math.max(fullTheoreticalFloor, clientCeilingMin);
      const offerMax = Math.min(offerMin * 1.3, clientCeilingMax);

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
          min: Math.round(careMin / 500) * 500,
          max: Math.round(careMax / 500) * 500,
          currency,
          confidence: 0.8,
          basis: "BOTTOM_UP_WBS",
        },
        commercialRationale: `Client commercial capacity comfortably covers full scope (${serviceDesc}) within healthy margin boundaries.`,
      };
    }

    // Client commercial ceiling is lower than full theoretical scope: Attempt Scope Transformation
    // Scope Transformation: Remove heavy custom modules, retain high-ROI core (e.g. Essential 1-Tap Mobile Conversion MVP)
    const leanHours = Math.max(4, Math.min(8, Math.floor(clientCeilingMax / hourlyRate)));
    const leanDeliveryFloor = leanHours * hourlyRate;

    if (leanDeliveryFloor <= clientCeilingMax && leanHours >= 5) {
      // DOWN-SCOPED SOLUTION: Viable lean package constructed via WBS transformation
      const leanMin = clientCeilingMin;
      const leanMax = clientCeilingMax;
      const careMin = isINR ? 500 : 50;
      const careMax = isINR ? 1500 : 150;

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
        downscopedScopeDescription: "Lean High-Conversion MVP: 1-tap WhatsApp consultation triggers, mobile layout fixes, and Google Maps linkage (non-essential custom modules deferred).",
        commercialRationale: `Full solution exceeds client ceiling (₹${clientCeilingMax.toLocaleString()}). Transformed scope to high-ROI lean MVP (${leanHours} hrs) to preserve delivery margin and match buyer reality.`,
      };
    }

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
      commercialRationale: `Commercial ceiling (₹${clientCeilingMax.toLocaleString()}) is below minimum profitable delivery cost (₹${fullTheoreticalFloor.toLocaleString()}). Unfavorable unit economics.`,
    };
  }
}
