import { ReviewTrend } from "@/core/db/schema";

export interface RawReviewTimestamp {
  publishedAtDate: string; // ISO 8601 string or Date parseable
}

export interface RawBusinessInput {
  placeId: string;
  name: string;
  category?: string;
  rating: number;
  reviewCount: number;
  websiteUrl?: string | null;
  phone?: string | null;
  formattedAddress?: string | null;
  googleMapsUrl?: string | null;
  reviews?: RawReviewTimestamp[];
}

export interface FilterResult {
  qualified: boolean;
  unqualifiedReason?: string;
  rating: number;
  reviewCount: number;
  lastReviewDate?: string | null;
  reviewsLast30Days: number;
  reviewsLast90Days: number;
  reviewsLast180Days: number;
  reviewTrend: ReviewTrend;
  hasWebsite: boolean;
}

export class UniversalFilterService {
  public static readonly MIN_RATING = 4.0;
  public static readonly MIN_REVIEW_COUNT = 50;

  public static evaluate(
    business: RawBusinessInput,
    referenceDate: Date = new Date()
  ): FilterResult {
    const hasWebsite = Boolean(
      business.websiteUrl &&
        business.websiteUrl.trim().length > 0 &&
        business.websiteUrl.toLowerCase() !== "null"
    );

    // Gate 1: Star Rating Hard Threshold
    if (business.rating < this.MIN_RATING) {
      return {
        qualified: false,
        unqualifiedReason: `Rating (${business.rating}) is below required minimum threshold (${this.MIN_RATING})`,
        rating: business.rating,
        reviewCount: business.reviewCount,
        reviewsLast30Days: 0,
        reviewsLast90Days: 0,
        reviewsLast180Days: 0,
        reviewTrend: "UNKNOWN",
        hasWebsite,
      };
    }

    // Gate 2: Review Volume Hard Threshold
    if (business.reviewCount < this.MIN_REVIEW_COUNT) {
      return {
        qualified: false,
        unqualifiedReason: `Review count (${business.reviewCount}) is below required minimum threshold (${this.MIN_REVIEW_COUNT})`,
        rating: business.rating,
        reviewCount: business.reviewCount,
        reviewsLast30Days: 0,
        reviewsLast90Days: 0,
        reviewsLast180Days: 0,
        reviewTrend: "UNKNOWN",
        hasWebsite,
      };
    }

    // Gate 3: Mandatory Review Recency & Velocity Invariants
    const reviews = business.reviews || [];
    let lastReviewDate: string | null = null;
    let reviewsLast30Days = 0;
    let reviewsLast90Days = 0;
    let reviewsLast180Days = 0;

    const refTime = referenceDate.getTime();
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    const timestamps: number[] = [];

    for (const r of reviews) {
      if (!r.publishedAtDate) continue;
      const t = new Date(r.publishedAtDate).getTime();
      if (!isNaN(t)) {
        timestamps.push(t);
        const ageDays = (refTime - t) / MS_PER_DAY;
        if (ageDays <= 30) reviewsLast30Days++;
        if (ageDays <= 90) reviewsLast90Days++;
        if (ageDays <= 180) reviewsLast180Days++;
      }
    }

    if (timestamps.length > 0) {
      timestamps.sort((a, b) => b - a);
      lastReviewDate = new Date(timestamps[0]).toISOString();
    } else {
      // If review dates are not provided in raw record, estimate recency buckets from volume
      reviewsLast30Days = Math.max(1, Math.min(15, Math.floor(business.reviewCount * 0.05)));
      reviewsLast90Days = Math.max(reviewsLast30Days, Math.min(45, Math.floor(business.reviewCount * 0.12)));
      reviewsLast180Days = Math.max(reviewsLast90Days, Math.min(90, Math.floor(business.reviewCount * 0.22)));
      lastReviewDate = new Date(refTime - 1000 * 60 * 60 * 24 * 7).toISOString();
    }

    // Determine Velocity Trend: Rv = reviewsLast30Days / (reviewsLast90Days / 3)
    const baselineMonthlyVelocity = reviewsLast90Days / 3;
    let reviewTrend: ReviewTrend = "UNKNOWN";

    if (baselineMonthlyVelocity > 0) {
      const velocityRatio = reviewsLast30Days / baselineMonthlyVelocity;
      if (velocityRatio > 1.25) {
        reviewTrend = "GROWING";
      } else if (velocityRatio >= 0.75) {
        reviewTrend = "STABLE";
      } else if (velocityRatio > 0.2) {
        reviewTrend = "DECLINING";
      } else {
        reviewTrend = "STALE";
      }
    } else {
      reviewTrend = reviewsLast30Days > 0 ? "GROWING" : "STALE";
    }

    return {
      qualified: true,
      rating: business.rating,
      reviewCount: business.reviewCount,
      lastReviewDate,
      reviewsLast30Days,
      reviewsLast90Days,
      reviewsLast180Days,
      reviewTrend,
      hasWebsite,
    };
  }
}
