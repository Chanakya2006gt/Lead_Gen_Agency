import { describe, it, expect } from "vitest";
import { DossierSynthesizer } from "@/features/synthesis/DossierSynthesizer";

describe("DossierSynthesizer (Deterministic Grounded Pitch Formulation)", () => {
  it("Generates high-conviction website gap pitch when no website is present", async () => {
    const dossier = await DossierSynthesizer.synthesize({
      name: "Summit Dental Clinic",
      category: "Dental Clinic",
      rating: 4.85,
      reviewCount: 340,
      reviewTrend: "GROWING",
      hasWebsite: false,
      websiteUrl: null,
      phone: "+91 98765 43210",
      formattedAddress: "Hyderabad, Telangana",
    });

    expect(dossier.opportunityType).toBe("WEBSITE");
    expect(dossier.overallLeadScore).toBeGreaterThan(80);
    expect(dossier.recommendedPitch.coreAngle).toContain("Summit Dental Clinic");
    expect(dossier.identifiedBottlenecks[0]).toContain("Zero official website");
    expect(dossier.recommendedPitch.estimatedValueRange).toContain("₹");
    expect(dossier.recommendedPitch.estimatedValueRange).not.toContain("$");
    expect(dossier.recommendedPitch.estimatedValueRange).not.toContain("USD");
  });

  it("Synthesizes custom operational software angle for high-volume WhatsApp clinics", async () => {
    const dossier = await DossierSynthesizer.synthesize({
      name: "Apex Precision Auto",
      category: "Auto Repair",
      rating: 4.9,
      reviewCount: 520,
      reviewTrend: "GROWING",
      hasWebsite: true,
      websiteUrl: "https://example.com",
      phone: "+91 91234 56789",
      formattedAddress: "Warangal, Telangana",
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 350,
        hasDirectClickToCall: true,
        hasWhatsAppDirectLink: true,
        hasInteractiveBookingForm: false,
        findings: [
          {
            category: "conversion",
            finding: "Missing Interactive Scheduling Funnel",
            evidence: "No online calendar booking detected.",
            confidence: 0.9,
          },
        ],
      },
    });

    expect(dossier.opportunityType).toBe("CUSTOM_OPERATIONAL_SOFTWARE");
    expect(dossier.recommendedPitch.coreAngle).toContain("scheduling, WhatsApp intake");
    expect(dossier.recommendedPitch.estimatedValueRange).toContain("₹");
    expect(dossier.recommendedPitch.estimatedValueRange).not.toContain("$");
    expect(dossier.recommendedPitch.estimatedValueRange).not.toContain("USD");
  });
});
