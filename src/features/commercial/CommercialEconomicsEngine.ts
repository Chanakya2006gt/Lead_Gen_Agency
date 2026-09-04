import { CommercialProfile } from "./types";
import { MarketContextProvider, MarketContextResult } from "./MarketContext";
import { BusinessScaleInferrer } from "./BusinessScaleInferrer";
import { ProblemValueEvaluator } from "./ProblemValueEvaluator";
import { AbilityToPayEvaluator } from "./AbilityToPayEvaluator";
import { MarketBenchmarkEngine } from "./MarketBenchmarkEngine";
import { CommercialCeilingEngine } from "./CommercialCeilingEngine";
import { OfferEngine } from "./OfferEngine";
import { PursuitDecisionEngine } from "./PursuitDecisionEngine";
import { AuditTelemetry } from "@/core/db/schema";

export interface CommercialAnalysisParams {
  name: string;
  category?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  locationInput?: string | null;
  formattedAddress?: string | null;
  hasWebsite: boolean;
  isGbpDisconnected?: boolean;
  auditTelemetry?: AuditTelemetry | null;
  websiteTextSnippet?: string | null;
  serviceType?: string;
}

export class CommercialEconomicsEngine {
  public static analyze(params: CommercialAnalysisParams): CommercialProfile {
    // 1. Resolve Local Market Context & Fallback Priors
    const marketContext = MarketContextProvider.resolve(params.locationInput || params.formattedAddress);

    // 2. Multi-Signal Business Scale Inference
    const scaleResult = BusinessScaleInferrer.infer({
      name: params.name,
      category: params.category,
      rating: params.rating,
      reviewCount: params.reviewCount,
      formattedAddress: params.formattedAddress,
      auditTelemetry: params.auditTelemetry,
      websiteTextSnippet: params.websiteTextSnippet,
    });

    // 3. Problem Value & Revenue Proximity Evaluation
    const problemValue = ProblemValueEvaluator.evaluate({
      hasWebsite: params.hasWebsite,
      isGbpDisconnected: params.isGbpDisconnected,
      auditTelemetry: params.auditTelemetry,
      marketContext,
      businessName: params.name,
    });

    // 4. Evidence-Driven Ability to Pay
    const abilityResult = AbilityToPayEvaluator.evaluate({
      businessScale: scaleResult.scale,
      category: params.category,
      name: params.name,
      marketContext,
      scaleConfidence: scaleResult.confidence,
    });

    // 5. Market Price Benchmark
    const serviceType = params.serviceType || (params.isGbpDisconnected ? "Google Business Profile Sync & Local Schema" : params.hasWebsite ? "Mobile Conversion Modernization" : "Mobile-First Storefront Build");
    const marketBenchmark = MarketBenchmarkEngine.getBenchmark({
      category: params.category,
      serviceType,
      marketContext,
      hasObservedMarketEvidence: false,
    });

    // 6. Client Commercial Ceiling
    const clientCommercialCeiling = CommercialCeilingEngine.calculateCeiling({
      businessScale: scaleResult.scale,
      abilityToPay: abilityResult.abilityToPay,
      problemValue,
      likelyTechBudget: abilityResult.likelyTechBudget,
      marketContext,
    });

    // 7. Agency Delivery Economics, Scope Transformation & Feasible Offer Window
    const offerResult = OfferEngine.calculateOffer({
      businessScale: scaleResult.scale,
      abilityToPay: abilityResult.abilityToPay,
      problemValue,
      marketBenchmark,
      clientCommercialCeiling,
      marketContext,
      serviceType,
    });

    // 8. Pursuit Decisioning & Dual-Scoring
    const pursuitResult = PursuitDecisionEngine.evaluate({
      businessScale: scaleResult.scale,
      abilityToPay: abilityResult.abilityToPay,
      problemValue,
      offerResult,
    });

    return {
      businessScale: scaleResult.scale,
      businessScaleConfidence: scaleResult.confidence,
      businessScaleEvidence: scaleResult.evidence,
      abilityToPay: abilityResult.abilityToPay,
      likelyTechBudget: abilityResult.likelyTechBudget,
      problemValue,
      marketBenchmark,
      clientCommercialCeiling,
      agencyDeliveryEconomics: offerResult.agencyDeliveryEconomics,
      feasibleOfferWindow: offerResult.feasibleOfferWindow,
      recommendedBuildOffer: offerResult.recommendedBuildOffer,
      recommendedMonthlyCare: offerResult.recommendedMonthlyCare,
      downscopedScopeDescription: offerResult.downscopedScopeDescription,
      commercialFitScore: pursuitResult.commercialFitScore,
      leadAttractivenessScore: pursuitResult.leadAttractivenessScore,
      pursuitAssessment: pursuitResult.pursuitAssessment,
      commercialRationale: offerResult.commercialRationale,
    };
  }
}
