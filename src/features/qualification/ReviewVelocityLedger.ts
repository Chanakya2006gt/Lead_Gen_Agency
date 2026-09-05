import { ReviewTrend } from "@/core/db/schema";

export interface LedgerObservation {
  observedReviewCount: number | null;
  observedRating: number | null;
  observedAt: string;
}

export class ReviewVelocityLedger {
  /**
   * Computes empirical ReviewTrend from longitudinal observation ledger records.
   * Invariant: Single observation always returns "UNKNOWN".
   * Minimum 2 observations required over non-zero elapsed time.
   */
  public static computeTrend(
    current: { reviewCount: number | null; observedAt: string },
    preceding: LedgerObservation | null
  ): ReviewTrend {
    if (!preceding || current.reviewCount === null || preceding.observedReviewCount === null) {
      return "UNKNOWN";
    }

    const currentTime = new Date(current.observedAt).getTime();
    const precedingTime = new Date(preceding.observedAt).getTime();

    if (isNaN(currentTime) || isNaN(precedingTime) || currentTime <= precedingTime) {
      return "UNKNOWN";
    }

    const elapsedDays = (currentTime - precedingTime) / (1000 * 60 * 60 * 24);
    if (elapsedDays < 1) {
      // Within the same 24 hours, cannot establish statistical velocity
      return "UNKNOWN";
    }

    const reviewDelta = current.reviewCount - preceding.observedReviewCount;

    if (reviewDelta > 0) {
      return "GROWING";
    } else if (reviewDelta === 0) {
      return elapsedDays > 60 ? "STALE" : "STABLE";
    } else {
      return "DECLINING";
    }
  }
}
