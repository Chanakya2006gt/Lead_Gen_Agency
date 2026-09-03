import { AuditTelemetry, GoogleEvidence, OpportunityType } from "@/core/db/schema";
import { BusinessModelClassification } from "@/features/commercial/BusinessModelClassifier";
import { CustomerJourneyAssessment } from "./CustomerJourneyDetector";
import { OpportunityAssessment } from "./OpportunityRelevanceEngine";
import { CommercialProfile } from "@/features/commercial/types";

export type LeadDisposition =
  | "PURSUE"
  | "LOW_OPPORTUNITY"
  | "NOT_A_FIT"
  | "INSUFFICIENT_EVIDENCE";

export interface QualificationResult {
  disposition: LeadDisposition;
  outreachAllowed: boolean;
  businessQualityScore: number;
  opportunityFitScore: number;
  dispositionReason: string;
  rationale: string;
  qualificationEvidence: { statement: string; provenance: "OBSERVED" | "INFERRED" | "UNKNOWN" }[];
}

export interface QualificationInput {
  name: string;
  category?: string | null;
  businessModel: BusinessModelClassification;
  customerJourney: CustomerJourneyAssessment;
  auditTelemetry?: AuditTelemetry | null;
  googleEvidence?: GoogleEvidence;
  opportunityAssessment: OpportunityAssessment;
  commercialProfile?: CommercialProfile;
}

