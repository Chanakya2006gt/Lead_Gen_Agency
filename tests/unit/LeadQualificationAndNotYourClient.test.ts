import { describe, it, expect } from "vitest";
import { DossierSynthesizer } from "@/features/synthesis/DossierSynthesizer";
import { QualificationEngine } from "@/features/qualification/QualificationEngine";
import { CustomerJourneyDetector } from "@/features/qualification/CustomerJourneyDetector";
import { BusinessModelClassifier } from "@/features/commercial/BusinessModelClassifier";
import { OpportunityRelevanceEngine } from "@/features/qualification/OpportunityRelevanceEngine";

describe("Evidence-Driven Lead Qualification & 'Not Your Client' Detection Suite", () => {
  // 1. TRELIO (SaaS Entity - NOT A FIT)
  it("Scenario 1: TRELIO (SaaS with responsive site) classifies as NOT_A_FIT and blocks outreach generation", async () => {
    const dossier = await DossierSynthesizer.synthesize({
      name: "TRELIO",
      category: "Software company",
      hasWebsite: true,
      websiteUrl: "https://trelio.in",
      rating: null,
      reviewCount: null,
      reviewTrend: "UNKNOWN",
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 741,
        hasDirectClickToCall: false, // Normal for SaaS
        hasWhatsAppDirectLink: false, // Normal for SaaS
        hasInteractiveBookingForm: false, // Normal for SaaS
        findings: [],
      },
    });

    expect(dossier.disposition).toBe("NOT_A_FIT");
    expect(dossier.recommendedPitch.outreachAllowed).toBe(false);
    expect(dossier.recommendedPitch.dispositionReason).toContain("no sufficiently evidenced agency opportunity");
    expect(dossier.executiveSummary).toContain("NOT A FIT");
    expect(dossier.executiveSummary).toContain("Do not pursue");
  });

  // 2. Industrial Manufacturer (Operating business with functional corporate presence - NOT A FIT)
  it("Scenario 2: Industrial Manufacturer with clean corporate site classifies as NOT_A_FIT", async () => {
    const dossier = await DossierSynthesizer.synthesize({
      name: "Apex Heavy Machinery Pvt Ltd",
      category: "Industrial Machinery Manufacturing",
      hasWebsite: true,
      websiteUrl: "https://apexmachinery.com",
      rating: null,
      reviewCount: null,
      reviewTrend: "UNKNOWN",
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 650,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
    });

    expect(dossier.disposition).toBe("NOT_A_FIT");
    expect(dossier.recommendedPitch.outreachAllowed).toBe(false);
  });

  // 3. Unknown Entity (Fails closed to INSUFFICIENT_EVIDENCE)
  it("Scenario 3: Unknown entity without context fails closed to INSUFFICIENT_EVIDENCE", async () => {
    const dossier = await DossierSynthesizer.synthesize({
      name: "Alpha Gamma 44",
      category: "Operating Business",
      hasWebsite: true,
      websiteUrl: "https://alphagamma44.org",
      rating: null,
      reviewCount: null,
      reviewTrend: "UNKNOWN",
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 500,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
    });

    expect(dossier.disposition).toBe("INSUFFICIENT_EVIDENCE");
    expect(dossier.recommendedPitch.outreachAllowed).toBe(false);
    expect(dossier.executiveSummary).toContain("INSUFFICIENT EVIDENCE");
  });

  // 4. Minor Technical Lag Only (LOW_OPPORTUNITY)
  it("Scenario 4: Site with minor load time and no conversion bottleneck classifies as LOW_OPPORTUNITY", async () => {
    const businessModel = BusinessModelClassifier.classify({
      name: "City Auto Garage",
      category: "Automotive Services",
      domain: "cityautogarage.in",
    });

    const customerJourney = CustomerJourneyDetector.detect({
      name: "City Auto Garage",
      category: "Automotive Services",
      hasClickToCall: true,
    });

    const opportunityAssessment = OpportunityRelevanceEngine.evaluate({
      name: "City Auto Garage",
      category: "Automotive Services",
      businessModel,
      hasWebsite: true,
      websiteUrl: "https://cityautogarage.in",
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 1200,
        hasDirectClickToCall: true,
        hasWhatsAppDirectLink: true,
        hasInteractiveBookingForm: true,
        findings: [],
      },
    });

    const qualification = QualificationEngine.evaluate({
      name: "City Auto Garage",
      category: "Automotive Services",
      businessModel,
      customerJourney,
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 1200,
        hasDirectClickToCall: true,
        hasWhatsAppDirectLink: true,
        hasInteractiveBookingForm: true,
        findings: [],
      },
      opportunityAssessment,
    });

    expect(qualification.disposition).toBe("NURTURE");
    expect(qualification.outreachAllowed).toBe(false);
  });

  // 5. High-Volume Dental Clinic (PURSUE)
  it("Scenario 5: High-volume dental clinic with manual phone booking qualifies as PURSUE with outreach enabled", async () => {
    const dossier = await DossierSynthesizer.synthesize({
      name: "SmileCraft Super Speciality Dental Clinic",
      category: "Dental Clinic",
      hasWebsite: true,
      websiteUrl: "https://smilecraftdental.in",
      rating: 4.8,
      reviewCount: 280,
      googleMapsUrl: "https://maps.google.com/?cid=123",
      reviewTrend: "GROWING",
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 400,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false, // Manual phone intake bottleneck
        findings: [],
      },
    });

    expect(dossier.disposition).toBe("PURSUE");
    expect(dossier.recommendedPitch.outreachAllowed).toBe(true);
    expect(dossier.recommendedPitch.suggestedScope).toContain("WhatsApp Intake Engine");
  });

  // 6. Disconnected Google Business Profile (PURSUE)
  it("Scenario 6: Disconnected Google Business Profile qualifies as PURSUE for local recovery", async () => {
    const dossier = await DossierSynthesizer.synthesize({
      name: "Dr. Rao Multispeciality Clinic",
      category: "Medical Clinic",
      hasWebsite: false,
      isGbpDisconnected: true,
      unlinkedWebsiteUrl: "https://drraoclinic.in",
      rating: 4.7,
      reviewCount: 160,
      googleMapsUrl: "https://maps.google.com/?cid=999",
      reviewTrend: "GROWING",
    });

    expect(dossier.disposition).toBe("PURSUE");
    expect(dossier.recommendedPitch.outreachAllowed).toBe(true);
    expect(dossier.recommendedPitch.coreAngle).toContain("Google Maps profile");
  });

  // 7. Broken Viewport Layout Breakdown (PURSUE)
  it("Scenario 7: Critical mobile viewport layout overflow qualifies as PURSUE", async () => {
    const dossier = await DossierSynthesizer.synthesize({
      name: "Warangal Diagnostics Center",
      category: "Diagnostic Center",
      hasWebsite: true,
      websiteUrl: "https://warangaldiag.in",
      rating: 4.6,
      reviewCount: 90,
      googleMapsUrl: "https://maps.google.com/?cid=888",
      reviewTrend: "STABLE",
      auditTelemetry: {
        viewportMetaPresent: false, // Broken viewport
        hasHorizontalOverflow: true,
        hasSsl: true,
        brokenLinksCount: 2,
        jsConsoleErrorsCount: 1,
        initialLoadLatencyMs: 1400,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
    });

    expect(dossier.disposition).toBe("PURSUE");
    expect(dossier.recommendedPitch.outreachAllowed).toBe(true);
  });
});
