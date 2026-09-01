import { describe, it, expect } from "vitest";
import { OpportunityClassifier } from "@/services/synthesis/OpportunityClassifier";

describe("OpportunityClassifier (Operational Software & Gap Tiering)", () => {
  it("Classifies no-website business as WEBSITE tier", () => {
    const result = OpportunityClassifier.classify(false, null, "Dental Clinic");
    expect(result.type).toBe("WEBSITE");
    expect(result.operationalSignals.length).toBeGreaterThan(0);
  });

  it("Classifies WhatsApp-heavy quotation business as CUSTOM_OPERATIONAL_SOFTWARE tier", () => {
    const result = OpportunityClassifier.classify(
      true,
      {
        isHttps: true,
        hasMobileViewport: true,
        hasHorizontalScroll: false,
        domLoadTimeSec: 1.2,
        hasPhoneCta: true,
        hasWhatsAppCta: true,
        hasEnquiryOrBookingForm: true,
        brokenLinksCount: 0,
        jsErrorsCount: 0,
        extractedServices: [],
        findings: [],
      },
      "Custom Roofing & Fabrication"
    );

    expect(result.type).toBe("CUSTOM_OPERATIONAL_SOFTWARE");
    expect(result.operationalSignals.some((s) => s.includes("WhatsApp"))).toBe(true);
  });

  it("Classifies responsive website with missing booking calendar as WEBSITE_AUTOMATION tier", () => {
    const result = OpportunityClassifier.classify(
      true,
      {
        isHttps: true,
        hasMobileViewport: true,
        hasHorizontalScroll: false,
        domLoadTimeSec: 1.1,
        hasPhoneCta: true,
        hasWhatsAppCta: false,
        hasEnquiryOrBookingForm: false, // missing booking
        brokenLinksCount: 0,
        jsErrorsCount: 0,
        extractedServices: [],
        findings: [],
      },
      "Medical & Dermatology Clinic"
    );

    expect(result.type).toBe("WEBSITE_AUTOMATION");
    expect(result.operationalSignals.some((s) => s.includes("24/7 calendar booking"))).toBe(true);
  });
});
