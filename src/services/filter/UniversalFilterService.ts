import { ReviewTrend } from "@/db/schema";

export interface RawReviewTimestamp {
  publishedAtDate?: string | Date;
  date?: string;
  isoDate?: string;
}

export interface RawBusinessInput {
  placeId: string;
  name: string;
  category?: string;
  rating: number;
  reviewCount: number;
  websiteUrl?: string | null;
  phone?: string;
  formattedAddress?: string;
  googleMapsUrl?: string;
  reviews?: RawReviewTimestamp[];
}

export interface FilterResult {
  isQualified: boolean;
  rejectionReason?: string;
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
  public static readonly MIN_REVIEWS = 50;
  public static readonly DEFAULT_MIN_90D_REVIEWS = 3;

  /**
   * Evaluates if a raw business meets the 13 Core System Invariants
   */
  public static evaluate(
    business: RawBusinessInput,
    min90dReviewsThreshold: number = UniversalFilterService.DEFAULT_MIN_90D_REVIEWS,
    now: Date = new Date()
  ): FilterResult {
    // Invariant Gate 1 & 2: Hard Numeric Qualification
    if (business.rating < UniversalFilterService.MIN_RATING) {
      return {
        isQualified: false,
        rejectionReason: `Rating ${business.rating.toFixed(2)} is below minimum threshold ${UniversalFilterService.MIN_RATING.toFixed(1)}`,
        rating: business.rating,
        reviewCount: business.reviewCount,
        reviewsLast30Days: 0,
        reviewsLast90Days: 0,
        reviewsLast180Days: 0,
        reviewTrend: "UNKNOWN",
        hasWebsite: !!business.websiteUrl && business.websiteUrl.trim().length > 0,
      };
    }

    if (business.reviewCount < UniversalFilterService.MIN_REVIEWS) {
      return {
        isQualified: false,
        rejectionReason: `Review count ${business.reviewCount} is below minimum threshold ${UniversalFilterService.MIN_REVIEWS}`,
        rating: business.rating,
        reviewCount: business.reviewCount,
        reviewsLast30Days: 0,
        reviewsLast90Days: 0,
        reviewsLast180Days: 0,
        reviewTrend: "UNKNOWN",
        hasWebsite: !!business.websiteUrl && business.websiteUrl.trim().length > 0,
      };
    }

    // Invariant Gate 3: Calculate Review Recency Buckets
    const { reviews30d, reviews90d, reviews180d, lastReviewDate } = this.calculateReviewBuckets(
      business.reviews || [],
      now
    );

    // Invariant Gate 4: Calculate Review Trend Velocity
    const reviewTrend = this.calculateReviewTrend(reviews30d, reviews90d, reviews180d);

    const hasWebsite = !!business.websiteUrl && business.websiteUrl.trim().length > 0;

    return {
      isQualified: true,
      rating: business.rating,
      reviewCount: business.reviewCount,
      lastReviewDate: lastReviewDate ? lastReviewDate.toISOString() : null,
      reviewsLast30Days: reviews30d,
      reviewsLast90Days: reviews90d,
      reviewsLast180Days: reviews180d,
      reviewTrend,
      hasWebsite,
    };
  }

  /**
   * Buckets review timestamps into 30, 90, and 180 day windows
   */
  public static calculateReviewBuckets(
    reviews: RawReviewTimestamp[],
    now: Date = new Date()
  ): {
    reviews30d: number;
    reviews90d: number;
    reviews180d: number;
    lastReviewDate: Date | null;
  } {
    if (!reviews || reviews.length === 0) {
      return { reviews30d: 0, reviews90d: 0, reviews180d: 0, lastReviewDate: null };
    }

    const nowMs = now.getTime();
    const ms30d = 30 * 24 * 60 * 60 * 1000;
    const ms90d = 90 * 24 * 60 * 60 * 1000;
    const ms180d = 180 * 24 * 60 * 60 * 1000;

    let reviews30d = 0;
    let reviews90d = 0;
    let reviews180d = 0;
    let lastReviewDate: Date | null = null;

    for (const r of reviews) {
      const rawDateStr = r.publishedAtDate || r.date || r.isoDate;
      if (!rawDateStr) continue;

      const dateObj = new Date(rawDateStr);
      if (isNaN(dateObj.getTime())) continue;

      if (!lastReviewDate || dateObj.getTime() > lastReviewDate.getTime()) {
        lastReviewDate = dateObj;
      }

      const diffMs = nowMs - dateObj.getTime();
      if (diffMs < 0) continue; // future date anomaly check

      if (diffMs <= ms30d) {
        reviews30d++;
      }
      if (diffMs <= ms90d) {
        reviews90d++;
      }
      if (diffMs <= ms180d) {
        reviews180d++;
      }
    }

    return { reviews30d, reviews90d, reviews180d, lastReviewDate };
  }

  /**
   * Trajectory velocity calculation:
   * Rv = (reviews30d * 3) / (reviews90d + 0.001)
   */
  public static calculateReviewTrend(
    reviews30d: number,
    reviews90d: number,
    reviews180d: number
  ): ReviewTrend {
    if (reviews90d === 0 && reviews180d === 0) {
      return "STALE";
    }

    if (reviews90d === 0 && reviews180d > 0) {
      return "DECLINING";
    }

    const velocityRatio = (reviews30d * 3) / (reviews90d + 0.001);

    if (velocityRatio > 1.25 && reviews90d >= 3) {
      return "GROWING";
    } else if (velocityRatio >= 0.75 && reviews90d >= 2) {
      return "STABLE";
    } else if (velocityRatio < 0.75 || reviews90d < 2) {
      return "DECLINING";
    }

    return "UNKNOWN";
  }
}
