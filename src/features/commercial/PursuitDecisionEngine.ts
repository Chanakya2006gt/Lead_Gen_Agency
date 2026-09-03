import {
  PursuitDecision,
  ProblemValueAssessment,
  PriceRange,
  BusinessScale,
  AbilityToPay,
} from "./types";
import { FeasibleOfferResult } from "./OfferEngine";

export interface PursuitEngineParams {
  businessScale: BusinessScale;
  abilityToPay: AbilityToPay;
  problemValue: ProblemValueAssessment;
  offerResult: FeasibleOfferResult;
}

export interface PursuitDecisionResult {
  commercialFitScore: number;
  leadAttractivenessScore: number;
  pursuitAssessment: {
    decision: PursuitDecision;
    score: number;
    reasons: string[];
  };
}

export class PursuitDecisionEngine {
  public static evaluate(params: PursuitEngineParams): PursuitDecisionResult {
    const reasons: string[] = [];
    let commercialFitScore = 70;
    let leadAttractivenessScore = 60;

    const windowStatus = params.offerResult.feasibleOfferWindow.status;

    // 1. Feasible Window Evaluation
    if (windowStatus === "HEALTHY") {
      commercialFitScore = 90;
      reasons.push("Healthy commercial window: Client ceiling comfortably exceeds agency delivery floor.");
    } else if (windowStatus === "DOWN_SCOPED") {
      commercialFitScore = 75;
      reasons.push("Viable lean MVP constructed: Scope down-scoped to match client's commercial reality.");
    } else if (windowStatus === "IMPOSSIBLE") {
      commercialFitScore = 20;
      leadAttractivenessScore = 15;
      reasons.push("Negative delivery margin: Agency delivery floor exceeds maximum plausible client ceiling.");
      return {
        commercialFitScore,
        leadAttractivenessScore,
        pursuitAssessment: {
          decision: "DO_NOT_PURSUE",
          score: 15,
          reasons,
        },
      };
    } else if (windowStatus === "INSUFFICIENT_EVIDENCE") {
      commercialFitScore = 40;
      leadAttractivenessScore = 35;
      reasons.push("Insufficient empirical evidence observed to validate commercial viability.");
      return {
        commercialFitScore,
        leadAttractivenessScore,
        pursuitAssessment: {
          decision: "NURTURE",
          score: 35,
          reasons,
        },
      };
    }

    // 2. Problem Value & Revenue Proximity Influence
    if (params.problemValue.severity === "CRITICAL" || params.problemValue.revenueProximity === "HIGH") {
      commercialFitScore += 5;
      leadAttractivenessScore += 15;
      reasons.push("High problem value: Technical bottleneck directly impacts customer acquisition.");
    } else if (params.problemValue.severity === "LOW") {
      commercialFitScore -= 10;
      leadAttractivenessScore -= 20;
      reasons.push("Low problem severity: Only minor or cosmetic improvements observed.");
    }

    // 3. Scale vs Sales Effort Matrix
    if (params.businessScale === "LARGE" || params.businessScale === "ENTERPRISE") {
      leadAttractivenessScore += 20;
      reasons.push("High deal value potential: Enterprise/Large scale operational capacity.");
    } else if (params.businessScale === "MICRO") {
      // Micro business has high close probability if simple, but low deal value
      leadAttractivenessScore -= 15;
      reasons.push("Micro business scale: Requires low-touch/templated outreach to maintain acquisition margin.");
    }

    // Clamp scores 0-100
    commercialFitScore = Math.max(0, Math.min(100, commercialFitScore));
    leadAttractivenessScore = Math.max(0, Math.min(100, leadAttractivenessScore));

    // 4. Determine Final Pursuit Decision
    let decision: PursuitDecision = "PURSUE";

    if (leadAttractivenessScore < 30 || commercialFitScore < 30) {
      decision = "DO_NOT_PURSUE";
    } else if (params.businessScale === "MICRO" || windowStatus === "DOWN_SCOPED") {
      decision = "PURSUE_LOW_TOUCH";
    } else if (leadAttractivenessScore >= 55 && commercialFitScore >= 65) {
      decision = "PURSUE";
    } else {
      decision = "NURTURE";
    }

    return {
      commercialFitScore,
      leadAttractivenessScore,
      pursuitAssessment: {
        decision,
        score: leadAttractivenessScore,
        reasons,
      },
    };
  }
}
