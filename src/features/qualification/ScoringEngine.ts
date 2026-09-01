import { AuditTelemetry, ReviewTrend, OpportunityType } from "@/core/db/schema";

export interface ScoringInputs {
  rating: number;
  reviewCount: number;
  reviewTrend: ReviewTrend;
  reviewsLast30Days: number;
  reviewsLast90Days: number;
  hasWebsite: boolean;
  auditTelemetry?: AuditTelemetry | null;
  opportunityType: OpportunityType;
}

export interface DetailedScores {
  reputationScore: number; // S_rep (0-100)
  digitalGapScore: number; // S_gap (0-100)
  opportunityScore: number; // S_opp (0-100)
  confidenceScore: number; // S_conf (0-100)
  overallLeadScore: number; // S_total (0-100)
}

export class ScoringEngine {
  /**
   * 1. Reputation Score (S_rep)
   * Base rating normalized + Volume bonus + Recency multiplier
   */
  public static calculateReputationScore(inputs: ScoringInputs): number {
    const { rating, reviewCount, reviewTrend } = inputs;

    // Rating Score (0 to 50 pts): Maps 4.0 -> 30 pts, 5.0 -> 50 pts
    const ratingScore = Math.min(50, Math.max(0, ((rating - 3.5) / 1.5) * 50));

    // Volume Score (0 to 30 pts): Log scale on reviews (50 -> 10 pts, 500+ -> 30 pts)
    const volumeScore = Math.min(
      30,
      (Math.log10(Math.max(10, reviewCount)) / Math.log10(500)) * 30
    );

    // Momentum Multiplier (0 to 20 pts)
    let momentumScore = 10;
    if (reviewTrend === "GROWING") momentumScore = 20;
    else if (reviewTrend === "STABLE") momentumScore = 15;
    else if (reviewTrend === "DECLINING") momentumScore = 5;
    else if (reviewTrend === "STALE") momentumScore = 0;

    return Math.round(Math.min(100, Math.max(0, ratingScore + volumeScore + momentumScore)));
  }

  /**
   * 2. Digital Surface Gap Score (S_gap)
   * Measures severity of technical & UX failure on web/mobile
   */
  public static calculateDigitalGapScore(inputs: ScoringInputs): number {
    const { hasWebsite, auditTelemetry } = inputs;

    // Zero website = Maximum Digital Gap (100)
    if (!hasWebsite || !auditTelemetry) {
      return 100;
    }

    let gap = 0;

    if (!auditTelemetry.hasSsl) gap += 25; // Critical Trust Violation
    if (!auditTelemetry.viewportMetaPresent) gap += 30; // Critical Mobile Viewport Failure
    if (auditTelemetry.hasHorizontalOverflow) gap += 20; // Critical Layout Break
    if (!auditTelemetry.hasDirectClickToCall) gap += 15; // Lost Mobile Conversions
    if (!auditTelemetry.hasInteractiveBookingForm) gap += 20; // No Automated Funnel
    if (auditTelemetry.brokenLinksCount > 0) gap += 10;
    if (auditTelemetry.jsConsoleErrorsCount > 0) gap += 10;

    return Math.round(Math.min(100, Math.max(0, gap)));
  }

  /**
   * 3. Operational Opportunity Score (S_opp)
   * High-tier software opportunities yield higher potential contract value
   */
  public static calculateOpportunityScore(opportunityType: OpportunityType): number {
    switch (opportunityType) {
      case "CUSTOM_OPERATIONAL_SOFTWARE":
        return 95; // Custom workflows, portals, multi-location ops ($8k-$25k)
      case "WEBSITE_AUTOMATION":
        return 85; // Speed + Calendars + CRM sync + AI Booking ($4k-$10k)
      case "WEBSITE":
        return 75; // Brand new modern responsive storefront ($2.5k-$6k)
      default:
        return 50;
    }
  }

  /**
   * 4. Overall 4D Mathematical Synthesis
   * S_total = (S_rep * 0.35) + (S_gap * 0.40) + (S_opp * 0.25)
   */
  public static computeScores(inputs: ScoringInputs): DetailedScores {
    const reputationScore = this.calculateReputationScore(inputs);
    const digitalGapScore = this.calculateDigitalGapScore(inputs);
    const opportunityScore = this.calculateOpportunityScore(inputs.opportunityType);

    // Calculate Empirical DOM Confidence
    let confidenceScore = 100;
    if (inputs.hasWebsite && inputs.auditTelemetry) {
      const findings = inputs.auditTelemetry.findings || [];
      if (findings.length > 0) {
        const avgConfidence =
          findings.reduce((acc, f) => acc + (f.confidence || 0.9), 0) / findings.length;
        confidenceScore = Math.round(avgConfidence * 100);
      }
    }

    const overallLeadScore = Math.round(
      reputationScore * 0.35 + digitalGapScore * 0.4 + opportunityScore * 0.25
    );

    return {
      reputationScore,
      digitalGapScore,
      opportunityScore,
      confidenceScore,
      overallLeadScore: Math.min(100, Math.max(0, overallLeadScore)),
    };
  }
}
