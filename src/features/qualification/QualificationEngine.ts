import { AuditTelemetry, GoogleEvidence, LeadDisposition } from "@/core/db/schema";
import { BusinessModelClassification } from "@/features/commercial/BusinessModelClassifier";
import { CustomerJourneyAssessment } from "./CustomerJourneyDetector";
import { OpportunityAssessment } from "./OpportunityRelevanceEngine";
import { CommercialProfile } from "@/features/commercial/types";
import { ICP_CONSTANTS } from "@/core/domain/Icp";

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
      const reviewWeight = Math.min(googleEvidence.reviewCount / ICP_CONSTANTS.HIGH_VOLUME_REVIEWS, 1.0) * 40;
      businessQualityScore = Math.round(20 + ratingWeight + reviewWeight);
    } else if (telemetry?.hasSsl && telemetry.viewportMetaPresent) {
      businessQualityScore = 65; // Established digital asset
    }

    // 2. Evaluate Ordered Invariant Rules (R1 - R12)
    const hasCriticalDefect = telemetry ? (!telemetry.viewportMetaPresent || telemetry.hasHorizontalOverflow || !telemetry.hasSsl) : false;
    const hasZeroWebsite = !input.auditTelemetry;
    const hasGbpDisconnect = opportunityAssessment.opportunityType === "DISCONNECTED_GBP_WEBSITE";

    // R1: GBP Disconnected Website -> PURSUE
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

    // R2: Greenfield / Zero Website -> PURSUE
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

    // R3: Critical Layout/Security Defect -> PURSUE
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

    // R4: B2B SaaS / Tech entity with functioning site -> NOT_A_FIT
    if (businessModel.model === "B2B_SAAS_TECH") {
      if (!hasCriticalDefect && !hasZeroWebsite && (telemetry?.initialLoadLatencyMs || 0) < ICP_CONSTANTS.SAAS_OK_LATENCY_MS) {
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
          rationale: "SaaS entity operates with functional web application UI. Missing phone dialer or appointment widgets are not commercial problems for this business model.",
          qualificationEvidence,
        };
      }
    }

    // R5: Industrial manufacturer with functional site -> NOT_A_FIT
    if (businessModel.model === "B2B_INDUSTRIAL_MANUFACTURING") {
      if (!hasCriticalDefect && !hasZeroWebsite && (telemetry?.initialLoadLatencyMs || 0) < ICP_CONSTANTS.SAAS_OK_LATENCY_MS) {
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

    // R6: Unknown business model with no clear context -> INSUFFICIENT_EVIDENCE
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

    // R7: High volume appointment service with manual scheduling -> PURSUE
    if (businessModel.model === "LOCAL_APPOINTMENT_SERVICE") {
      const isHighVolume = isGoogleVerified && typeof googleEvidence.reviewCount === "number" && googleEvidence.reviewCount >= ICP_CONSTANTS.HIGH_VOLUME_REVIEWS;
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

      // R8: Appointment service missing direct booking or 1-tap intake -> PURSUE
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

    // R9 - R12: Score-based disposition evaluation
    let opportunityFitScore = 35;
    if (telemetry && !telemetry.hasDirectClickToCall && !telemetry.hasWhatsAppDirectLink) {
      opportunityFitScore = 55;
    }

    qualificationEvidence.push({
      statement: "Website is functional with minor or cosmetic maintenance opportunities only.",
      provenance: "OBSERVED",
    });

    if (opportunityFitScore >= 70) {
      return {
        disposition: "PURSUE",
        outreachAllowed: true,
        businessQualityScore,
        opportunityFitScore,
        dispositionReason: "Substantial conversion gaps identified.",
        rationale: "Site shows distinct opportunities for conversion improvement.",
        qualificationEvidence,
      };
    }

    if (opportunityFitScore >= 50) {
      return {
        disposition: "PURSUE_LOW_TOUCH",
        outreachAllowed: true,
        businessQualityScore,
        opportunityFitScore,
        dispositionReason: "Moderate digital gaps suitable for low-touch or automated outreach.",
        rationale: "Secondary digital opportunities identified.",
        qualificationEvidence,
      };
    }

    return {
      disposition: "NURTURE",
      outreachAllowed: false,
      businessQualityScore,
      opportunityFitScore,
      dispositionReason: "Minor technical maintenance only; does not meet commercial pursuit threshold.",
      rationale: "Site is operational and does not present high-value revenue bottlenecks.",
      qualificationEvidence,
    };
  }
}
