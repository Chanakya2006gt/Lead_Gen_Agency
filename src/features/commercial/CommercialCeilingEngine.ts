import { BusinessScale, AbilityToPay, PriceRange, ProblemValueAssessment } from "./types";
import { MarketContextResult } from "./MarketContext";

export interface CeilingParams {
  businessScale: BusinessScale;
  abilityToPay: AbilityToPay;
  problemValue: ProblemValueAssessment;
  likelyTechBudget: PriceRange;
  marketContext: MarketContextResult;
}

export class CommercialCeilingEngine {
  public static calculateCeiling(params: CeilingParams): PriceRange {
    const currency = params.marketContext.currency;
    const isINR = currency === "INR";

    let ceilingMin = isINR ? 15000 : 1500;
    let ceilingMax = isINR ? 35000 : 3500;

    // Derived from the client's business scale & ability to pay
    switch (params.businessScale) {
      case "ENTERPRISE":
      case "LARGE":
        ceilingMin = isINR ? 120000 : 12000;
        ceilingMax = isINR ? 350000 : 35000;
        break;
      case "MEDIUM":
        ceilingMin = isINR ? 45000 : 4500;
        ceilingMax = isINR ? 120000 : 12000;
        break;
      case "SMALL_MEDIUM":
        ceilingMin = isINR ? 25000 : 2500;
        ceilingMax = isINR ? 55000 : 5500;
        break;
      case "SMALL":
        ceilingMin = isINR ? 12000 : 1200;
        ceilingMax = isINR ? 28000 : 2800;
        break;
      case "MICRO":
        ceilingMin = isINR ? 5000 : 500;
        ceilingMax = isINR ? 10000 : 1000;
        break;
      case "UNKNOWN":
      default:
        ceilingMin = isINR ? 10000 : 1000;
        ceilingMax = isINR ? 25000 : 2500;
        break;
    }

    // High problem value can modestly expand commercial willingness (up to budget max)
    if (params.problemValue.severity === "CRITICAL" || params.problemValue.revenueProximity === "HIGH") {
      ceilingMax = Math.max(ceilingMax, params.likelyTechBudget.max);
    }

    return {
      min: ceilingMin,
      max: ceilingMax,
      currency,
      confidence: params.businessScale === "UNKNOWN" ? 0.35 : 0.8,
      basis: "COMMERCIAL_CEILING_CLAMPED",
    };
  }
}
