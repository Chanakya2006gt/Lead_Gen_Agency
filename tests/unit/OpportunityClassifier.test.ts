import { describe, it, expect } from "vitest";
import { OpportunityClassifier } from "@/features/qualification/OpportunityClassifier";

describe("OpportunityClassifier (Operational Multi-Tier Classification)", () => {
  it("Classifies NO WEBSITE as WEBSITE opportunity", () => {
    const opp = OpportunityClassifier.classify({
      hasWebsite: false,
      reviewCount: 300,
      rating: 4.8,
      auditTelemetry: null,
    });
    expect(opp).toBe("WEBSITE");
  });

  it("Classifies high volume businesses with WhatsApp reliance as CUSTOM_OPERATIONAL_SOFTWARE", () => {
    const opp = OpportunityClassifier.classify({
      hasWebsite: true,
      reviewCount: 450,
      rating: 4.9,
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 500,
        hasDirectClickToCall: true,
        hasWhatsAppDirectLink: true, // WhatsApp reliance
        hasInteractiveBookingForm: false, // Missing automated booking
        findings: [],
      },
    });
    expect(opp).toBe("CUSTOM_OPERATIONAL_SOFTWARE");
  });

  it("Classifies modern sites missing booking forms as WEBSITE_AUTOMATION", () => {
    const opp = OpportunityClassifier.classify({
      hasWebsite: true,
      reviewCount: 90,
      rating: 4.5,
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 500,
        hasDirectClickToCall: true,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: false,
        findings: [],
      },
    });
    expect(opp).toBe("WEBSITE_AUTOMATION");
  });
});