export class QualificationEngine {
  public static evaluate(input: QualificationInput): QualificationResult {
    const { businessModel, customerJourney, auditTelemetry, googleEvidence, opportunityAssessment } = input;
    const isGoogleVerified = googleEvidence?.status === "VERIFIED";
    const telemetry = auditTelemetry;
    const qualificationEvidence: { statement: string; provenance: "OBSERVED" | "INFERRED" | "UNKNOWN" }[] = [];

    // 1. Compute Independent Business Quality Score (0 - 100)
    let businessQualityScore = 50; // Neutral baseline
    if (isGoogleVerified && typeof googleEvidence.rating === "number" && typeof googleEvidence.reviewCount === "number") {
      const ratingWeight = Math.min(googleEvidence.rating / 5.0, 1.0) * 40;
      const reviewWeight = Math.min(googleEvidence.reviewCount / 200, 1.0) * 40;
      businessQualityScore = Math.round(20 + ratingWeight + reviewWeight);
    } else if (telemetry?.hasSsl && telemetry.viewportMetaPresent) {
      businessQualityScore = 65; // Established digital asset
    }

    // 2. Compute Opportunity Fit Score (0 - 100)
    let opportunityFitScore = 20;

    // A. Clean, functional sites with no real agency problem -> NOT_A_FIT
    const hasCriticalDefect = telemetry ? (!telemetry.viewportMetaPresent || telemetry.hasHorizontalOverflow || !telemetry.hasSsl) : false;
    const hasZeroWebsite = !input.auditTelemetry;
    const hasGbpDisconnect = opportunityAssessment.opportunityType === "DISCONNECTED_GBP_WEBSITE";

    // SaaS / Tech entity qualification rule:
    if (businessModel.model === "B2B_SAAS_TECH") {
      if (!hasCriticalDefect && !hasZeroWebsite && (telemetry?.initialLoadLatencyMs || 0) < 2000) {
        qualificationEvidence.push({
          statement: "Software / SaaS entity operating with responsive web infrastructure and acceptable latency.",
          provenance: "OBSERVED",
        });
        qualificationEvidence.push({
          statement: "Observed telemetry does not establish a commercially viable agency web rebuild problem.",
          provenance: "INFERRED",
        });

        return {
          disposition: "NOT_A_FIT",
          outreachAllowed: false,
          businessQualityScore: Math.max(businessQualityScore, 70),
          opportunityFitScore: 25,
          dispositionReason: "Good business, but no sufficiently evidenced agency opportunity.",
          rationale: "TRELIO / SaaS entity operates with functional web application UI. Missing phone dialer or appointment widgets are not commercial problems for this business model.",
          qualificationEvidence,
        };
      }
    }

    // Industrial manufacturer with functional site -> NOT_A_FIT
    if (businessModel.model === "B2B_INDUSTRIAL_MANUFACTURING") {
      if (!hasCriticalDefect && !hasZeroWebsite && (telemetry?.initialLoadLatencyMs || 0) < 2000) {
        qualificationEvidence.push({
          statement: "Industrial manufacturer operating with functional web presence and no critical layout defects.",
          provenance: "OBSERVED",
        });

        return {
          disposition: "NOT_A_FIT",
          outreachAllowed: false,
          businessQualityScore,
          opportunityFitScore: 30,
          dispositionReason: "Operating business, but lacks high-conviction digital intervention opportunity.",
          rationale: "Industrial entity has established corporate presence without layout failures.",
          qualificationEvidence,
        };
      }
    }

    // Unknown business model with no clear context -> INSUFFICIENT_EVIDENCE
    if (businessModel.model === "UNKNOWN_MODEL" && !hasCriticalDefect && !hasZeroWebsite) {
      qualificationEvidence.push({
        statement: "Business model and customer conversion journey cannot be verified from available evidence.",
        provenance: "UNKNOWN",
      });

      return {
        disposition: "INSUFFICIENT_EVIDENCE",
        outreachAllowed: false,
        businessQualityScore: 40,
        opportunityFitScore: 20,
        dispositionReason: "Insufficient business context to establish a commercially relevant agency problem.",
        rationale: "Cannot establish operating model or conversion bottlenecks from current digital signals.",
        qualificationEvidence,
      };
    }

    // B. High-Conviction Opportunities -> PURSUE
    if (hasGbpDisconnect) {
      qualificationEvidence.push({
        statement: "Verified website is disconnected from Google Business Profile, directly suppressing local map-pack ranking.",
        provenance: "OBSERVED",
      });
      return {
        disposition: "PURSUE",
        outreachAllowed: true,
        businessQualityScore,
        opportunityFitScore: 92,
        dispositionReason: "Immediate Google Maps 3-pack reconnection and local SEO recovery opportunity.",
        rationale: "High-conviction organic ranking fix with immediate visible ROI for the client.",
        qualificationEvidence,
      };
    }

    if (hasZeroWebsite) {
      qualificationEvidence.push({
        statement: "Zero official website presence detected on public registry.",
        provenance: "OBSERVED",
      });
      return {
        disposition: "PURSUE",
        outreachAllowed: true,
        businessQualityScore: Math.min(businessQualityScore, 50),
        opportunityFitScore: 95,
        dispositionReason: "Greenfield mobile web presence build opportunity.",
        rationale: "Business has established physical operation but lacks direct digital storefront.",
        qualificationEvidence,
      };
    }

    if (hasCriticalDefect) {
      qualificationEvidence.push({
        statement: "Foundational mobile viewport breakdown or insecure HTTP security warning observed.",
        provenance: "OBSERVED",
      });
      return {
        disposition: "PURSUE",
        outreachAllowed: true,
        businessQualityScore,
        opportunityFitScore: 88,
        dispositionReason: "Critical mobile UX & security vulnerability requiring immediate rebuild.",
        rationale: "Mobile smartphone traffic suffers layout overflow and security deterrent warnings.",
        qualificationEvidence,
      };
    }

    // High volume clinic with manual phone/WhatsApp scheduling -> PURSUE
    if (businessModel.model === "LOCAL_APPOINTMENT_SERVICE") {
      const isHighVolume = isGoogleVerified && typeof googleEvidence.reviewCount === "number" && googleEvidence.reviewCount >= 200;
      if (isHighVolume && !telemetry?.hasInteractiveBookingForm) {
        qualificationEvidence.push({
          statement: "High patient review volume (>200) operating with manual appointment scheduling.",
          provenance: "OBSERVED",
        });
        return {
          disposition: "PURSUE",
          outreachAllowed: true,
          businessQualityScore: 85,
          opportunityFitScore: 90,
          dispositionReason: "Clinic operational software & automated calendar intake opportunity.",
          rationale: "High customer demand constrained by manual scheduling bottlenecks.",
          qualificationEvidence,
        };
      }

      if (!telemetry?.hasInteractiveBookingForm || (!telemetry?.hasDirectClickToCall && !telemetry?.hasWhatsAppDirectLink)) {
        qualificationEvidence.push({
          statement: "Local clinic website missing direct 1-tap booking or WhatsApp consultation channel.",
          provenance: "OBSERVED",
        });
        return {
          disposition: "PURSUE",
          outreachAllowed: true,
          businessQualityScore,
          opportunityFitScore: 80,
          dispositionReason: "Mobile consultation booking & 1-tap intake conversion automation.",
          rationale: "Appointment-driven business will directly benefit from mobile-first intake automation.",
          qualificationEvidence,
        };
      }
    }

    // Default: Functional site with minor opportunities -> LOW_OPPORTUNITY
    qualificationEvidence.push({
      statement: "Website is functional with minor or cosmetic maintenance opportunities only.",
      provenance: "OBSERVED",
    });

    return {
      disposition: "LOW_OPPORTUNITY",
      outreachAllowed: false,
      businessQualityScore,
      opportunityFitScore: 35,
      dispositionReason: "Minor technical maintenance only; does not meet commercial pursuit threshold.",
      rationale: "Site is operational and does not present high-value revenue bottlenecks.",
      qualificationEvidence,
    };
  }
}
