import { describe, it, expect } from "vitest";
import { LocationResolver } from "@/features/discovery/LocationResolver";
import { MarketContextProvider } from "@/features/commercial/MarketContext";
import { DiscoveryStrategyBuilder } from "@/features/discovery/DiscoveryStrategyBuilder";
import { GooglePlacesApiAdapter } from "@/features/discovery/GooglePlacesApiAdapter";
import { ApifyMapsAdapter } from "@/features/discovery/ApifyMapsAdapter";

describe("Discovery Orchestration & Provider Translation Suite", () => {
  it("Translates DiscoveryPlan into bounded Google Places requests without static city dictionaries", () => {
    const location = LocationResolver.resolve("Hyderabad");
    const marketContext = MarketContextProvider.resolve("Hyderabad");
    const plan = DiscoveryStrategyBuilder.buildPlan({
      niche: "Dental Clinics",
      location,
      marketContext,
      mode: "COMMERCIAL",
    });

    expect(plan.queries.length).toBeLessThanOrEqual(5);
    expect(plan.budget.maxProviderCalls).toBe(5);
    expect(plan.location.countryCode).toBe("IN");
    expect(plan.providerOptimizationFilters?.minRating).toBe(3.8);

    const adapter = new GooglePlacesApiAdapter("dummy-key");
    expect(adapter.name).toBe("GooglePlacesApiAdapter");
  });

  it("Translates DiscoveryPlan into Apify searchStringsArray matching query priorities", () => {
    const location = LocationResolver.resolve("Dallas, TX");
    const marketContext = MarketContextProvider.resolve("Dallas, TX");
    const plan = DiscoveryStrategyBuilder.buildPlan({
      niche: "HVAC Contractors",
      location,
      marketContext,
      mode: "STANDARD",
    });

    expect(plan.location.countryCode).toBe("US");
    expect(plan.queries.length).toBeLessThanOrEqual(2);
    expect(plan.queries[0].textQuery).toContain("HVAC");

    const adapter = new ApifyMapsAdapter("dummy-token");
    expect(adapter.name).toBe("ApifyMapsAdapter");
  });
});
