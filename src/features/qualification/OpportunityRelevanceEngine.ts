import { AuditTelemetry, OpportunityType, GoogleEvidence } from "@/core/db/schema";
import { BusinessModelType, BusinessModelClassification } from "@/features/commercial/BusinessModelClassifier";
import { MarketContextResult } from "@/features/commercial/MarketContext";

export interface OpportunityEvidence {
  statement: string;
  provenance: "OBSERVED" | "INFERRED" | "UNKNOWN";
}

export interface OpportunityAssessment {
  opportunityType: OpportunityType;
  relevance: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  confidence: number;
  evidence: OpportunityEvidence[];
  reasoning: string;
  coreAngle: string;
  suggestedScope: string;
}

export interface OpportunityRelevanceInput {
  name: string;
  category?: string | null;
  businessModel: BusinessModelClassification;
  hasWebsite: boolean;
  isGbpDisconnected?: boolean;
  unlinkedWebsiteUrl?: string | null;
  websiteUrl?: string | null;
  auditTelemetry?: AuditTelemetry | null;
  googleEvidence?: GoogleEvidence;
  marketContext?: MarketContextResult;
}

export class OpportunityRelevanceEngine {
  public static evaluate(input: OpportunityRelevanceInput): OpportunityAssessment {
    const { model, relevantWorkflows } = input.businessModel;
    const telemetry = input.auditTelemetry;
    const isGoogleVerified = input.googleEvidence?.status === "VERIFIED";
    const evidence: OpportunityEvidence[] = [];

    // Rule 1: Disconnected Google Business Profile (Only valid if GBP/Local 3-Pack is relevant to business model)
    if (input.isGbpDisconnected) {
      if (model === "B2B_SAAS_TECH") {
        // Global SaaS does not rely on local Google Maps 3-pack
        return {
          opportunityType: "UNKNOWN",
          relevance: "LOW",
          confidence: 0.9,
          evidence: [
            {
              statement: "Google Maps disconnection observed, but local GBP rank is not a revenue-critical acquisition channel for global SaaS products.",
              provenance: "OBSERVED",
            },
          ],
          reasoning: "Global SaaS acquisition is product-led or inbound/organic search driven, not local Google Maps 3-pack.",
          coreAngle: `Upgrading SaaS product onboarding, mobile responsive web UI, and developer portal performance for ${input.name}.`,
          suggestedScope: "1. High-Performance Web App UI. 2. Interactive Product Demo Funnel. 3. SSL Hardening & Speed Optimization.",
        };
      }

      evidence.push({
        statement: `Official website (${input.unlinkedWebsiteUrl || "domain"}) exists online but is disconnected from Google Maps profile.`,
        provenance: "OBSERVED",
      });
      evidence.push({
        statement: "Suppresses Google Maps 3-pack local search visibility for high-intent local clients.",
        provenance: "INFERRED",
      });

      const domainDisplay = input.unlinkedWebsiteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "official website";

      return {
        opportunityType: "DISCONNECTED_GBP_WEBSITE",
        relevance: "HIGH",
        confidence: 0.95,
        evidence,
        reasoning: "Verified website exists online but local Google Maps profile has no website link, directly suppressing local map-pack traffic.",
        coreAngle: `Reconnecting your active website (${domainDisplay}) to your Google Maps profile to recover local 3-pack search ranking for ${input.name}.`,
        suggestedScope: "1. Google Business Profile Synchronization. 2. Local Schema Integration. 3. Mobile Consultation Intake.",
      };
    }

    // Rule 2: Zero Website Presence
    if (!input.hasWebsite || !telemetry) {
      evidence.push({
        statement: "Zero official website presence detected.",
        provenance: "OBSERVED",
      });

      if (model === "UNKNOWN_MODEL") {
        return {
          opportunityType: "WEBSITE",
          relevance: "MEDIUM",
          confidence: 0.7,
          evidence,
          reasoning: "Business has no digital web storefront.",
          coreAngle: `Launching an official mobile-first digital web presence for ${input.name}.`,
          suggestedScope: "1. Mobile-First Web Architecture. 2. Essential Services & Contact Directory. 3. SSL Security Setup.",
        };
      }

      return {
        opportunityType: "WEBSITE",
        relevance: "HIGH",
        confidence: 0.9,
        evidence,
        reasoning: `Business has zero official website presence, forcing all potential ${model.replace(/_/g, " ").toLowerCase()} customers to contact via offline channels only.`,
        coreAngle: `Launching a high-converting digital presence for ${input.name} to capture high-intent search traffic.`,
        suggestedScope: "1. Mobile-First Responsive Storefront. 2. Service & Product Catalog. 3. Direct Digital Lead Capture.",
      };
    }

    // Rule 3: Critical Structural UX / Viewport / SSL Failures (Universally Relevant)
    const hasCriticalDefect = !telemetry.viewportMetaPresent || telemetry.hasHorizontalOverflow || !telemetry.hasSsl;
    if (hasCriticalDefect) {
      if (!telemetry.hasSsl) {
        evidence.push({
          statement: "Missing SSL certificate: Browsers flag site with 'Not Secure' warning.",
          provenance: "OBSERVED",
        });
      }
      if (!telemetry.viewportMetaPresent || telemetry.hasHorizontalOverflow) {
        evidence.push({
          statement: "Mobile viewport tag missing or horizontal layout overflow disrupts smartphone viewing.",
          provenance: "OBSERVED",
        });
      }

      return {
        opportunityType: "WEBSITE",
        relevance: "HIGH",
        confidence: 0.95,
        evidence,
        reasoning: "Site has foundational technical defects (broken viewport or insecure HTTP) that trigger high bounce rates across all traffic.",
        coreAngle: `Fixing mobile layout overflow and upgrading web security for ${input.name}.`,
        suggestedScope: "1. Responsive Mobile Viewport Re-engineering. 2. SSL HTTPS Hardening. 3. Fast Page Load Optimization.",
      };
    }

    // Rule 4: Model-Specific Workflow Relevance Assessment

    // A. B2B SaaS / Developer Tools
    if (model === "B2B_SAAS_TECH") {
      const isSlow = telemetry.initialLoadLatencyMs > 2000;
      if (isSlow) {
        evidence.push({
          statement: `Initial server latency (${telemetry.initialLoadLatencyMs}ms) exceeds speed benchmarks for SaaS landing pages.`,
          provenance: "OBSERVED",
        });
      }
      return {
        opportunityType: "WEBSITE_AUTOMATION",
        relevance: isSlow ? "HIGH" : "MEDIUM",
        confidence: 0.85,
        evidence,
        reasoning: "SaaS growth requires high-speed page loads, responsive interactive demo components, and frictionless signup onboarding.",
        coreAngle: `Upgrading SaaS product onboarding, mobile responsive web UI, and speed performance for ${input.name}.`,
        suggestedScope: "1. High-Performance Web App UI. 2. Interactive Product Demo & Lead Capture Funnel. 3. Speed Acceleration (<1.0s).",
      };
    }

    // B. E-Commerce / D2C Storefronts
    if (model === "ECOMMERCE_D2C") {
      const isSlow = telemetry.initialLoadLatencyMs > 2000;
      return {
        opportunityType: "WEBSITE_AUTOMATION",
        relevance: isSlow ? "HIGH" : "MEDIUM",
        confidence: 0.85,
        evidence,
        reasoning: "E-Commerce conversions require frictionless mobile navigation, fast catalog browsing, and seamless checkout pipelines.",
        coreAngle: `Optimizing mobile storefront conversion, checkout speed, and product discoverability for ${input.name}.`,
        suggestedScope: "1. Mobile-First Storefront & Navigation Rebuild. 2. Frictionless Mobile Checkout Funnel. 3. Fast Page Load Optimization.",
      };
    }

    // C. B2B Industrial Manufacturing / Wholesale
    if (model === "B2B_INDUSTRIAL_MANUFACTURING") {
      return {
        opportunityType: "WEBSITE_AUTOMATION",
        relevance: "HIGH",
        confidence: 0.85,
        evidence,
        reasoning: "Industrial manufacturers require structured technical product specification downloads and digital Request-for-Quote (RFQ) pipelines.",
        coreAngle: `Modernizing technical product catalog and digital Request-for-Quote (RFQ) pipeline for ${input.name}.`,
        suggestedScope: "1. Industrial Product Catalog & Spec Architecture. 2. Digital Request-for-Quote (RFQ) Multi-Step Funnel. 3. Corporate Trust Showcase.",
      };
    }

    // D. Local Healthcare / Appointment Services (Clinics, Salons, Spas, Auto Repair)
    if (model === "LOCAL_APPOINTMENT_SERVICE") {
      const missingBooking = !telemetry.hasInteractiveBookingForm;
      const missingCallOrWhatsapp = !telemetry.hasDirectClickToCall && !telemetry.hasWhatsAppDirectLink;

      if (missingBooking) {
        evidence.push({
          statement: "No 24/7 online scheduling calendar or interactive appointment booking intake detected.",
          provenance: "OBSERVED",
        });
      }
      if (missingCallOrWhatsapp) {
        evidence.push({
          statement: "Missing direct 1-tap call or WhatsApp consultation trigger on mobile view.",
          provenance: "OBSERVED",
        });
      }

      const isHighVolume = isGoogleVerified && typeof input.googleEvidence?.reviewCount === "number" && input.googleEvidence.reviewCount >= 250;

      if (isHighVolume && (telemetry.hasWhatsAppDirectLink || missingBooking)) {
        return {
          opportunityType: "CUSTOM_OPERATIONAL_SOFTWARE",
          relevance: "HIGH",
          confidence: 0.9,
          evidence,
          reasoning: "High-volume clinic operating with fragmented phone/WhatsApp inquiries will benefit from automated multi-staff scheduling and patient records portal.",
          coreAngle: `Automating patient scheduling, WhatsApp intake, and clinic management for ${input.name}.`,
          suggestedScope: "1. Multi-Staff Calendar & WhatsApp Intake Engine. 2. Automated Patient Reminders & Service Records Portal. 3. Staff Operations Dashboard.",
        };
      }

      return {
        opportunityType: "WEBSITE_AUTOMATION",
        relevance: missingBooking || missingCallOrWhatsapp ? "HIGH" : "MEDIUM",
        confidence: 0.9,
        evidence,
        reasoning: "Local appointment service operates on smartphone search traffic where 1-tap WhatsApp consultation and instant scheduling drive new patient volume.",
        coreAngle: `Upgrading mobile speed and adding 1-tap consultation booking for ${input.name}.`,
        suggestedScope: "1. Mobile Viewport & Touch Layout Re-engineering. 2. 24/7 WhatsApp & Online Booking Funnel. 3. Speed Acceleration (<1.5s).",
      };
    }

    // E. High-Trust Professional Practices (Law, Accounting, Architecture)
    if (model === "PROFESSIONAL_HIGH_TRUST") {
      const missingBooking = !telemetry.hasInteractiveBookingForm;
      if (missingBooking) {
        evidence.push({
          statement: "No confidential client consultation intake or calendar scheduling funnel detected.",
          provenance: "OBSERVED",
        });
      }

      return {
        opportunityType: "WEBSITE_AUTOMATION",
        relevance: "HIGH",
        confidence: 0.85,
        evidence,
        reasoning: "Professional firms require secure client intake workflows, partner credential showcases, and fast response mechanisms.",
        coreAngle: `Upgrading confidential client intake, partner credential presentation, and mobile security for ${input.name}.`,
        suggestedScope: "1. Secure Confidential Client Intake Portal. 2. Practice Area & Credentials Showcase. 3. Mobile Viewport & Speed Acceleration.",
      };
    }

    // F. Hospitality & Dining (Restaurants, Bistros, Cafes)
    if (model === "HOSPITALITY_RESTAURANT") {
      return {
        opportunityType: "WEBSITE_AUTOMATION",
        relevance: "HIGH",
        confidence: 0.85,
        evidence,
        reasoning: "Hospitality venues rely on mobile visitors discovering menus, table reservations, and directions directly on smartphone browsers.",
        coreAngle: `Upgrading digital menu navigation, 1-tap WhatsApp reservations, and Google Maps discoverability for ${input.name}.`,
        suggestedScope: "1. Mobile Digital Menu & Visual Showcase. 2. 1-Tap Table Reservation & WhatsApp Orders. 3. Local Business Schema & Speed Acceleration.",
      };
    }

    // F. Unknown Model — FAIL CLOSED
    evidence.push({
      statement: "No domain-specific workflow gaps observed.",
      provenance: "OBSERVED",
    });

    return {
      opportunityType: "UNKNOWN",
      relevance: "UNKNOWN",
      confidence: 0.3,
      evidence,
      reasoning: "Insufficient evidence to establish commercial opportunity relevance for this entity.",
      coreAngle: `Upgrading web performance, responsive mobile layout, and digital trust security for ${input.name}.`,
      suggestedScope: "1. Mobile Viewport & Responsive Layout Hardening. 2. SSL Security & HTTPS Enforcement. 3. Performance & Load Speed Acceleration.",
    };
  }
}
