import { describe, it, expect } from "vitest";
import { CommercialEconomicsEngine } from "@/features/commercial/CommercialEconomicsEngine";
import { MarketBenchmarkEngine } from "@/features/commercial/MarketBenchmarkEngine";
import { MarketContextProvider } from "@/features/commercial/MarketContext";
import microCafeFixture from "../fixtures/commercial/micro-cafe.json";
import soloClinicFixture from "../fixtures/commercial/solo-clinic.json";
import manufacturerFixture from "../fixtures/commercial/manufacturer-b2b.json";
import yenomFixture from "../fixtures/commercial/yenom-solutions.json";

describe("Commercial Economics Engine & Reality Scoping Suite", () => {
  it("Invariant 1: High review volume (1,250 reviews) on a local micro-cafe does NOT inflate scale to large enterprise", () => {
    const profile = CommercialEconomicsEngine.analyze({
      name: microCafeFixture.name,
      category: microCafeFixture.category,
      rating: microCafeFixture.rating,
      reviewCount: microCafeFixture.reviewCount,
      formattedAddress: microCafeFixture.formattedAddress,
      hasWebsite: microCafeFixture.hasWebsite,
      auditTelemetry: microCafeFixture.auditTelemetry as any,
    });

    // Business scale must remain MICRO
    expect(profile.businessScale).toBe("MICRO");
    expect(profile.clientCommercialCeiling.max).toBeLessThanOrEqual(15000);
    
    // Feasible window should down-scope to a lean high-conversion MVP
    expect(["DOWN_SCOPED", "HEALTHY"]).toContain(profile.feasibleOfferWindow.status);
    expect(profile.pursuitAssessment.decision).toBe("PURSUE_LOW_TOUCH");
    expect(profile.recommendedMonthlyCare.max).toBeLessThanOrEqual(2000);
  });

  it("Invariant 2: Low review volume (72 reviews) on a B2B Manufacturer detects corporate scale & high capacity", () => {
    const profile = CommercialEconomicsEngine.analyze({
      name: manufacturerFixture.name,
      category: manufacturerFixture.category,
      rating: manufacturerFixture.rating,
      reviewCount: manufacturerFixture.reviewCount,
      formattedAddress: manufacturerFixture.formattedAddress,
      hasWebsite: manufacturerFixture.hasWebsite,
      auditTelemetry: manufacturerFixture.auditTelemetry as any,
    });

    // Multi-signal inference detects "Pvt Ltd" and B2B industrial category
    expect(["MEDIUM", "LARGE"]).toContain(profile.businessScale);
    expect(profile.abilityToPay).toBe("HIGH");
    expect(profile.clientCommercialCeiling.max).toBeGreaterThanOrEqual(100000);
  });

  it("Invariant 3: Solo clinic in Regional Hub (Warangal) establishes healthy feasible window", () => {
    const profile = CommercialEconomicsEngine.analyze({
      name: soloClinicFixture.name,
      category: soloClinicFixture.category,
      rating: soloClinicFixture.rating,
      reviewCount: soloClinicFixture.reviewCount,
      formattedAddress: soloClinicFixture.formattedAddress,
      hasWebsite: soloClinicFixture.hasWebsite,
      auditTelemetry: soloClinicFixture.auditTelemetry as any,
    });

    expect(["SMALL", "SMALL_MEDIUM"]).toContain(profile.businessScale);
    expect(profile.feasibleOfferWindow.status).toBe("HEALTHY");
    expect(profile.pursuitAssessment.decision).toBe("PURSUE");
    expect(profile.feasibleOfferWindow.agencyDeliveryFloor).toBeLessThanOrEqual(profile.clientCommercialCeiling.max);
  });

  it("Invariant 4: Yenom Solutions property test — preserves working commerce & avoids unnecessary store rebuild", () => {
    const profile = CommercialEconomicsEngine.analyze({
      name: yenomFixture.name,
      category: yenomFixture.category,
      rating: yenomFixture.rating,
      reviewCount: yenomFixture.reviewCount,
      formattedAddress: yenomFixture.formattedAddress,
      hasWebsite: yenomFixture.hasWebsite,
      auditTelemetry: yenomFixture.auditTelemetry as any,
    });

    // Should not flag ecommerce rebuild since no checkout breakdown exists
    expect(profile.problemValue.severity).not.toBe("CRITICAL");
    expect(profile.commercialFitScore).toBeGreaterThanOrEqual(60);
  });

  it("Invariant 5: CATEGORY_PRIOR_FALLBACK strictly caps confidence at <= 0.40", () => {
    const marketContext = MarketContextProvider.resolve("Warangal, Telangana");
    const benchmark = MarketBenchmarkEngine.getBenchmark({
      category: "Niche Aerospace Consulting",
      serviceType: "Specialized Audit",
      marketContext,
      hasObservedMarketEvidence: false, // Fallback prior only
    });

    expect(benchmark.priceRange.basis).toBe("CATEGORY_PRIOR_FALLBACK");
    expect(benchmark.priceRange.confidence).toBeLessThanOrEqual(0.4);
  });

  it("Invariant 6: Scope Transformation recalculates WBS and reduces engineering hours during down-scoping", () => {
    const profile = CommercialEconomicsEngine.analyze({
      name: "Lakshmi Tea Stall & Tiffin",
      category: "Tea Stall",
      rating: 4.6,
      reviewCount: 45,
      formattedAddress: "Hanamkonda",
      hasWebsite: true,
      auditTelemetry: {
        viewportMetaPresent: false,
        hasHorizontalOverflow: true,
        hasSsl: false,
        brokenLinksCount: 1,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 3200,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
    });

    expect(profile.businessScale).toBe("MICRO");
    expect(profile.feasibleOfferWindow.status).toBe("DOWN_SCOPED");
    expect(profile.downscopedScopeDescription).toBeDefined();
    // Delivery hours must be transformed down from 18+ to <= 10 hrs
    expect(profile.agencyDeliveryEconomics.estimatedEngineeringHours).toBeLessThanOrEqual(10);
  });
});
