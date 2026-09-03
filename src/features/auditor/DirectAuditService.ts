import crypto from "crypto";
import { PlaywrightAuditEngine } from "./PlaywrightAuditEngine";
import { DossierSynthesizer } from "@/features/synthesis/DossierSynthesizer";
import { AuditTelemetry, Lead, GoogleEvidence } from "@/core/db/schema";
import { db } from "@/core/db";
import { leads, discoveryScans } from "@/core/db/schema";
import dns from "dns/promises";

export interface DirectAuditParams {
  url: string;
  name?: string | null;
  category?: string | null;
  location?: string | null;
  persist?: boolean;
}

export interface DirectAuditResponse {
  lead: Lead;
  isEphemeral: boolean;
}

export class DirectAuditService {
  /**
   * Deduce category from domain and findings when not explicitly supplied
   */
  private static deduceCategoryFromWebsite(domain: string, findings: any[]): { category: string; confidence: number } {
    const d = domain.toLowerCase();
    const findingsText = findings.map(f => `${f.finding} ${f.evidence}`).join(" ").toLowerCase();

    if (/dent|dental|ortho|tooth|teeth/.test(d) || /dental|dentist|orthodontics/.test(findingsText)) {
      return { category: "Dental Healthcare", confidence: 0.85 };
    }
    if (/clinic|hospital|doctor|physio|derma|health|medical/.test(d) || /clinic|patient|doctor|consultation/.test(findingsText)) {
      return { category: "Medical & Healthcare Clinic", confidence: 0.8 };
    }
    if (/hvac|aircon|ac-repair|cooling|heating/.test(d) || /hvac|heating|air conditioning/.test(findingsText)) {
      return { category: "HVAC & Climate Services", confidence: 0.85 };
    }
    if (/roof|roofing/.test(d) || /roofing|roof repair/.test(findingsText)) {
      return { category: "Roofing Services", confidence: 0.85 };
    }
    if (/salon|beauty|spa|hair|makeup/.test(d) || /salon|hair|styling|spa/.test(findingsText)) {
      return { category: "Beauty & Personal Wellness", confidence: 0.85 };
    }
    if (/tech|soft|solutions|dev|cloud|data|app|systems|digital/.test(d) || /software|saas|solutions|platform|development/.test(findingsText)) {
      return { category: "Technology & Software Services", confidence: 0.8 };
    }
    if (/restaurant|cafe|food|dining|kitchen|bakery/.test(d) || /menu|dining|restaurant|cafe/.test(findingsText)) {
      return { category: "Hospitality & Dining", confidence: 0.85 };
    }

    return { category: "Operating Business", confidence: 0.4 };
  }

  /**
   * Pre-flight DNS validation for SSRF Protection
   */
  public static async validateUrlSecurity(targetUrl: string): Promise<string> {
    let parsed: URL;
    try {
      let normalized = targetUrl.trim();
      if (!/^https?:\/\//i.test(normalized)) {
        normalized = `https://${normalized}`;
      }
      parsed = new URL(normalized);
    } catch {
      throw new Error(`Invalid URL format provided: "${targetUrl}"`);
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Forbidden protocol: "${parsed.protocol}". Only HTTP and HTTPS are permitted.`);
    }

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      throw new Error(`SSRF Defense: Localhost and internal domains are forbidden.`);
    }

    try {
      const addresses = await dns.lookup(hostname, { all: true });
      for (const record of addresses) {
        const ip = record.address;
        if (
          ip.startsWith("127.") ||
          ip.startsWith("10.") ||
          ip.startsWith("192.168.") ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
          ip === "169.254.169.254" ||
          ip === "::1" ||
          ip.startsWith("fc00:") ||
          ip.startsWith("fe80:")
        ) {
          throw new Error(`SSRF Defense: Resolved IP "${ip}" belongs to a private, loopback, or cloud-metadata network.`);
        }
      }
    } catch (err: any) {
      if (err.message.includes("SSRF Defense")) throw err;
      throw new Error(`Could not resolve hostname "${hostname}": ${err.message}`);
    }

    return parsed.toString();
  }

  /**
   * Execute Direct Single-Site Teardown
   */
  public static async executeDirectTeardown(params: DirectAuditParams): Promise<DirectAuditResponse> {
    const validatedUrl = await this.validateUrlSecurity(params.url);
    const domainName = new URL(validatedUrl).hostname.replace(/^www\./, "");
    const businessName = params.name?.trim() || domainName.split(".")[0].toUpperCase();
    const location = params.location?.trim() || "Local Market";

    // 1. Live Playwright Dual-Viewport Audit
    const auditEngine = new PlaywrightAuditEngine();
    let auditTelemetry: AuditTelemetry;
    try {
      auditTelemetry = await auditEngine.auditUrl(validatedUrl, false);
    } finally {
      await auditEngine.close();
    }

    // 2. Resolve Category & Provenance
    let category: string;
    let categorySource: "USER_SPECIFIED" | "WEBSITE_META" = "USER_SPECIFIED";
    let categoryConfidence = 1.0;

    if (params.category && params.category.trim().length > 0) {
      category = params.category.trim();
    } else {
      const deduced = this.deduceCategoryFromWebsite(domainName, auditTelemetry.findings || []);
      category = deduced.category;
      categorySource = "WEBSITE_META";
      categoryConfidence = deduced.confidence;
    }

    // 3. Factual Google Evidence (Strictly NOT_VERIFIED for direct URL audits without Google Place lookup)
    const googleEvidence: GoogleEvidence = {
      status: "NOT_VERIFIED",
      placeId: null,
      googleMapsUrl: null,
      rating: null,
      reviewCount: null,
      primaryType: null,
      primaryTypeDisplayName: null,
      source: "NONE",
      retrievedAt: new Date().toISOString(),
    };

    // 4. Synthesize Commercial Profile & Sales Intelligence Dossier
    const dossier = await DossierSynthesizer.synthesize({
      name: businessName,
      category,
      rating: null, // NO FABRICATION: Direct URL audits do not invent Google ratings
      reviewCount: null, // NO FABRICATION: Direct URL audits do not invent Google review counts
      reviewTrend: "UNKNOWN",
      hasWebsite: true,
      websiteUrl: validatedUrl,
      formattedAddress: location,
      auditTelemetry,
      googleEvidence,
      categorySource,
      categoryConfidence,
    });

    // 5. Construct In-Memory / Ephemeral Lead Object with Nullable Unverified Data
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
      rating: null, // Strictly null: no unverified number
      reviewCount: null, // Strictly null: no unverified number
      previousRating: null,
      previousReviewCount: null,
      lastReviewDate: null,
      reviewsLast30Days: null,
      reviewsLast90Days: null,
      reviewsLast180Days: null,
      reviewTrend: "UNKNOWN",
      ratingSource: "UNVERIFIED",
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
      disposition: dossier.disposition || "NOT_A_FIT",
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

    const persist = Boolean(params.persist);
    if (persist) {
      const scanId = `direct_scan_${crypto.randomBytes(6).toString("hex")}`;
      db.transaction((tx) => {
        tx.insert(discoveryScans).values({
          id: scanId,
          niche: category,
          locationInput: location,
          radiusKm: 15,
          status: "COMPLETED",
          rawDiscoveredCount: 1,
          qualifiedCount: 1,
          createdAt: now,
        }).run();

        tx.insert(leads).values({
          ...lead,
          scanId,
        }).run();
      });
      lead.scanId = scanId;
    }

    return {
      lead,
      isEphemeral: !persist,
    };
  }
}
