import { PlaywrightAuditEngine } from "./PlaywrightAuditEngine";
import { DossierSynthesizer } from "@/features/synthesis/DossierSynthesizer";
import { BusinessDossier, AuditTelemetry, Lead } from "@/core/db/schema";
import { db } from "@/core/db";
import { leads } from "@/core/db/schema";
import crypto from "crypto";

export interface DirectAuditParams {
  url: string;
  name?: string | null;
  category?: string | null;
  location?: string | null;
  persist?: boolean;
}

export interface DirectAuditResponse {
  lead: Lead;
  dossier: BusinessDossier;
  auditTelemetry: AuditTelemetry;
}

export class DirectAuditService {
  /**
   * SSRF & DNS Pre-Resolution Security Boundary
   */
  public static async validateUrlSecurity(targetUrl: string): Promise<string> {
    return PlaywrightAuditEngine.validateUrlSecurity(targetUrl, false);
  }

  /**
   * Execute Direct Single-Site Teardown
   */
  public static async executeDirectTeardown(params: DirectAuditParams): Promise<DirectAuditResponse> {
    const validatedUrl = await this.validateUrlSecurity(params.url);
    const domainName = new URL(validatedUrl).hostname.replace(/^www\./, "");
    const businessName = params.name?.trim() || domainName.split(".")[0].toUpperCase();
    const category = params.category?.trim() || "Local Business";
    const location = params.location?.trim() || "India";

    // 1. Live Playwright Dual-Viewport Audit
    const auditEngine = new PlaywrightAuditEngine();
    let auditTelemetry: AuditTelemetry;
    try {
      auditTelemetry = await auditEngine.auditUrl(validatedUrl, false);
    } finally {
      await auditEngine.close();
    }

    // 2. Synthesize Commercial Profile & Sales Intelligence Dossier
    const dossier = await DossierSynthesizer.synthesize({
      name: businessName,
      category,
      rating: 4.8, // Default strong market baseline for direct ad-hoc inspection
      reviewCount: 120,
      reviewTrend: "GROWING",
      hasWebsite: true,
      websiteUrl: validatedUrl,
      formattedAddress: location,
      auditTelemetry,
    });

    // 3. Construct In-Memory / Ephemeral Lead Object
    const now = new Date().toISOString();
    const leadId = `direct_${crypto.randomBytes(6).toString("hex")}`;
    const placeId = `direct_place_${crypto.randomBytes(8).toString("hex")}`;

    const lead: Lead = {
      id: leadId,
      scanId: null,
      placeId,
      name: businessName,
      category,
      formattedAddress: location,
      phone: null,
      googleMapsUrl: null,
      hasWebsite: true,
      hasGbpWebsiteLink: true,
      isGbpDisconnected: false,
      websiteUrl: validatedUrl,
      gbpWebsiteUrl: validatedUrl,
      unlinkedWebsiteUrl: null,
      rating: 4.8,
      reviewCount: 120,
      previousRating: null,
      previousReviewCount: null,
      lastReviewDate: null,
      reviewsLast30Days: null,
      reviewsLast90Days: null,
      reviewsLast180Days: null,
      reviewTrend: "GROWING",
      auditStatus: "COMPLETED",
      auditTelemetry,
      reputationScore: dossier.reputationScore,
      digitalGapScore: dossier.digitalGapScore,
      opportunityScore: dossier.opportunityScore,
      confidenceScore: dossier.confidenceScore,
      commercialFitScore: dossier.commercialProfile?.commercialFitScore ?? 75,
      leadAttractivenessScore: dossier.commercialProfile?.leadAttractivenessScore ?? 70,
      totalLeadScore: dossier.overallLeadScore,
      opportunityType: dossier.opportunityType,
      dossier,
      humanStatus: "NEW",
      firstObservedAt: now,
      lastObservedAt: now,
      observationCount: 1,
      reviewCountDelta: 0,
      ratingDelta: 0,
      identitySource: "direct_audit",
      createdAt: now,
      updatedAt: now,
    };

    // 4. Optional Persistence (if human requested 'Save Lead')
    if (params.persist) {
      try {
        db.insert(leads).values(lead).run();
      } catch (dbErr) {
        console.warn("Direct audit persistence skipped:", dbErr);
      }
    }

    return {
      lead,
      dossier,
      auditTelemetry,
    };
  }
}
