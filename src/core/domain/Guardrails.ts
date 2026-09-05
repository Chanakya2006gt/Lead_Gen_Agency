import { GoogleEvidence, Lead } from "@/core/db/schema";
import { OpportunityAssessment } from "@/features/qualification/OpportunityRelevanceEngine";

export class DomainIntegrityViolationError extends Error {
  constructor(public readonly rule: string, message: string) {
    super(`[DomainIntegrityViolation: ${rule}] ${message}`);
    this.name = "DomainIntegrityViolationError";
  }
}

export class Guardrails {
  /**
   * Asserts that Google metrics (rating/reviewCount) are strictly accompanied by VERIFIED status.
   */
  public static assertVerifiedGoogleEvidence(evidence: GoogleEvidence): void {
    const raw = evidence as any;
    if (evidence.status === "NOT_VERIFIED") {
      if (raw.rating !== null || raw.reviewCount !== null) {
        throw new DomainIntegrityViolationError(
          "UNVERIFIED_EVIDENCE_CONTAINING_METRICS",
          `GoogleEvidence with status 'NOT_VERIFIED' must have null rating and reviewCount, but got rating=${raw.rating}, reviewCount=${raw.reviewCount}`
        );
      }
    } else if (evidence.status === "VERIFIED") {
      if (!evidence.placeId || evidence.placeId.trim().length === 0) {
        throw new DomainIntegrityViolationError(
          "VERIFIED_EVIDENCE_MISSING_PLACE_ID",
          "GoogleEvidence with status 'VERIFIED' must include an authoritative placeId."
        );
      }
    }
  }

  /**
   * Asserts that discovery search query intent has not leaked into factual business category.
   */
  public static assertNoDiscoveryIntentLeakage(category: string | null | undefined, discoveryNiche: string | null | undefined, categorySource: string): void {
    if (categorySource === "DISCOVERY_QUERY") {
      throw new DomainIntegrityViolationError(
        "DISCOVERY_QUERY_AS_CATEGORY",
        `Category source cannot be 'DISCOVERY_QUERY'. Discovery intent must not overwrite factual category.`
      );
    }
  }

  /**
   * Asserts that an outreach claim has authoritative backing.
   */
  public static assertEvidenceBackedClaim(claim: string, evidence: GoogleEvidence): void {
    const mentionsRating = /★|\d\.\d\s*stars?|\b\d+\s*google\s*reviews?\b/i.test(claim);
    if (mentionsRating && evidence.status !== "VERIFIED") {
      throw new DomainIntegrityViolationError(
        "UNSUPPORTED_OUTREACH_CLAIM",
        `Claim contains Google review/reputation assertions ('${claim}') but GoogleEvidence is NOT_VERIFIED.`
      );
    }
  }

  /**
   * Asserts that opportunity relevance was established and is not an unverified default.
   */
  public static assertOpportunityRelevance(assessment: OpportunityAssessment, businessModel: string): void {
    if (assessment.relevance === "UNKNOWN" && assessment.opportunityType !== "UNKNOWN") {
      throw new DomainIntegrityViolationError(
        "UNKNOWN_RELEVANCE_WITH_DEFINITE_OPPORTUNITY",
        `Opportunity assessment with UNKNOWN relevance must have opportunityType 'UNKNOWN', got '${assessment.opportunityType}'.`
      );
    }

    if (businessModel === "B2B_SAAS_TECH" && assessment.suggestedScope.toLowerCase().includes("whatsapp intake engine")) {
      throw new DomainIntegrityViolationError(
        "IRRELEVANT_WORKFLOW_ASSIGNMENT",
        "SaaS business model must not be assigned a WhatsApp patient/consultation intake engine."
      );
    }
  }

  /**
   * Asserts that no synthetic placeholder numbers entered the lead object.
   */
  public static assertNoSyntheticProviderData(lead: Partial<Lead>): void {
    if (lead.rating !== null && lead.rating !== undefined && lead.ratingSource === "UNVERIFIED") {
      throw new DomainIntegrityViolationError(
        "SYNTHETIC_PROVIDER_DATA",
        "Unverified lead cannot contain synthetic rating numbers."
      );
    }
  }
}
