import { describe, it, expect } from "vitest";
import { ScoringEngine } from "@/features/qualification/ScoringEngine";

describe("ScoringEngine (4D Mathematical Model)", () => {
  it("Assigns Maximum Digital Gap (100) and High Opportunity to No-Website Leads", () => {
    const scores = ScoringEngine.computeScores({
      rating: 4.8,
      reviewCount: 300,
      reviewTrend: "GROWING",
      reviewsLast30Days: 10,
      reviewsLast90Days: 25,
      hasWebsite: false,
      auditTelemetry: null,
      opportunityType: "WEBSITE",
    });

    expect(scores.digitalGapScore).toBe(100);
    expect(scores.opportunityScore).toBe(60);
    expect(scores.reputationScore).toBeGreaterThan(80);
    expect(scores.overallLeadScore).toBeGreaterThan(80);
  });

  it("Computes empirical gap scores when site lacks mobile viewport and SSL", () => {
    const scores = ScoringEngine.computeScores({
      rating: 4.5,
      reviewCount: 150,
      reviewTrend: "STABLE",
      reviewsLast30Days: 4,
      reviewsLast90Days: 12,
      hasWebsite: true,
      auditTelemetry: {
        viewportMetaPresent: false, // +30
        hasHorizontalOverflow: true, // +20
        hasSsl: false, // +25
        brokenLinksCount: 1, // +10
        jsConsoleErrorsCount: 1, // +10
        initialLoadLatencyMs: 1200,
        hasDirectClickToCall: false, // +15
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false, // +20
        findings: [],
      },
      opportunityType: "WEBSITE",
    });

    expect(scores.digitalGapScore).toBe(100); // Capped at 100
    expect(scores.overallLeadScore).toBeGreaterThan(80);
  });

  it("Computes lower gap score for modern, responsive sites with booking funnels", () => {
    const scores = ScoringEngine.computeScores({
      rating: 4.9,
      reviewCount: 400,
      reviewTrend: "GROWING",
      reviewsLast30Days: 15,
      reviewsLast90Days: 40,
      hasWebsite: true,
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 400,
        hasDirectClickToCall: true,
        hasWhatsAppDirectLink: true,
        hasInteractiveBookingForm: true,
        findings: [],
      },
      opportunityType: "WEBSITE_AUTOMATION",
    });

    expect(scores.digitalGapScore).toBe(0);
    expect(scores.reputationScore).toBeGreaterThan(85);
  });
});
