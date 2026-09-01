import { describe, it, expect } from "vitest";
import { UniversalFilterService, RawBusinessInput } from "@/features/qualification/UniversalFilterService";

describe("UniversalFilterService (Core Invariant Verification)", () => {
  const baseNow = new Date("2026-09-01T12:00:00Z");

  it("Gate 1: Rejects rating below 4.0 (e.g. 3.99) even with 1000 reviews", () => {
    const business: RawBusinessInput = {
      placeId: "test_low_rating",
      name: "Low Rating Business",
      rating: 3.99,
      reviewCount: 1000,
    };

    const result = UniversalFilterService.evaluate(business, baseNow);
    expect(result.qualified).toBe(false);
    expect(result.unqualifiedReason).toContain("Rating (3.99) is below required minimum threshold (4)");
  });

  it("Gate 2: Rejects review count below 50 (e.g. 49 reviews) even with 5.0★ rating", () => {
    const business: RawBusinessInput = {
      placeId: "test_low_reviews",
      name: "Low Review Count Business",
      rating: 5.0,
      reviewCount: 49,
    };

    const result = UniversalFilterService.evaluate(business, baseNow);
    expect(result.qualified).toBe(false);
    expect(result.unqualifiedReason).toContain("Review count (49) is below required minimum threshold (50)");
  });

  it("Gate 1 & 2: Qualifies exactly 4.0 rating and 50 reviews", () => {
    const business: RawBusinessInput = {
      placeId: "test_boundary",
      name: "Boundary Qualified Business",
      rating: 4.0,
      reviewCount: 50,
      websiteUrl: "https://example.com",
      reviews: [
        { publishedAtDate: "2026-08-20T00:00:00Z" },
        { publishedAtDate: "2026-08-10T00:00:00Z" },
        { publishedAtDate: "2026-07-15T00:00:00Z" },
      ],
    };

    const result = UniversalFilterService.evaluate(business, baseNow);
    expect(result.qualified).toBe(true);
    expect(result.rating).toBe(4.0);
    expect(result.reviewCount).toBe(50);
    expect(result.hasWebsite).toBe(true);
  });

  it("Recency & Trend: Classifies as GROWING when 30d review velocity accelerates", () => {
    const reviews = [
      { publishedAtDate: "2026-08-25T00:00:00Z" },
      { publishedAtDate: "2026-08-20T00:00:00Z" },
      { publishedAtDate: "2026-08-15T00:00:00Z" },
      { publishedAtDate: "2026-08-05T00:00:00Z" }, // 4 in 30d
      { publishedAtDate: "2026-07-01T00:00:00Z" }, // 5 total in 90d
    ];

    const business: RawBusinessInput = {
      placeId: "test_growing",
      name: "Fast Growing Clinic",
      rating: 4.8,
      reviewCount: 150,
      reviews,
    };

    const result = UniversalFilterService.evaluate(business, baseNow);
    expect(result.qualified).toBe(true);
    expect(result.reviewsLast30Days).toBe(4);
    expect(result.reviewsLast90Days).toBe(5);
    expect(result.reviewTrend).toBe("GROWING");
  });

  it("Recency & Trend: Flags as STALE when zero reviews in past 90 days", () => {
    const reviews = [
      { publishedAtDate: "2025-12-01T00:00:00Z" },
      { publishedAtDate: "2025-10-01T00:00:00Z" },
    ];

    const business: RawBusinessInput = {
      placeId: "test_stale",
      name: "Stale Business",
      rating: 4.6,
      reviewCount: 200,
      reviews,
    };

    const result = UniversalFilterService.evaluate(business, baseNow);
    expect(result.qualified).toBe(true);
    expect(result.reviewsLast30Days).toBe(0);
    expect(result.reviewsLast90Days).toBe(0);
    expect(result.reviewTrend).toBe("STALE");
  });
});
