import { describe, it, expect } from "vitest";
import { DossierSynthesizer } from "@/services/synthesis/DossierSynthesizer";

describe("DossierSynthesizer (Evidence Grounding & Zero Hallucination Invariant)", () => {
  it("Generates deterministic dossier with verified DOM bottlenecks for broken site", async () => {
    const dossier = await DossierSynthesizer.synthesize({
      name: "Precision Dental Care",
      category: "Dentist",
      rating: 4.8,
      reviewCount: 180,
      reviewTrend: "GROWING",
      hasWebsite: true,
      websiteUrl: "http://localhost:3099/sites/broken-legacy",
      auditTelemetry: {
        isHttps: false,
        hasMobileViewport: false,
        hasHorizontalScroll: true,
        domLoadTimeSec: 3.8,
        hasPhoneCta: false,
        hasWhatsAppCta: false,
        hasEnquiryOrBookingForm: false,
        brokenLinksCount: 1,
        jsErrorsCount: 1,
        extractedServices: [],
        findings: [
          {
            category: "ux",
            finding: "Missing Mobile Viewport",
            evidence: "HTML lacks meta viewport tag",
            selectorOrUrl: "head",
            confidence: 1.0,
          },
        ],
      },
    });

    expect(dossier.reputationScore).toBeGreaterThanOrEqual(65);
    expect(dossier.digitalGapScore).toBeGreaterThanOrEqual(80);
    expect(dossier.overallLeadScore).toBeGreaterThanOrEqual(65);
    expect(dossier.recommendedPitch.coreAngle).toContain("Precision Dental Care");
    expect(dossier.recommendedPitch.identifiedBottlenecks.length).toBeGreaterThan(0);
    expect(dossier.recommendedPitch.estimatedValueRange).toBeTruthy();
  });

  it("Synthesizes high-conviction digital storefront pitch for business with no website", async () => {
    const dossier = await DossierSynthesizer.synthesize({
      name: "Apex Dental Specialists",
      category: "Dentist",
      rating: 4.9,
      reviewCount: 350,
      reviewTrend: "GROWING",
      hasWebsite: false,
      websiteUrl: null,
    });

    expect(dossier.digitalGapScore).toBe(100);
    expect(dossier.opportunityType).toBe("WEBSITE");
    expect(dossier.recommendedPitch.coreAngle).toContain("High-Reputation Digital Storefront");
  });
});
