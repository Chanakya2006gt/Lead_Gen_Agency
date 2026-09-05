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
  discoveryNiche?: string;
  discoveryQuery?: string;
  googlePrimaryType?: string;
  googlePrimaryTypeDisplayName?: string;
  categorySource?: "GOOGLE_VERIFIED" | "GOOGLE_MAPS_DOM" | "WEBSITE_META" | "USER_SPECIFIED" | "UNKNOWN";
  categoryConfidence?: number;
}

export interface FilterResult {
  qualified: boolean;
  unqualifiedReason?: string;
  rating: number;
  reviewCount: number;
  lastReviewDate?: string | null;
  reviewsLast30Days: number | null;
  reviewsLast90Days: number | null;
  reviewsLast180Days: number | null;
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

    // Gate 1: Star Rating Hard Threshold (>= 4.0)
    if (typeof business.rating !== "number" || isNaN(business.rating) || business.rating < this.MIN_RATING) {
      return {
        qualified: false,
        unqualifiedReason: `Rating (${business.rating}) is below required minimum threshold (${this.MIN_RATING})`,
        rating: business.rating || 0,
        reviewCount: business.reviewCount || 0,
        reviewsLast30Days: null,
        reviewsLast90Days: null,
        reviewsLast180Days: null,
        reviewTrend: "UNKNOWN",
        hasWebsite,
      };
    }

    // Gate 2: Review Volume Hard Threshold (>= 50)
    if (typeof business.reviewCount !== "number" || isNaN(business.reviewCount) || business.reviewCount < this.MIN_REVIEW_COUNT) {
      return {
        qualified: false,
        unqualifiedReason: `Review count (${business.reviewCount}) is below required minimum threshold (${this.MIN_REVIEW_COUNT})`,
        rating: business.rating,
        reviewCount: business.reviewCount || 0,
        reviewsLast30Days: null,
        reviewsLast90Days: null,
        reviewsLast180Days: null,
        reviewTrend: "UNKNOWN",
        hasWebsite,
      };
    }

    // Gate 3: Empirical Review Recency (Only computed if raw timestamps exist)
    const rawReviews = business.reviews || [];
    let lastReviewDate: string | null = null;
    let reviewsLast30Days: number | null = null;
    let reviewsLast90Days: number | null = null;
    let reviewsLast180Days: number | null = null;
    let reviewTrend: ReviewTrend = "UNKNOWN";

    const refTime = referenceDate.getTime();
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const timestamps: number[] = [];

    for (const r of rawReviews) {
      if (!r.publishedAtDate) continue;
      const t = new Date(r.publishedAtDate).getTime();
      if (!isNaN(t)) {
        timestamps.push(t);
      }
    }

    if (timestamps.length > 0) {
      timestamps.sort((a, b) => b - a);
      lastReviewDate = new Date(timestamps[0]).toISOString();
      reviewsLast30Days = 0;
      reviewsLast90Days = 0;
      reviewsLast180Days = 0;

      for (const t of timestamps) {
        const ageDays = (refTime - t) / MS_PER_DAY;
        if (ageDays <= 30) reviewsLast30Days++;
        if (ageDays <= 90) reviewsLast90Days++;
        if (ageDays <= 180) reviewsLast180Days++;
      }

      // Determine Velocity Trend: Single discovery pull cannot establish statistical velocity.
      // Longitudinal velocity is calculated exclusively from the lead_observations ledger.
      reviewTrend = "UNKNOWN";
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
