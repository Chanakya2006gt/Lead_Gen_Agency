import { describe, it, expect } from "vitest";
import { ReviewVelocityLedger } from "@/features/qualification/ReviewVelocityLedger";

describe("ReviewVelocityLedger (Longitudinal Invariant)", () => {
  it("Returns UNKNOWN on first observation (no preceding ledger record)", () => {
    const trend = ReviewVelocityLedger.computeTrend(
      { reviewCount: 150, observedAt: "2026-09-05T12:00:00.000Z" },
      null
    );
    expect(trend).toBe("UNKNOWN");
  });

  it("Returns UNKNOWN when preceding observation reviewCount is null", () => {
    const trend = ReviewVelocityLedger.computeTrend(
      { reviewCount: 150, observedAt: "2026-09-05T12:00:00.000Z" },
      { observedReviewCount: null, observedRating: 4.8, observedAt: "2026-08-01T12:00:00.000Z" }
    );
    expect(trend).toBe("UNKNOWN");
  });

  it("Returns UNKNOWN when elapsed time is less than 1 day", () => {
    const trend = ReviewVelocityLedger.computeTrend(
      { reviewCount: 152, observedAt: "2026-09-05T14:00:00.000Z" },
      { observedReviewCount: 150, observedRating: 4.8, observedAt: "2026-09-05T12:00:00.000Z" }
    );
    expect(trend).toBe("UNKNOWN");
  });

  it("Returns GROWING when review count increased over >=1 day", () => {
    const trend = ReviewVelocityLedger.computeTrend(
      { reviewCount: 165, observedAt: "2026-09-05T12:00:00.000Z" },
      { observedReviewCount: 150, observedRating: 4.8, observedAt: "2026-08-05T12:00:00.000Z" }
    );
    expect(trend).toBe("GROWING");
  });

  it("Returns STABLE when review count is unchanged within 60 days", () => {
    const trend = ReviewVelocityLedger.computeTrend(
      { reviewCount: 150, observedAt: "2026-09-05T12:00:00.000Z" },
      { observedReviewCount: 150, observedRating: 4.8, observedAt: "2026-08-20T12:00:00.000Z" }
    );
    expect(trend).toBe("STABLE");
  });

  it("Returns STALE when review count is unchanged after >60 days", () => {
    const trend = ReviewVelocityLedger.computeTrend(
      { reviewCount: 150, observedAt: "2026-09-05T12:00:00.000Z" },
      { observedReviewCount: 150, observedRating: 4.8, observedAt: "2026-06-01T12:00:00.000Z" }
    );
    expect(trend).toBe("STALE");
  });

  it("Returns DECLINING when review count decreased over time", () => {
    const trend = ReviewVelocityLedger.computeTrend(
      { reviewCount: 145, observedAt: "2026-09-05T12:00:00.000Z" },
      { observedReviewCount: 150, observedRating: 4.8, observedAt: "2026-08-01T12:00:00.000Z" }
    );
    expect(trend).toBe("DECLINING");
  });
});
