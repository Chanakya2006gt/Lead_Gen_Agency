import { AbilityToPay, BusinessScale, PriceRange } from "./types";
import { MarketContextResult } from "./MarketContext";

export interface AbilityToPayParams {
  businessScale: BusinessScale;
  category?: string | null;
  name: string;
  marketContext: MarketContextResult;
  scaleConfidence: number;
}

export interface AbilityToPayResult {
  abilityToPay: AbilityToPay;
  likelyTechBudget: PriceRange;
  confidence: number;
  rationale: string;
}

export class AbilityToPayEvaluator {
  public static evaluate(params: AbilityToPayParams): AbilityToPayResult {
    const currency = params.marketContext.currency;
    const catLower = (params.category || "").toLowerCase();
    const nameLower = (params.name || "").toLowerCase();

    // High margin premium service indicators (Cosmetic surgery, luxury resort, real estate developers, specialized legal)
    const isPremiumHighMargin = ["cosmetic", "plastic surgery", "implant", "dermatology", "luxury", "resort", "builder", "developer", "architect", "law firm", "solar"].some(
      (kw) => catLower.includes(kw) || nameLower.includes(kw)
    );

    // Low margin volume retail (Food stall, tea, small bakery, local barber)
    const isLeanLowMargin = ["tea", "snack", "tiffin", "barber", "tailor", "laundry", "dry clean", "kirana", "provision"].some(
      (kw) => catLower.includes(kw) || nameLower.includes(kw)
    );

    let abilityToPay: AbilityToPay = "MEDIUM";
    let budgetMin = 15000;
    let budgetMax = 40000;

    if (params.businessScale === "ENTERPRISE" || params.businessScale === "LARGE") {
      abilityToPay = "HIGH";
      budgetMin = currency === "INR" ? 80000 : 8000;
      budgetMax = currency === "INR" ? 300000 : 30000;
    } else if (params.businessScale === "MEDIUM") {
      abilityToPay = isPremiumHighMargin ? "HIGH" : "MEDIUM";
      budgetMin = currency === "INR" ? 40000 : 4000;
      budgetMax = currency === "INR" ? 120000 : 12000;
    } else if (params.businessScale === "SMALL_MEDIUM") {
      abilityToPay = isPremiumHighMargin ? "MEDIUM" : "LOW_MEDIUM";
      budgetMin = currency === "INR" ? 20000 : 2000;
      budgetMax = currency === "INR" ? 50000 : 5000;
    } else if (params.businessScale === "SMALL") {
      abilityToPay = isPremiumHighMargin ? "LOW_MEDIUM" : isLeanLowMargin ? "LOW" : "LOW_MEDIUM";
      budgetMin = currency === "INR" ? 10000 : 1000;
      budgetMax = currency === "INR" ? 25000 : 2500;
    } else if (params.businessScale === "MICRO") {
      abilityToPay = isPremiumHighMargin ? "LOW_MEDIUM" : "VERY_LOW";
      budgetMin = currency === "INR" ? 4000 : 400;
      budgetMax = currency === "INR" ? 12000 : 1200;
    } else {
      abilityToPay = "UNKNOWN";
      budgetMin = currency === "INR" ? 8000 : 800;
      budgetMax = currency === "INR" ? 25000 : 2500;
    }

    const confidence = params.businessScale === "UNKNOWN" ? 0.35 : Math.min(params.scaleConfidence, 0.85);

    return {
      abilityToPay,
      likelyTechBudget: {
        min: budgetMin,
        max: budgetMax,
        currency,
        confidence,
        basis: "BOTTOM_UP_WBS",
      },
      confidence,
      rationale: `Derived from observed business scale (${params.businessScale}) combined with sector commercial margin profile.`,
    };
  }
}
