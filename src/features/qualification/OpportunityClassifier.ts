import { AuditTelemetry, OpportunityType } from "@/core/db/schema";

export interface ClassifierInputs {
  hasWebsite: boolean;
  isGbpDisconnected?: boolean;
  reviewCount: number;
  rating: number;
  auditTelemetry?: AuditTelemetry | null;
  category?: string;
}

export class OpportunityClassifier {
  public static classify(inputs: ClassifierInputs): OpportunityType {
    const { hasWebsite, isGbpDisconnected, reviewCount, auditTelemetry } = inputs;

    // Rule 0: Disconnected Official Website -> Google Business Profile Reconnection Opportunity
    if (isGbpDisconnected) {
      return "DISCONNECTED_GBP_WEBSITE";
    }

    // Rule 1: No Website -> Instant Website Opportunity
    if (!hasWebsite || !auditTelemetry) {
      return "WEBSITE";
    }

    // Rule 2: Major structural UX/Viewport failures -> Full Website Rebuild
    if (!auditTelemetry.viewportMetaPresent || auditTelemetry.hasHorizontalOverflow || !auditTelemetry.hasSsl) {
      return "WEBSITE";
    }

    // Rule 3: High Volume Operator (>250 reviews) with WhatsApp or no web scheduling -> Custom Ops Software
    if (reviewCount >= 250 && (auditTelemetry.hasWhatsAppDirectLink || !auditTelemetry.hasInteractiveBookingForm)) {
      return "CUSTOM_OPERATIONAL_SOFTWARE";
    }

    // Rule 4: Modern site but missing interactive intake / direct click-to-call -> Website Automation
    if (!auditTelemetry.hasInteractiveBookingForm || !auditTelemetry.hasDirectClickToCall) {
      return "WEBSITE_AUTOMATION";
    }

    return "WEBSITE_AUTOMATION";
  }
}
