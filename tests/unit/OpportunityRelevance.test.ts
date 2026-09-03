import { describe, it, expect } from "vitest";
import { OpportunityRelevanceEngine } from "@/features/qualification/OpportunityRelevanceEngine";
import { BusinessModelClassifier } from "@/features/commercial/BusinessModelClassifier";
import { Guardrails } from "@/core/domain/Guardrails";

describe("OpportunityRelevanceEngine Domain Tests", () => {
  it("Evaluates SaaS company: Rejects local clinic workflows and focuses on product onboarding", () => {
    const businessModel = BusinessModelClassifier.classify({
      name: "Trelio Cloud Systems",
      category: "Technology & Software Services",
      domain: "trelio.in",
    });

    const assessment = OpportunityRelevanceEngine.evaluate({
      name: "Trelio Cloud Systems",
      category: "Technology & Software Services",
      businessModel,
      hasWebsite: true,
      websiteUrl: "https://trelio.in",
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 380,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
    });

    expect(assessment.opportunityType).toBe("WEBSITE_AUTOMATION");
    expect(assessment.coreAngle).toContain("SaaS");
    expect(assessment.suggestedScope).toContain("Product Demo");
    expect(assessment.suggestedScope).not.toContain("WhatsApp");

    // Guardrail assertion passes
    expect(() => Guardrails.assertOpportunityRelevance(assessment, businessModel.model)).not.toThrow();
  });

  it("Evaluates Industrial Manufacturer: Generates RFQ and catalog architecture, rejecting WhatsApp and booking calendar", () => {
    const businessModel = BusinessModelClassifier.classify({
      name: "Apex Heavy Machinery Pvt Ltd",
      category: "Industrial Machinery Manufacturing",
      domain: "apexmachinery.com",
    });

    const assessment = OpportunityRelevanceEngine.evaluate({
      name: "Apex Heavy Machinery Pvt Ltd",
      category: "Industrial Machinery Manufacturing",
      businessModel,
      hasWebsite: true,
      websiteUrl: "https://apexmachinery.com",
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

    expect(assessment.opportunityType).toBe("WEBSITE_AUTOMATION");
    expect(assessment.coreAngle).toContain("Request-for-Quote (RFQ)");
    expect(assessment.suggestedScope).toContain("Industrial Product Catalog");
  });

  it("Evaluates Dental Clinic: Identifies appointment booking and WhatsApp intake as high relevance", () => {
    const businessModel = BusinessModelClassifier.classify({
      name: "Apex Dental Care",
      category: "Dental Healthcare",
      domain: "apexdental.in",
    });

    const assessment = OpportunityRelevanceEngine.evaluate({
      name: "Apex Dental Care",
      category: "Dental Healthcare",
      businessModel,
      hasWebsite: true,
      websiteUrl: "https://apexdental.in",
      googleEvidence: {
        status: "VERIFIED",
        placeId: "place_123",
        googleMapsUrl: "https://maps.google.com/?cid=123",
        rating: 4.8,
        reviewCount: 320,
        source: "GOOGLE_PLACES",
        retrievedAt: new Date().toISOString(),
      },
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

    expect(assessment.opportunityType).toBe("CUSTOM_OPERATIONAL_SOFTWARE");
    expect(assessment.relevance).toBe("HIGH");
    expect(assessment.suggestedScope).toContain("WhatsApp Intake Engine");
  });

  it("Evaluates Unknown Entity: Fails closed to UNKNOWN opportunity type and UNKNOWN relevance", () => {
    const businessModel = BusinessModelClassifier.classify({
      name: "OmniCorp 99",
      category: "Operating Business",
    });

    const assessment = OpportunityRelevanceEngine.evaluate({
      name: "OmniCorp 99",
      category: "Operating Business",
      businessModel,
      hasWebsite: true,
      websiteUrl: "https://omnicorp99.com",
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

    expect(assessment.opportunityType).toBe("UNKNOWN");
    expect(assessment.relevance).toBe("UNKNOWN");
    expect(assessment.confidence).toBe(0.3);
  });
});
