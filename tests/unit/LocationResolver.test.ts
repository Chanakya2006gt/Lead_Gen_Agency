import { describe, it, expect } from "vitest";
import { LocationResolver } from "@/features/discovery/LocationResolver";

describe("LocationResolver Domain Suite", () => {
  it("Resolves known Indian Tier 1 metro with canonical database provenance", () => {
    const loc = LocationResolver.resolve("Hyderabad");
    expect(loc.countryCode).toBe("IN");
    expect(loc.cityTier).toBe("TIER_1");
    expect(loc.latitude).toBeCloseTo(17.385, 2);
    expect(loc.longitude).toBeCloseTo(78.486, 2);
    expect(loc.source).toBe("CANONICAL_DATABASE");
    expect(loc.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("Resolves known regional hub (Warangal) with Tier 2 classification", () => {
    const loc = LocationResolver.resolve("Hanamkonda, Warangal");
    expect(loc.countryCode).toBe("IN");
    expect(loc.cityTier).toBe("TIER_2");
    expect(loc.latitude).toBeCloseTo(17.968, 2);
    expect(loc.longitude).toBeCloseTo(79.594, 2);
  });

  it("Resolves International Metro (Dallas, TX) with US country code", () => {
    const loc = LocationResolver.resolve("Dallas, TX");
    expect(loc.countryCode).toBe("US");
    expect(loc.cityTier).toBe("INTERNATIONAL_METRO");
    expect(loc.latitude).toBeCloseTo(32.776, 2);
    expect(loc.longitude).toBeCloseTo(-96.797, 2);
  });

  it("Invariant: Obscure or unknown location returns null coordinates and conservative confidence without fabricating geography", () => {
    const loc = LocationResolver.resolve("Zululand Remote Settlement 404");
    expect(loc.countryCode).toBe("UNKNOWN");
    expect(loc.cityTier).toBe("UNKNOWN");
    expect(loc.latitude).toBeNull();
    expect(loc.longitude).toBeNull();
    expect(loc.confidence).toBeLessThanOrEqual(0.3);
    expect(loc.source).toBe("FALLBACK");
  });
});
