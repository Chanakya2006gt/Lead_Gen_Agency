export type BusinessScale =
  | "MICRO"
  | "SMALL"
  | "SMALL_MEDIUM"
  | "MEDIUM"
  | "LARGE"
  | "ENTERPRISE"
  | "UNKNOWN";

export type AbilityToPay =
  | "VERY_LOW"
  | "LOW"
  | "LOW_MEDIUM"
  | "MEDIUM"
  | "HIGH"
  | "UNKNOWN";

export type PursuitDecision =
  | "PURSUE"
  | "PURSUE_LOW_TOUCH"
  | "NURTURE"
  | "DO_NOT_PURSUE";

export type ProblemSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type EvidenceProvenance = "OBSERVED" | "INFERRED" | "UNKNOWN";

export type PricingBasis =
  | "BOTTOM_UP_WBS"
  | "COMMERCIAL_CEILING_CLAMPED"
  | "MARKET_BENCHMARK"
  | "CATEGORY_PRIOR_FALLBACK";

export interface PriceRange {
  min: number;
  max: number;
  currency: string; // "INR", "USD", "AED", "GBP"
  confidence: number; // 0.0 to 1.0 (Must be <= 0.40 for CATEGORY_PRIOR_FALLBACK)
  basis: PricingBasis;
}

export interface MarketEvidence {
  source: string;
  sampleCount?: number;
  dateObserved: string;
  notes: string;
}

export interface MarketBenchmark {
  priceRange: PriceRange;
  geography: string;
  industry?: string;
  serviceType: string;
  sampleSize?: number;
  sources: MarketEvidence[];
  observedAt: string;
}

export interface DeliveryEconomics {
  estimatedEngineeringHours: number;
  minimumViableDeliveryPrice: PriceRange; // Agency delivery floor
  hourlyRateBaseline: number;
}

export interface ProblemValueAssessment {
  severity: ProblemSeverity;
  revenueProximity: "LOW" | "MEDIUM" | "HIGH";
  revenueImpactEvidence: EvidenceProvenance; // OBSERVED, INFERRED, UNKNOWN
  operationalImpact: "LOW" | "MEDIUM" | "HIGH";
  frequency: "DAILY" | "WEEKLY" | "OCCASIONAL";
  problemValueBand: PriceRange;
  confidence: number;
  evidence: { statement: string; provenance: EvidenceProvenance }[];
}

export interface CommercialProfile {
  businessScale: BusinessScale;
  businessScaleConfidence: number;
  businessScaleEvidence: { signal: string; weight: number; provenance: EvidenceProvenance }[];
  abilityToPay: AbilityToPay;
  likelyTechBudget: PriceRange;
  problemValue: ProblemValueAssessment;
  marketBenchmark: MarketBenchmark;
  clientCommercialCeiling: PriceRange;
  agencyDeliveryEconomics: DeliveryEconomics;

  // Feasible Offer Decisioning
  feasibleOfferWindow: {
    status: "HEALTHY" | "DOWN_SCOPED" | "IMPOSSIBLE" | "INSUFFICIENT_EVIDENCE";
    agencyDeliveryFloor: number;
    clientCommercialCeiling: number;
    gapAmount?: number;
  };
  recommendedBuildOffer: PriceRange;
  recommendedMonthlyCare: PriceRange;
  downscopedScopeDescription?: string;

  // Dual Intelligence Scoring
  commercialFitScore: number; // 0–100: Can we construct a viable offer for this client?
  leadAttractivenessScore: number; // 0–100: Is this lead worth our sales & delivery time?
  pursuitAssessment: {
    decision: PursuitDecision;
    score: number;
    reasons: string[];
  };
  commercialRationale: string;
}
