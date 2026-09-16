import { describe, it, expect } from "vitest";
import { FindingWbsEngine } from "@/features/commercial/FindingWbsEngine";

describe("FindingWbsEngine & Dynamic Deliverable Itemization Suite", () => {
  it("Scenario 1: Micro business with 1 minor gap (Missing 1-tap CTA) produces lean scope", () => {
    const result = FindingWbsEngine.itemize({
      hasWebsite: true,
      auditTelemetry: {
        viewportMetaPresent: true,
        hasHorizontalOverflow: false,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 450,
        hasDirectClickToCall: false,
        hasWhatsAppDirectLink: false,
        hasInteractiveBookingForm: true,
        findings: [],
      },
      businessScale: "MICRO",
      relevantWorkflows: {
        whatsAppIntake: true,
        appointmentBooking: false,
      },
      currency: "INR",
      hourlyRate: 1000,
    });

    expect(result.deliverables.length).toBe(1);
    expect(result.deliverables[0].id).toBe("deliv-mobile-intake-cta");
    expect(result.deliverables[0].scaledHours).toBe(4);
    expect(result.wbsFloorPrice).toBe(4000);
    expect(result.wbsCeilingPrice).toBe(5000);
    expect(result.scaleMultiplier).toBe(1.0);
  });

  it("Scenario 2: Professional practice (SMALL_MEDIUM) with broken viewport & missing booking scales dynamically", () => {
    const result = FindingWbsEngine.itemize({
      hasWebsite: true,
      auditTelemetry: {
        viewportMetaPresent: false,
        hasHorizontalOverflow: true,
        hasSsl: true,
        brokenLinksCount: 0,
        jsConsoleErrorsCount: 0,
        initialLoadLatencyMs: 600,
        hasDirectClickToCall: true,
        hasWhatsAppDirectLink: true,
        hasInteractiveBookingForm: false,
        findings: [],
      },
      businessScale: "SMALL_MEDIUM",
      relevantWorkflows: {
        appointmentBooking: true,
        whatsAppIntake: false,
      },
      currency: "INR",
      hourlyRate: 1000,
    });

    // Viewport (16h) + Booking (18h) = 34 base hours * 1.6 = ~54.4 hours
    expect(result.deliverables.length).toBe(2);
    expect(result.scaleMultiplier).toBe(1.6);
    expect(result.totalScaledHours).toBeGreaterThanOrEqual(50);
    expect(result.wbsFloorPrice).toBeGreaterThanOrEqual(50000);
    expect(result.wbsFloorPrice).toBeLessThanOrEqual(60000);
  });

  it("Scenario 3: Large Hospital / Corporate Entity with Zero Website itemizes a 1L+ comprehensive build", () => {
    const result = FindingWbsEngine.itemize({
      hasWebsite: false,
      isGbpDisconnected: false,
      businessScale: "LARGE",
      currency: "INR",
      hourlyRate: 1000,
    });

    expect(result.scaleMultiplier).toBe(3.5);
    expect(result.deliverables.length).toBe(1);
    expect(result.deliverables[0].id).toBe("deliv-storefront-rebuild");
    expect(result.totalScaledHours).toBe(123); // 35 * 3.5 = 122.5 rounded to 123
    expect(result.wbsFloorPrice).toBeGreaterThanOrEqual(120000); // 1.2L+
    expect(result.wbsCeilingPrice).toBeGreaterThanOrEqual(150000);
  });

  it("Scenario 4: Enterprise with Zero Website + Unlinked Google Maps synchronizes a multi-lakh contract", () => {
    const result = FindingWbsEngine.itemize({
      hasWebsite: false,
      isGbpDisconnected: true,
      businessScale: "ENTERPRISE",
      currency: "INR",
      hourlyRate: 1000,
    });

    expect(result.scaleMultiplier).toBe(6.0);
    expect(result.deliverables.length).toBe(2); // Storefront + GBP sync
    // (35 + 8) * 6.0 = 258 hours
    expect(result.totalScaledHours).toBe(258);
    expect(result.wbsFloorPrice).toBe(258000); // 2.58 Lakhs
    expect(result.wbsCeilingPrice).toBeGreaterThanOrEqual(300000); // 3.2 Lakhs
  });

  it("Scenario 5: Healthy site with 0 findings receives baseline conversion care", () => {
    const result = FindingWbsEngine.itemize({
      hasWebsite: true,
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
      businessScale: "MICRO",
      relevantWorkflows: {
        whatsAppIntake: true,
        appointmentBooking: true,
      },
      currency: "INR",
      hourlyRate: 1000,
    });

    expect(result.deliverables.length).toBe(1);
    expect(result.deliverables[0].id).toBe("deliv-continuous-care");
    expect(result.totalScaledHours).toBe(6);
    expect(result.wbsFloorPrice).toBe(6000);
  });
});
