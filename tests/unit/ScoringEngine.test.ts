import { describe, it, expect } from "vitest";
import { ScoringEngine } from "@/services/scoring/ScoringEngine";

describe("ScoringEngine (4D Lead Scoring Formula)", () => {
  it("Scores 100 for digital gap when business has NO website", () => {
    const score = ScoringEngine.calculate({
      rating: 4.8,
      reviewCount: 300,
      reviewTrend: "GROWING",
      hasWebsite: false,
      category: "Dentist",
    });

    expect(score.digitalGapScore).toBe(100);
    expect(score.confidenceScore).toBe(100);
    expect(score.totalLeadScore).toBeGreaterThanOrEqual(80);
  });

  it("Penalizes stale momentum in reputation score", () => {
    const scoreGrowing = ScoringEngine.calculate({
      rating: 4.8,
      reviewCount: 200,
      reviewTrend: "GROWING",
      hasWebsite: true,
    });

    const scoreStale = ScoringEngine.calculate({
      rating: 4.8,
      reviewCount: 200,
      reviewTrend: "STALE",
      hasWebsite: true,
    });

    expect(scoreGrowing.reputationScore).toBeGreaterThan(scoreStale.reputationScore);
  });

  it("Calculates cumulative gap penalties for broken mobile viewport, missing forms, and slow speed", () => {
    const score = ScoringEngine.calculate({
      rating: 4.5,
      reviewCount: 100,
      reviewTrend: "STABLE",
      hasWebsite: true,
      category: "HVAC Contractor",
      auditTelemetry: {
        isHttps: false,
        hasMobileViewport: false,
        hasHorizontalScroll: true,
        domLoadTimeSec: 4.2,
        hasPhoneCta: false,
        hasWhatsAppCta: false,
        hasEnquiryOrBookingForm: false,
        brokenLinksCount: 2,
        jsErrorsCount: 1,
        extractedServices: [],
        findings: [
          {
            category: "ux",
            finding: "Missing Viewport",
            evidence: "No meta tag",
            confidence: 1.0,
          },
        ],
      },
    });

    expect(score.digitalGapScore).toBeGreaterThanOrEqual(90);
    expect(score.totalLeadScore).toBeGreaterThan(60);
  });
});
