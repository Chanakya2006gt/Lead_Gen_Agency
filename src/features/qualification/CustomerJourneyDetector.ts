export type CustomerJourney =
  | "DISCOVER_CALL"
  | "DISCOVER_WHATSAPP"
  | "DISCOVER_BOOK"
  | "DISCOVER_PURCHASE"
  | "DISCOVER_SIGN_UP"
  | "DISCOVER_REQUEST_QUOTE"
  | "DISCOVER_REQUEST_DEMO"
  | "DISCOVER_CONTACT_SALES"
  | "DISCOVER_VISIT_LOCATION"
  | "UNKNOWN";

export type OperatingContext =
  | "PHONE_DRIVEN"
  | "APPOINTMENT_DRIVEN"
  | "LEAD_RFQ_DRIVEN"
  | "TRANSACTION_DRIVEN"
  | "SIGNUP_DRIVEN"
  | "DEMO_DRIVEN"
  | "WALK_IN_DRIVEN"
  | "UNKNOWN";

export interface CustomerJourneyAssessment {
  journey: CustomerJourney;
  operatingContext: OperatingContext;
  confidence: number;
  evidence: { signal: string; source: "WEBSITE_TEXT" | "STRUCTURED_DATA" | "CATEGORY" | "DOM" }[];
}

export interface CustomerJourneyInput {
  name: string;
  category?: string | null;
  domain?: string | null;
  websiteTextSnippet?: string | null;
  findings?: any[];
  hasInteractiveBooking?: boolean;
  hasWhatsApp?: boolean;
  hasClickToCall?: boolean;
}

export class CustomerJourneyDetector {
  public static detect(input: CustomerJourneyInput): CustomerJourneyAssessment {
    const textLower = (input.websiteTextSnippet || "").toLowerCase();
    const categoryLower = (input.category || "").toLowerCase();
    const nameLower = (input.name || "").toLowerCase();
    const domainLower = (input.domain || "").toLowerCase();

    const evidence: { signal: string; source: "WEBSITE_TEXT" | "STRUCTURED_DATA" | "CATEGORY" | "DOM" }[] = [];

    // 1. SaaS / Product-led Software
    const isSaaSOrSoftware =
      /software|saas|cloud|platform|developer|app development|it services|analytics/.test(categoryLower) ||
      /sign up|free trial|login|dashboard|api docs|get started|book demo|request demo/.test(textLower) ||
      /io\b|ai\b|tech\b|cloud\b|dev\b/.test(domainLower);

    if (isSaaSOrSoftware && !/dental|clinic|hospital|doctor|salon|spa/.test(categoryLower + nameLower)) {
      const isDemo = /request demo|book a demo|schedule demo/.test(textLower);
      evidence.push({
        signal: isDemo ? "Product demo request CTA observed" : "Self-serve SaaS signup / login / app portal observed",
        source: "WEBSITE_TEXT",
      });

      return {
        journey: isDemo ? "DISCOVER_REQUEST_DEMO" : "DISCOVER_SIGN_UP",
        operatingContext: isDemo ? "DEMO_DRIVEN" : "SIGNUP_DRIVEN",
        confidence: 0.85,
        evidence,
      };
    }

    // 2. Industrial Manufacturing / Wholesale RFQ
    const isIndustrial =
      /manufacturing|manufacturer|machinery|industrial|steel|engineering|chemical|supplier|exporter|distributor/.test(categoryLower) ||
      /request for quote|request a quote|rfq|specifications|catalog download|bulk order|enquiry form/.test(textLower);

    if (isIndustrial) {
      evidence.push({
        signal: "Technical specification / Request-for-Quote (RFQ) procurement workflow observed",
        source: "WEBSITE_TEXT",
      });

      return {
        journey: "DISCOVER_REQUEST_QUOTE",
        operatingContext: "LEAD_RFQ_DRIVEN",
        confidence: 0.85,
        evidence,
      };
    }

    // 3. E-Commerce / Online Retail
    const isEcommerce =
      /ecommerce|e-commerce|online store|retail store|shop|clothing|apparel|cosmetics/.test(categoryLower) ||
      /cart|checkout|add to cart|buy now|product catalog|free shipping/.test(textLower);

    if (isEcommerce) {
      evidence.push({
        signal: "Shopping cart & direct checkout transaction funnel observed",
        source: "WEBSITE_TEXT",
      });

      return {
        journey: "DISCOVER_PURCHASE",
        operatingContext: "TRANSACTION_DRIVEN",
        confidence: 0.9,
        evidence,
      };
    }

    // 4. Local Appointment Service (Clinics, Salons, Spas)
    const isAppointment =
      /dental|dentist|clinic|hospital|doctor|physio|salon|spa|wellness|beauty/.test(categoryLower + nameLower) ||
      /book appointment|consultation|book online|patient intake/.test(textLower) ||
      Boolean(input.hasInteractiveBooking);

    if (isAppointment) {
      evidence.push({
        signal: "Patient / client appointment booking or consultation intake workflow observed",
        source: "CATEGORY",
      });

      return {
        journey: "DISCOVER_BOOK",
        operatingContext: "APPOINTMENT_DRIVEN",
        confidence: 0.9,
        evidence,
      };
    }

    // 5. Hospitality & Dining (Restaurants, Bistros, Cafes)
    const isHospitality =
      /restaurant|cafe|café|bakery|dining|kitchen|bistro|pizzeria/.test(categoryLower + nameLower) ||
      /menu|dine in|takeaway|table reservation/.test(textLower);

    if (isHospitality) {
      evidence.push({
        signal: "Physical dining, menu browsing, and table reservation workflow observed",
        source: "CATEGORY",
      });

      return {
        journey: "DISCOVER_VISIT_LOCATION",
        operatingContext: "WALK_IN_DRIVEN",
        confidence: 0.85,
        evidence,
      };
    }

    // 6. Direct Phone / WhatsApp Lead Generation
    if (input.hasWhatsApp) {
      evidence.push({
        signal: "Direct WhatsApp consultation channel active on website",
        source: "DOM",
      });
      return {
        journey: "DISCOVER_WHATSAPP",
        operatingContext: "PHONE_DRIVEN",
        confidence: 0.8,
        evidence,
      };
    }

    if (input.hasClickToCall) {
      evidence.push({
        signal: "Direct 1-tap phone dialer link active on mobile website",
        source: "DOM",
      });
      return {
        journey: "DISCOVER_CALL",
        operatingContext: "PHONE_DRIVEN",
        confidence: 0.75,
        evidence,
      };
    }

    // 7. Unknown Customer Journey
    evidence.push({
      signal: "Insufficient on-page conversion or workflow signals observed",
      source: "WEBSITE_TEXT",
    });

    return {
      journey: "UNKNOWN",
      operatingContext: "UNKNOWN",
      confidence: 0.3,
      evidence,
    };
  }
}
