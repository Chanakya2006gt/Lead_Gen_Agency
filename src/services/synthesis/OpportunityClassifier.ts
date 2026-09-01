import { OpportunityType, AuditTelemetry } from "@/db/schema";

export class OpportunityClassifier {
  public static classify(
    hasWebsite: boolean,
    telemetry?: AuditTelemetry | null,
    category?: string | null
  ): {
    type: OpportunityType;
    operationalSignals: string[];
  } {
    const signals: string[] = [];
    const catLower = (category || "").toLowerCase();

    // 1. Binary No Website -> Core Website Build Opportunity
    if (!hasWebsite) {
      signals.push("Zero digital presence / No verified website on Google Business Profile");
      signals.push("Losing high-intent mobile search traffic to competitors with online hubs");
      return {
        type: "WEBSITE",
        operationalSignals: signals,
      };
    }

    if (!telemetry) {
      return {
        type: "UNKNOWN",
        operationalSignals: ["Pending full DOM & UX telemetry audit"],
      };
    }

    // 2. Custom Operational Software Indicators
    if (telemetry.hasWhatsAppCta) {
      signals.push("Heavy reliance on manual WhatsApp chats for quotation, pricing, and intake");
      signals.push("High operational friction: Manual estimate dispatch and untracked conversation threads");
    }

    const isHighQuotationNiche =
      catLower.includes("custom") ||
      catLower.includes("fabrication") ||
      catLower.includes("roofing") ||
      catLower.includes("contractor") ||
      catLower.includes("solar") ||
      catLower.includes("remodel");

    if (telemetry.hasWhatsAppCta || (isHighQuotationNiche && telemetry.hasEnquiryOrBookingForm)) {
      signals.push("Opportunity for automated RFQ quotation builder, deposit stage-locking, or CRM pipeline");
      return {
        type: "CUSTOM_OPERATIONAL_SOFTWARE",
        operationalSignals: signals,
      };
    }

    // 3. Website + Automation (Booking / Scheduling / Intake)
    if (!telemetry.hasEnquiryOrBookingForm) {
      signals.push("No automated 24/7 calendar booking or digital intake system");
      signals.push("Requires front-desk staff to manually answer phone calls for appointments");
    }

    if (!telemetry.hasMobileViewport || telemetry.hasHorizontalScroll) {
      signals.push("Mobile layout is broken or unoptimized for touch navigation");
      return {
        type: "WEBSITE",
        operationalSignals: signals,
      };
    }

    if (!telemetry.hasEnquiryOrBookingForm || !telemetry.hasPhoneCta) {
      return {
        type: "WEBSITE_AUTOMATION",
        operationalSignals: signals,
      };
    }

    return {
      type: "WEBSITE_AUTOMATION",
      operationalSignals: ["Optimization of conversion journey and automated customer onboarding"],
    };
  }
}
