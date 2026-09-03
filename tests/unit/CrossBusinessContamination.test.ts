import { describe, it, expect } from "vitest";
import { DossierSynthesizer } from "@/features/synthesis/DossierSynthesizer";

describe("Cross-Business Contamination Adversarial Suite", () => {
  it("Guarantees two businesses with similar names in the same city retain strictly isolated provider evidence", async () => {
    // Business A: Verified Google 4.8★ (120 reviews)
    const dossierA = await DossierSynthesizer.synthesize({
      name: "SmileCare Dental Clinic",
      category: "Dental Healthcare",
      hasWebsite: true,
      websiteUrl: "https://smilecaredental.in",
      formattedAddress: "Warangal, Telangana",
      rating: 4.8,
      reviewCount: 120,
      googleMapsUrl: "https://maps.google.com/?cid=aaa",
      reviewTrend: "GROWING",
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 300,
        hasDirectClickToCall: true,
        hasWhatsAppDirectLink: true,
        hasInteractiveBookingForm: true,
        findings: [],
      },
    });

    // Business B: Unlinked direct audit on domain with same city, unverified on Google
    const dossierB = await DossierSynthesizer.synthesize({
      name: "SmileCare Dental Care",
      category: "Dental Healthcare",
      hasWebsite: true,
      websiteUrl: "https://smilecaredentalcare.com",
      formattedAddress: "Warangal, Telangana",
      rating: null,
      reviewCount: null,
      googleMapsUrl: null,
      reviewTrend: "UNKNOWN",
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 400,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
    });

    // Verify Business A has verified Google evidence
    expect(dossierA.googleEvidence?.status).toBe("VERIFIED");
    expect(dossierA.googleEvidence?.rating).toBe(4.8);
    expect(dossierA.googleEvidence?.reviewCount).toBe(120);
    expect(dossierA.identifiedStrengths.some((s) => s.includes("4.8★"))).toBe(true);

    // Verify Business B is strictly unverified and has zero inherited metrics from Business A
    expect(dossierB.googleEvidence?.status).toBe("NOT_VERIFIED");
    expect(dossierB.googleEvidence?.rating).toBeNull();
    expect(dossierB.googleEvidence?.reviewCount).toBeNull();
    expect(dossierB.identifiedStrengths.some((s) => s.includes("4.8★"))).toBe(false);
    expect(dossierB.identifiedStrengths.some((s) => s.includes("120"))).toBe(false);
  });
});
