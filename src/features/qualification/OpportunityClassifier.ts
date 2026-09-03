import { AuditTelemetry, OpportunityType } from "@/core/db/schema";
import { BusinessModelClassifier } from "@/features/commercial/BusinessModelClassifier";

export interface ClassifierInputs {
  hasWebsite: boolean;
  isGbpDisconnected?: boolean;
  reviewCount?: number | null;
  rating?: number | null;
  auditTelemetry?: AuditTelemetry | null;
  category?: string;
  name?: string;
  domain?: string;
  websiteTextSnippet?: string | null;
}

export class OpportunityClassifier {
  public static classify(inputs: ClassifierInputs): OpportunityType {
    const { hasWebsite, isGbpDisconnected, reviewCount, auditTelemetry } = inputs;

    // 1. Establish Business Model Context & Workflow Relevance
    const classification = BusinessModelClassifier.classify({
      name: inputs.name || "",
      category: inputs.category,
      domain: inputs.domain,
      findings: auditTelemetry?.findings || [],
      websiteTextSnippet: inputs.websiteTextSnippet,
    });

    const { model, relevantWorkflows } = classification;

    // 2. Disconnected Google Business Profile (Relevant for all local/operating entities except global SaaS)
    if (isGbpDisconnected) {
      if (model !== "B2B_SAAS_TECH") {
        return "DISCONNECTED_GBP_WEBSITE";
      }
    }

    // 3. Zero Website
    if (!hasWebsite || !auditTelemetry) {
      return "WEBSITE";
    }

    // 4. Critical Technical Failures (Always universally relevant across all models)
    if (!auditTelemetry.viewportMetaPresent || auditTelemetry.hasHorizontalOverflow || !auditTelemetry.hasSsl) {
      return "WEBSITE";
    }

    // 5. Custom Software Opportunities (High volume with observed WhatsApp traffic or scheduling bottlenecks)
    const hasHighVolume = typeof reviewCount === "number" && reviewCount !== null && reviewCount >= 250;

    if (hasHighVolume) {
      if (auditTelemetry.hasWhatsAppDirectLink) {
        return "CUSTOM_OPERATIONAL_SOFTWARE";
      }
      if (relevantWorkflows.appointmentBooking && !auditTelemetry.hasInteractiveBookingForm) {
        return "CUSTOM_OPERATIONAL_SOFTWARE";
      }
      if (model === "B2B_SAAS_TECH" || model === "B2B_INDUSTRIAL_MANUFACTURING") {
        return "CUSTOM_OPERATIONAL_SOFTWARE";
      }
    }

    // 6. Workflow Automation (Only when missing capability is relevant to the business model)
    if (model === "LOCAL_APPOINTMENT_SERVICE") {
      if (!auditTelemetry.hasInteractiveBookingForm || !auditTelemetry.hasDirectClickToCall) {
        return "WEBSITE_AUTOMATION";
      }
    } else if (model === "B2B_INDUSTRIAL_MANUFACTURING") {
      return "WEBSITE_AUTOMATION";
    } else if (model === "ECOMMERCE_D2C") {
      return "WEBSITE_AUTOMATION";
    } else if (model === "B2B_SAAS_TECH") {
      return "WEBSITE_AUTOMATION";
    }

    return "WEBSITE_AUTOMATION";
  }
}
