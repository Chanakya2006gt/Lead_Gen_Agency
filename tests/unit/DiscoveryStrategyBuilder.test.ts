import { describe, it, expect } from "vitest";
import { DiscoveryStrategyBuilder } from "@/features/discovery/DiscoveryStrategyBuilder";
import { LocationResolver } from "@/features/discovery/LocationResolver";
import { MarketContextProvider } from "@/features/commercial/MarketContext";

describe("DiscoveryStrategyBuilder & Intent Invariant Suite", () => {
  it("Invariant 1 (Intent Preservation): Distinguishes CATEGORY_EQUIVALENT from SERVICE_SPECIALTY while rejecting non-commercial variants", () => {
    const location = LocationResolver.resolve("Hyderabad");
    const marketContext = MarketContextProvider.resolve("Hyderabad");

    const plan = DiscoveryStrategyBuilder.buildPlan({
      niche: "Dental Clinics",
      location,
      marketContext,
      mode: "COMMERCIAL",
    });

    const queryTexts = plan.queries.map((q) => q.textQuery);
    const categoryQueries = plan.queries.filter((q) => q.intent === "CATEGORY_EQUIVALENT");
    const specialtyQueries = plan.queries.filter((q) => q.intent === "SERVICE_SPECIALTY");

    // Must preserve category intent
    expect(categoryQueries.length).toBeGreaterThan(0);
    expect(categoryQueries[0].textQuery.toLowerCase()).toMatch(/dentist|dental/i);

    // Must preserve service specialty
    expect(specialtyQueries.length).toBeGreaterThan(0);
    expect(specialtyQueries[0].specialty).toBeDefined();

    // Must NOT contain supply/equipment/educational corruptions
    for (const text of queryTexts) {
      expect(text.toLowerCase()).not.toContain("college");
      expect(text.toLowerCase()).not.toContain("supplies");
      expect(text.toLowerCase()).not.toContain("equipment");
    }
  });

  it("Invariant 2 (Geographic Leakage Defense): Hyderabad discovery never generates cross-city queries (Bangalore, Chennai)", () => {
    const location = LocationResolver.resolve("Hyderabad");
    const marketContext = MarketContextProvider.resolve("Hyderabad");

    const plan = DiscoveryStrategyBuilder.buildPlan({
      niche: "Dental Clinics",
      location,
      marketContext,
      mode: "EXHAUSTIVE",
    });

    for (const q of plan.queries) {
      expect(q.textQuery.toLowerCase()).not.toContain("bangalore");
      expect(q.textQuery.toLowerCase()).not.toContain("chennai");
      expect(q.textQuery.toLowerCase()).not.toContain("mumbai");
      expect(q.textQuery.toLowerCase()).not.toContain("dallas");
    }
  });

  it("Invariant 3 (Unknown Market Conservatism): Obscure city with null coordinates produces 0 geographic micro-hubs", () => {
    const location = LocationResolver.resolve("Unknown Desert Hamlet");
    const marketContext = MarketContextProvider.resolve("Unknown Desert Hamlet");

    const plan = DiscoveryStrategyBuilder.buildPlan({
      niche: "HVAC Contractors",
      location,
      marketContext,
      mode: "EXHAUSTIVE",
    });

    const hubQueries = plan.queries.filter((q) => q.intent === "GEOGRAPHIC_MICRO_HUB");
    expect(hubQueries.length).toBe(0);
  });

  it("Invariant 4 (Budget Enforcement): Queries are strictly clamped by mode budget limits", () => {
    const location = LocationResolver.resolve("Hyderabad");
    const marketContext = MarketContextProvider.resolve("Hyderabad");

    const standardPlan = DiscoveryStrategyBuilder.buildPlan({
      niche: "Dental Clinics",
      location,
      marketContext,
      mode: "STANDARD",
    });
    expect(standardPlan.queries.length).toBeLessThanOrEqual(standardPlan.budget.maxQueries);
    expect(standardPlan.budget.maxQueries).toBe(2);

    const commercialPlan = DiscoveryStrategyBuilder.buildPlan({
      niche: "Dental Clinics",
      location,
      marketContext,
      mode: "COMMERCIAL",
    });
    expect(commercialPlan.queries.length).toBeLessThanOrEqual(commercialPlan.budget.maxQueries);
    expect(commercialPlan.budget.maxQueries).toBe(5);

    const exhaustivePlan = DiscoveryStrategyBuilder.buildPlan({
      niche: "Dental Clinics",
      location,
      marketContext,
      mode: "EXHAUSTIVE",
    });
    expect(exhaustivePlan.queries.length).toBeLessThanOrEqual(exhaustivePlan.budget.maxQueries);
    expect(exhaustivePlan.budget.maxQueries).toBe(8);
  });
});
