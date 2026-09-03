export type BusinessModelType =
  | "LOCAL_APPOINTMENT_SERVICE"
  | "B2B_SAAS_TECH"
  | "ECOMMERCE_D2C"
  | "B2B_INDUSTRIAL_MANUFACTURING"
  | "HOSPITALITY_RESTAURANT"
  | "PROFESSIONAL_HIGH_TRUST"
  | "UNKNOWN_MODEL";

export interface BusinessModelEvidence {
  signal: string;
  source: "CATEGORY" | "WEBSITE_TEXT" | "FINDINGS" | "DOMAIN";
  confidence: number;
}

export interface BusinessModelClassification {
  model: BusinessModelType;
  confidence: number;
  evidence: BusinessModelEvidence[];
  relevantWorkflows: {
    whatsAppIntake: boolean;
    appointmentBooking: boolean;
    ecommerceCart: boolean;
    rfqQuoteForm: boolean;
    saasDemoOrSignup: boolean;
    localGbpSync: boolean;
    mobileViewport: boolean;
    sslSecurity: boolean;
  };
}

export interface BusinessModelInput {
  name: string;
  category?: string | null;
  domain?: string | null;
  findings?: any[];
  websiteTextSnippet?: string | null;
}

export class BusinessModelClassifier {
  public static classify(input: BusinessModelInput): BusinessModelClassification {
    const nameLower = (input.name || "").toLowerCase();
    const categoryLower = (input.category || "").toLowerCase();
    const domainLower = (input.domain || "").toLowerCase();
    const textLower = (input.websiteTextSnippet || "").toLowerCase();
    const findingsText = (input.findings || []).map(f => `${f.finding} ${f.evidence}`).join(" ").toLowerCase();

    const evidence: BusinessModelEvidence[] = [];

    // 1. SaaS / Tech Software Platforms
    const isSaaSOrTech =
      /software|saas|tech|cloud|platform|developer|api|solutions pvt|it services|analytics|app development/.test(categoryLower) ||
      /software|tech|solutions|systems|digital|cloud|labs|dev|io|ai\b/.test(domainLower) ||
      /sign up|free trial|login|dashboard|api docs|pricing plan|get started|demo/.test(textLower);

    if (isSaaSOrTech && !/dental|clinic|hospital|doctor|patient/.test(categoryLower + nameLower)) {
      evidence.push({
        signal: "Software, technology platform, or developer digital infrastructure detected.",
        source: "CATEGORY",
        confidence: 0.85,
      });

      return {
        model: "B2B_SAAS_TECH",
        confidence: 0.85,
        evidence,
        relevantWorkflows: {
          whatsAppIntake: false, // SaaS does not standardly use WhatsApp 1-tap popup
          appointmentBooking: false, // SaaS uses product sign-up or demo request, not patient appointment calendar
          ecommerceCart: false,
          rfqQuoteForm: false,
          saasDemoOrSignup: true,
          localGbpSync: false, // SaaS serves global/online users, not local Maps 3-pack
          mobileViewport: true,
          sslSecurity: true,
        },
      };
    }

    // 2. E-Commerce / D2C Online Retail
    const isEcommerce =
      /ecommerce|e-commerce|online store|retail store|shop|apparel|clothing|cosmetics|footwear|products/.test(categoryLower) ||
      /cart|checkout|add to cart|buy now|shipping policy|products|order tracking/.test(textLower);

    if (isEcommerce) {
      evidence.push({
        signal: "E-Commerce or Direct-to-Consumer shopping cart infrastructure detected.",
        source: "WEBSITE_TEXT",
        confidence: 0.85,
      });

      return {
        model: "ECOMMERCE_D2C",
        confidence: 0.85,
        evidence,
        relevantWorkflows: {
          whatsAppIntake: false,
          appointmentBooking: false,
          ecommerceCart: true,
          rfqQuoteForm: false,
          saasDemoOrSignup: false,
          localGbpSync: false,
          mobileViewport: true,
          sslSecurity: true,
        },
      };
    }

    // 3. B2B Industrial Manufacturing / Heavy Industry
    const isIndustrial =
      /manufacturing|manufacturer|industrial|steel|engineering|textiles|chemical|machinery|supplier|exporter|distributor|wholesale/.test(categoryLower) ||
      /industries|manufacturing|engg|works|fab/.test(nameLower) ||
      /request for quote|rfq|specifications|catalog download|bulk orders|export enquiry/.test(textLower);

    if (isIndustrial) {
      evidence.push({
        signal: "Industrial manufacturing, heavy industry, or wholesale supplier workflow detected.",
        source: "CATEGORY",
        confidence: 0.85,
      });

      return {
        model: "B2B_INDUSTRIAL_MANUFACTURING",
        confidence: 0.85,
        evidence,
        relevantWorkflows: {
          whatsAppIntake: false,
          appointmentBooking: false,
          ecommerceCart: false,
          rfqQuoteForm: true,
          saasDemoOrSignup: false,
          localGbpSync: false,
          mobileViewport: true,
          sslSecurity: true,
        },
      };
    }

    // 4. Hospitality & Dining (Restaurants, Cafes, Bakeries)
    const isHospitality =
      /restaurant|cafe|café|bakery|dining|kitchen|food|bar|bistro|pizzeria|lounge/.test(categoryLower + nameLower) ||
      /menu|dine in|takeaway|table reservation|chef/.test(textLower);

    if (isHospitality) {
      evidence.push({
        signal: "Hospitality, restaurant, or dining service workflow detected.",
        source: "CATEGORY",
        confidence: 0.9,
      });

      return {
        model: "HOSPITALITY_RESTAURANT",
        confidence: 0.9,
        evidence,
        relevantWorkflows: {
          whatsAppIntake: true, // Table booking / direct order via WhatsApp is highly relevant
          appointmentBooking: false, // Table reservation vs medical calendar
          ecommerceCart: false,
          rfqQuoteForm: false,
          saasDemoOrSignup: false,
          localGbpSync: true, // Google Maps 3-pack is critical for dining
          mobileViewport: true,
          sslSecurity: true,
        },
      };
    }

    // 5. Professional High-Trust Services (Law Firms, Accounting, Architecture)
    const isHighTrustProfessional =
      /lawyer|advocate|law firm|attorney|legal|chartered accountant|ca firm|accounting|tax consultant|architect/.test(categoryLower + nameLower) ||
      /practice areas|attorneys|partners|confidential consultation|case evaluation/.test(textLower);

    if (isHighTrustProfessional) {
      evidence.push({
        signal: "Professional high-trust practice (legal/accounting/architecture) workflow detected.",
        source: "CATEGORY",
        confidence: 0.85,
      });

      return {
        model: "PROFESSIONAL_HIGH_TRUST",
        confidence: 0.85,
        evidence,
        relevantWorkflows: {
          whatsAppIntake: false, // Formal confidential intake vs WhatsApp
          appointmentBooking: true, // Confidential consultation scheduling
          ecommerceCart: false,
          rfqQuoteForm: false,
          saasDemoOrSignup: false,
          localGbpSync: true,
          mobileViewport: true,
          sslSecurity: true,
        },
      };
    }

    // 6. Local Appointment & Operating Service (Dental, Medical Clinics, Salons, Spas, Auto Repair, Home Contractors)
    const isLocalAppointment =
      /dental|dentist|clinic|hospital|doctor|physiotherapy|dermatology|salon|spa|beauty|hair|auto repair|car service|automotive|garage|mechanic|plumber|hvac|roofing/.test(categoryLower + nameLower) ||
      /book appointment|consultation|patient|treatments|services|doctor/.test(textLower);

    if (isLocalAppointment) {
      evidence.push({
        signal: "Local appointment-based healthcare, wellness, or trade service workflow detected.",
        source: "CATEGORY",
        confidence: 0.9,
      });

      return {
        model: "LOCAL_APPOINTMENT_SERVICE",
        confidence: 0.9,
        evidence,
        relevantWorkflows: {
          whatsAppIntake: true,
          appointmentBooking: true,
          ecommerceCart: false,
          rfqQuoteForm: false,
          saasDemoOrSignup: false,
          localGbpSync: true,
          mobileViewport: true,
          sslSecurity: true,
        },
      };
    }

    // 7. Unknown Entity — Fail-Closed
    evidence.push({
      signal: "Insufficient category or workflow signals observed to establish business model.",
      source: "CATEGORY",
      confidence: 0.3,
    });

    return {
      model: "UNKNOWN_MODEL",
      confidence: 0.3,
      evidence,
      relevantWorkflows: {
        whatsAppIntake: false,
        appointmentBooking: false,
        ecommerceCart: false,
        rfqQuoteForm: false,
        saasDemoOrSignup: false,
        localGbpSync: false,
        mobileViewport: true, // General web quality always applies
        sslSecurity: true,   // General web quality always applies
      },
    };
  }
}
