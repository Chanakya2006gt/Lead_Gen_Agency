import { ReviewTrend, AuditTelemetry } from "@/db/schema";

export interface ScoreInput {
  rating: number;
  reviewCount: number;
  reviewTrend: ReviewTrend;
  hasWebsite: boolean;
  category?: string | null;
  auditTelemetry?: AuditTelemetry | null;
}

export interface ScoreResult {
  reputationScore: number;
  digitalGapScore: number;
  opportunityScore: number;
  confidenceScore: number;
  totalLeadScore: number;
}

export class ScoringEngine {
  public static calculate(input: ScoreInput): ScoreResult {
    const reputationScore = this.calculateReputationScore(
      input.rating,
      input.reviewCount,
      input.reviewTrend
    );

    const digitalGapScore = this.calculateDigitalGapScore(
      input.hasWebsite,
      input.auditTelemetry
    );

    const opportunityScore = this.calculateOpportunityScore(
      input.category,
      input.hasWebsite,
      input.auditTelemetry
    );

    const confidenceScore = this.calculateConfidenceScore(
      input.hasWebsite,
      input.auditTelemetry
    );

    // Weighted Lead Score Formula
    const rawTotal =
      0.35 * reputationScore +
      0.30 * digitalGapScore +
      0.20 * opportunityScore +
      0.15 * confidenceScore;

    const totalLeadScore = Math.min(100, Math.max(0, Math.round(rawTotal)));

    return {
      reputationScore,
      digitalGapScore,
      opportunityScore,
      confidenceScore,
      totalLeadScore,
    };
  }

  private static calculateReputationScore(
    rating: number,
    reviewCount: number,
    trend: ReviewTrend
  ): number {
    // Rating component: 4.0 -> 0 pts, 5.0 -> 50 pts
    const ratingScore = Math.max(0, (rating - 4.0) * 50);

    // Volume component: 50 -> 2.5 pts, 600+ -> 30 pts
    const volumeScore = Math.min(30, reviewCount * 0.05);

    // Velocity momentum bonus
    let trendBonus = 0;
    if (trend === "GROWING") {
      trendBonus = 20;
    } else if (trend === "STABLE") {
      trendBonus = 10;
    } else if (trend === "DECLINING") {
      trendBonus = 0;
    } else if (trend === "STALE") {
      trendBonus = -15;
    }

    const total = ratingScore + volumeScore + trendBonus;
    return Math.min(100, Math.max(0, Math.round(total)));
  }

  private static calculateDigitalGapScore(
    hasWebsite: boolean,
    telemetry?: AuditTelemetry | null
  ): number {
    // Binary Gate: No website is maximum digital gap
    if (!hasWebsite) {
      return 100;
    }

    if (!telemetry) {
      return 50; // default baseline if pending audit
    }

    let gap = 0;

    if (!telemetry.hasMobileViewport) gap += 25;
    if (telemetry.hasHorizontalScroll) gap += 20;
    if (!telemetry.hasPhoneCta) gap += 15;
    if (!telemetry.hasEnquiryOrBookingForm) gap += 20;
    if (!telemetry.isHttps) gap += 10;
    if (telemetry.domLoadTimeSec > 3.0) gap += 10;
    if (telemetry.brokenLinksCount > 0) gap += Math.min(15, telemetry.brokenLinksCount * 5);
    if (telemetry.jsErrorsCount > 0) gap += 10;

    return Math.min(100, Math.max(0, gap));
  }

  private static calculateOpportunityScore(
    category?: string | null,
    hasWebsite?: boolean,
    telemetry?: AuditTelemetry | null
  ): number {
    let score = 40; // baseline

    const highTicketKeywords = [
      "dental",
      "dentist",
      "roofing",
      "roof",
      "hvac",
      "solar",
      "legal",
      "attorney",
      "lawyer",
      "clinic",
      "medical",
      "cosmetic",
      "salon",
      "custom",
      "fabrication",
      "contractor",
      "remodel",
    ];

    const catLower = (category || "").toLowerCase();
    if (highTicketKeywords.some((kw) => catLower.includes(kw))) {
      score += 25;
    }

    // If business is doing quoting / WhatsApp operations
    if (telemetry?.hasWhatsAppCta) {
      score += 20;
    }

    // Missing booking systems in high-appointment niches
    if (telemetry && !telemetry.hasEnquiryOrBookingForm) {
      score += 15;
    }

    if (!hasWebsite) {
      score += 15;
    }

    return Math.min(100, Math.max(0, score));
  }

  private static calculateConfidenceScore(
    hasWebsite: boolean,
    telemetry?: AuditTelemetry | null
  ): number {
    if (!hasWebsite) {
      return 100; // Deterministic Google Maps observation
    }

    if (!telemetry || !telemetry.findings || telemetry.findings.length === 0) {
      return 85;
    }

    const totalConf = telemetry.findings.reduce((sum, f) => sum + (f.confidence || 0.8), 0);
    const avg = totalConf / telemetry.findings.length;
    return Math.min(100, Math.max(50, Math.round(avg * 100)));
  }
}
