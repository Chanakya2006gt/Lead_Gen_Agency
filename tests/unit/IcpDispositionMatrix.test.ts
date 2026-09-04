import { describe, it, expect } from "vitest";
import { QualificationEngine, QualificationInput } from "@/features/qualification/QualificationEngine";
import { BusinessModelClassifier } from "@/features/commercial/BusinessModelClassifier";
import { CustomerJourneyDetector } from "@/features/qualification/CustomerJourneyDetector";

describe("ICP Disposition Matrix (R1 - R12 Rules Table)", () => {
  it("Fixture 1: Disconnected GBP Website -> PURSUE (R1)", () => {
    const businessModel = BusinessModelClassifier.classify({
      name: "Warangal Smile Dental",
      category: "Dental Clinic",
    });
    const customerJourney = CustomerJourneyDetector.detect({
      name: "Warangal Smile Dental",
      category: "Dental Clinic",
      hasInteractiveBooking: true,
    });

    const input: QualificationInput = {
      name: "Warangal Smile Dental",
      category: "Dental Clinic",
      businessModel,
      customerJourney,
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 800,
        hasDirectClickToCall: true,
        hasWhatsAppDirectLink: true,
        hasInteractiveBookingForm: true,
        findings: [],
      },
      googleEvidence: {
        status: "VERIFIED",
        placeId: "place_123",
        googleMapsUrl: "https://maps.google.com/?cid=123",
        rating: 4.8,
        reviewCount: 120,
        source: "GOOGLE_PLACES",
        retrievedAt: new Date().toISOString(),
      },
      opportunityAssessment: {
        opportunityType: "DISCONNECTED_GBP_WEBSITE",
        relevance: "HIGH",
        confidence: 0.95,
        evidence: [],
        reasoning: "Website exists but not linked in GBP",
        coreAngle: "Reconnect website to GBP",
        suggestedScope: "GBP Sync",
      },
    };

    const res = QualificationEngine.evaluate(input);
    expect(res.disposition).toBe("PURSUE");
    expect(res.outreachAllowed).toBe(true);
    expect(res.opportunityFitScore).toBe(92);
  });

  it("Fixture 2: Greenfield / Zero Website -> PURSUE (R2)", () => {
    const businessModel = BusinessModelClassifier.classify({
      name: "Apex Auto Care",
      category: "Auto Repair",
    });
    const customerJourney = CustomerJourneyDetector.detect({
      name: "Apex Auto Care",
      category: "Auto Repair",
    });

    const input: QualificationInput = {
      name: "Apex Auto Care",
      category: "Auto Repair",
      businessModel,
      customerJourney,
      auditTelemetry: null,
      googleEvidence: {
        status: "VERIFIED",
        placeId: "place_456",
        googleMapsUrl: "https://maps.google.com/?cid=456",
        rating: 4.6,
        reviewCount: 85,
        source: "GOOGLE_PLACES",
        retrievedAt: new Date().toISOString(),
      },
      opportunityAssessment: {
        opportunityType: "WEBSITE",
        relevance: "HIGH",
        confidence: 0.9,
        evidence: [],
        reasoning: "Zero website",
        coreAngle: "Build website",
        suggestedScope: "Mobile storefront",
      },
    };

    const res = QualificationEngine.evaluate(input);
    expect(res.disposition).toBe("PURSUE");
    expect(res.outreachAllowed).toBe(true);
    expect(res.opportunityFitScore).toBe(95);
  });

  it("Fixture 3: Critical Layout Breakdown / No Viewport -> PURSUE (R3)", () => {
    const businessModel = BusinessModelClassifier.classify({
      name: "Heritage Salon",
      category: "Beauty Salon",
    });
    const customerJourney = CustomerJourneyDetector.detect({
      name: "Heritage Salon",
      category: "Beauty Salon",
    });

    const input: QualificationInput = {
      name: "Heritage Salon",
      category: "Beauty Salon",
      businessModel,
      customerJourney,
      auditTelemetry: {
        viewportMetaPresent: false,
        hasHorizontalOverflow: true,
        hasSsl: false,
        brokenLinksCount: 2,
        jsConsoleErrorsCount: 1,
        initialLoadLatencyMs: 1400,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
      googleEvidence: {
        status: "VERIFIED",
        placeId: "place_789",
        googleMapsUrl: "https://maps.google.com/?cid=789",
        rating: 4.4,
        reviewCount: 60,
        source: "GOOGLE_PLACES",
        retrievedAt: new Date().toISOString(),
      },
      opportunityAssessment: {
        opportunityType: "WEBSITE",
        relevance: "HIGH",
        confidence: 0.85,
        evidence: [],
        reasoning: "Broken viewport",
        coreAngle: "Mobile rebuild",
        suggestedScope: "Responsive UI",
      },
    };

    const res = QualificationEngine.evaluate(input);
    expect(res.disposition).toBe("PURSUE");
    expect(res.outreachAllowed).toBe(true);
    expect(res.opportunityFitScore).toBe(88);
  });

  it("Fixture 4: Functioning B2B SaaS (TRELIO) -> NOT_A_FIT (R4)", () => {
    const businessModel = BusinessModelClassifier.classify({
      name: "TRELIO",
      category: "Software company",
      domain: "trelio.in",
    });
    const customerJourney = CustomerJourneyDetector.detect({
      name: "TRELIO",
      category: "Software company",
      domain: "trelio.in",
    });

    const input: QualificationInput = {
      name: "TRELIO",
      category: "Software company",
      businessModel,
      customerJourney,
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 740,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
      googleEvidence: {
        status: "NOT_VERIFIED",
        placeId: null,
        googleMapsUrl: null,
        rating: null,
        reviewCount: null,
        source: "NONE",
        retrievedAt: new Date().toISOString(),
      },
      opportunityAssessment: {
        opportunityType: "UNKNOWN",
        relevance: "LOW",
        confidence: 0.9,
        evidence: [],
        reasoning: "SaaS app functional",
        coreAngle: "SaaS optimization",
        suggestedScope: "Web app perf",
      },
    };

    const res = QualificationEngine.evaluate(input);
    expect(res.disposition).toBe("NOT_A_FIT");
    expect(res.outreachAllowed).toBe(false);
  });

  it("Fixture 5: Functioning B2B Industrial Manufacturer -> NOT_A_FIT (R5)", () => {
    const businessModel = BusinessModelClassifier.classify({
      name: "Precision Valves Ltd",
      category: "Industrial Machinery Manufacturing",
      domain: "precisionvalves.com",
    });
    const customerJourney = CustomerJourneyDetector.detect({
      name: "Precision Valves Ltd",
      category: "Industrial Machinery Manufacturing",
    });

    const input: QualificationInput = {
      name: "Precision Valves Ltd",
      category: "Industrial Machinery Manufacturing",
      businessModel,
      customerJourney,
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 1100,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
      googleEvidence: {
        status: "VERIFIED",
        placeId: "place_ind",
        googleMapsUrl: "https://maps.google.com/?cid=ind",
        rating: 4.3,
        reviewCount: 25,
        source: "GOOGLE_PLACES",
        retrievedAt: new Date().toISOString(),
      },
      opportunityAssessment: {
        opportunityType: "UNKNOWN",
        relevance: "LOW",
        confidence: 0.8,
        evidence: [],
        reasoning: "Industrial catalog functional",
        coreAngle: "B2B catalog",
        suggestedScope: "Catalog maintenance",
      },
    };

    const res = QualificationEngine.evaluate(input);
    expect(res.disposition).toBe("NOT_A_FIT");
    expect(res.outreachAllowed).toBe(false);
  });

  it("Fixture 6: Unknown Entity / Ambiguous Signals -> INSUFFICIENT_EVIDENCE (R6)", () => {
    const businessModel = BusinessModelClassifier.classify({
      name: "Mystic Holding Co",
      category: "Holding Entity",
    });
    const customerJourney = CustomerJourneyDetector.detect({
      name: "Mystic Holding Co",
      category: "Holding Entity",
    });

    const input: QualificationInput = {
      name: "Mystic Holding Co",
      category: "Holding Entity",
      businessModel,
      customerJourney,
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 900,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
      googleEvidence: {
        status: "NOT_VERIFIED",
        placeId: null,
        googleMapsUrl: null,
        rating: null,
        reviewCount: null,
        source: "NONE",
        retrievedAt: new Date().toISOString(),
      },
      opportunityAssessment: {
        opportunityType: "UNKNOWN",
        relevance: "LOW",
        confidence: 0.3,
        evidence: [],
        reasoning: "Unknown entity",
        coreAngle: "Maintenance",
        suggestedScope: "General",
      },
    };

    const res = QualificationEngine.evaluate(input);
    expect(res.disposition).toBe("INSUFFICIENT_EVIDENCE");
    expect(res.outreachAllowed).toBe(false);
  });

  it("Fixture 7: High-Volume Clinic with Manual Scheduling -> PURSUE (R7)", () => {
    const businessModel = BusinessModelClassifier.classify({
      name: "City Prime Eye Hospital",
      category: "Eye Hospital",
    });
    const customerJourney = CustomerJourneyDetector.detect({
      name: "City Prime Eye Hospital",
      category: "Eye Hospital",
      hasWhatsApp: true,
      hasClickToCall: true,
    });

    const input: QualificationInput = {
      name: "City Prime Eye Hospital",
      category: "Eye Hospital",
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
        hasInteractiveBookingForm: false, // Manual intake only!
        findings: [],
      },
      googleEvidence: {
        status: "VERIFIED",
        placeId: "place_hosp",
        googleMapsUrl: "https://maps.google.com/?cid=hosp",
        rating: 4.8,
        reviewCount: 340, // High volume (>200)
        source: "GOOGLE_PLACES",
        retrievedAt: new Date().toISOString(),
      },
      opportunityAssessment: {
        opportunityType: "CUSTOM_OPERATIONAL_SOFTWARE",
        relevance: "HIGH",
        confidence: 0.9,
        evidence: [],
        reasoning: "High volume clinic with manual intake bottlenecks",
        coreAngle: "Custom Clinic Ops Automation",
        suggestedScope: "Doctor schedule & intake CRM",
      },
    };

    const res = QualificationEngine.evaluate(input);
    expect(res.disposition).toBe("PURSUE");
    expect(res.outreachAllowed).toBe(true);
    expect(res.opportunityFitScore).toBe(90);
  });

  it("Fixture 8: Functional Site with Minor Opportunities -> NURTURE (R11/R12)", () => {
    const businessModel = BusinessModelClassifier.classify({
      name: "Modern Law Chambers",
      category: "Law Firm",
    });
    const customerJourney = CustomerJourneyDetector.detect({
      name: "Modern Law Chambers",
      category: "Law Firm",
      hasClickToCall: true,
      hasWhatsApp: true,
      hasInteractiveBooking: true,
    });

    const input: QualificationInput = {
      name: "Modern Law Chambers",
      category: "Law Firm",
      businessModel,
      customerJourney,
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 950,
        hasDirectClickToCall: true,
        hasWhatsAppDirectLink: true,
        hasInteractiveBookingForm: true,
        findings: [],
      },
      googleEvidence: {
        status: "VERIFIED",
        placeId: "place_law",
        googleMapsUrl: "https://maps.google.com/?cid=law",
        rating: 4.7,
        reviewCount: 80,
        source: "GOOGLE_PLACES",
        retrievedAt: new Date().toISOString(),
      },
      opportunityAssessment: {
        opportunityType: "WEBSITE",
        relevance: "LOW",
        confidence: 0.5,
        evidence: [],
        reasoning: "Functional site",
        coreAngle: "SEO optimization",
        suggestedScope: "Content & SEO",
      },
    };

    const res = QualificationEngine.evaluate(input);
    expect(res.disposition).toBe("NURTURE");
    expect(res.outreachAllowed).toBe(false);
  });
});
