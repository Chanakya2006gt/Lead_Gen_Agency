import { db } from "@/db";
import { discoveryScans, leads, DiscoveryScan, Lead, InsertLead } from "@/db/schema";
import { eq } from "drizzle-orm";
import { IDiscoveryAdapter } from "@/services/discovery/types";
import { MockDiscoveryAdapter } from "@/services/discovery/MockDiscoveryAdapter";
import { LiveGoogleMapsAdapter } from "@/services/discovery/LiveGoogleMapsAdapter";
import { SerpApiGoogleMapsAdapter } from "@/services/discovery/SerpApiGoogleMapsAdapter";
import { ApifyMapsAdapter } from "@/services/discovery/ApifyMapsAdapter";
import { OutscraperAdapter } from "@/services/discovery/OutscraperAdapter";
import { UniversalFilterService } from "@/services/filter/UniversalFilterService";
import { PlaywrightAuditEngine } from "@/services/auditor/PlaywrightAuditEngine";
import { DossierSynthesizer } from "@/services/synthesis/DossierSynthesizer";
import crypto from "crypto";

export interface ScanOptions {
  niche: string;
  location: string;
  radiusKm?: number;
  source?: "live_google_maps" | "serpapi" | "mock" | "apify" | "outscraper";
}

export class ScanPipelineService {
  /**
   * Executes full end-to-end discovery, qualification, audit, and synthesis pipeline
   */
  public static async executeScan(options: ScanOptions): Promise<string> {
    const scanId = crypto.randomUUID();
    const radiusKm = options.radiusKm || 15;
    const nowIso = new Date().toISOString();

    // 1. Create Scan Record in DB
    db.insert(discoveryScans)
      .values({
        id: scanId,
        niche: options.niche,
        locationInput: options.location,
        radiusKm,
        status: "RUNNING",
        rawDiscoveredCount: 0,
        qualifiedCount: 0,
        createdAt: nowIso,
      })
      .run();

    // Run asynchronously in background
    this.runPipelineJob(scanId, options).catch((err) => {
      console.error(`Pipeline job ${scanId} failed:`, err);
      db.update(discoveryScans)
        .set({ status: "FAILED" })
        .where(eq(discoveryScans.id, scanId))
        .run();
    });

    return scanId;
  }

  private static async runPipelineJob(scanId: string, options: ScanOptions): Promise<void> {
    // Select Discovery Adapter
    let adapter: IDiscoveryAdapter;
    if (options.source === "serpapi") {
      adapter = new SerpApiGoogleMapsAdapter();
    } else if (options.source === "apify") {
      adapter = new ApifyMapsAdapter();
    } else if (options.source === "outscraper") {
      adapter = new OutscraperAdapter();
    } else if (options.source === "mock") {
      adapter = new MockDiscoveryAdapter();
    } else {
      // Default: Live Real-Time Google Maps Scraper (Native Playwright)
      adapter = new LiveGoogleMapsAdapter();
    }

    // Step A: Ingest raw business records
    let rawBusinesses: any[] = [];
    try {
      rawBusinesses = await adapter.discover({
        niche: options.niche,
        location: options.location,
        radiusKm: options.radiusKm || 15,
      });
    } catch (discoveryErr) {
      console.warn("Primary discovery adapter encountered error, trying mock fallback:", discoveryErr);
    }

    if (rawBusinesses.length === 0 && options.source !== "mock") {
      // Fallback to high-fidelity mock if live was blocked or empty
      const fallbackAdapter = new MockDiscoveryAdapter();
      rawBusinesses = await fallbackAdapter.discover({
        niche: options.niche,
        location: options.location,
        radiusKm: options.radiusKm || 15,
      });
    }

    db.update(discoveryScans)
      .set({ rawDiscoveredCount: rawBusinesses.length })
      .where(eq(discoveryScans.id, scanId))
      .run();

    const auditEngine = new PlaywrightAuditEngine();
    let qualifiedCount = 0;

    try {
      for (const business of rawBusinesses) {
        // Step B: Universal Filter Evaluation
        const filterResult = UniversalFilterService.evaluate(business);

        if (!filterResult.isQualified) {
          continue; // Dropped at qualification gate
        }

        qualifiedCount++;
        const leadId = crypto.randomUUID();

        // Step C: Headless Audit or No-Website Fast Track
        let auditStatus: "PENDING" | "NO_WEBSITE" | "AUDITED" | "FAILED" = "PENDING";
        let auditTelemetry = null;

        if (!filterResult.hasWebsite) {
          auditStatus = "NO_WEBSITE";
        } else if (business.websiteUrl) {
          try {
            auditTelemetry = await auditEngine.auditUrl(business.websiteUrl);
            auditStatus = "AUDITED";
          } catch (auditErr) {
            console.warn(`Audit failed for ${business.name} (${business.websiteUrl}):`, auditErr);
            auditStatus = "FAILED";
          }
        }

        // Step D: Grounded Dossier Synthesis & 4D Scoring
        const dossier = await DossierSynthesizer.synthesize(
          {
            name: business.name,
            category: business.category || options.niche,
            rating: filterResult.rating,
            reviewCount: filterResult.reviewCount,
            reviewTrend: filterResult.reviewTrend,
            hasWebsite: filterResult.hasWebsite,
            websiteUrl: business.websiteUrl,
            phone: business.phone,
            formattedAddress: business.formattedAddress,
            auditTelemetry,
          },
          process.env.OPENAI_API_KEY
        );

        const now = new Date().toISOString();

        // Step E: Persist Qualified Lead (with Upsert on placeId)
        db.insert(leads)
          .values({
            id: leadId,
            scanId,
            placeId: business.placeId,
            name: business.name,
            category: business.category || options.niche,
            formattedAddress: business.formattedAddress || null,
            phone: business.phone || null,
            googleMapsUrl: business.googleMapsUrl || null,
            websiteUrl: business.websiteUrl || null,
            rating: filterResult.rating,
            reviewCount: filterResult.reviewCount,
            lastReviewDate: filterResult.lastReviewDate || null,
            reviewsLast30Days: filterResult.reviewsLast30Days,
            reviewsLast90Days: filterResult.reviewsLast90Days,
            reviewsLast180Days: filterResult.reviewsLast180Days,
            reviewTrend: filterResult.reviewTrend,
            hasWebsite: filterResult.hasWebsite,
            auditStatus,
            auditTelemetry: auditTelemetry as any,
            reputationScore: dossier.reputationScore,
            digitalGapScore: dossier.digitalGapScore,
            opportunityScore: dossier.opportunityScore,
            confidenceScore: dossier.confidenceScore,
            totalLeadScore: dossier.overallLeadScore,
            opportunityType: dossier.opportunityType,
            dossier: dossier as any,
            humanStatus: "NEW",
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: leads.placeId,
            set: {
              scanId,
              name: business.name,
              category: business.category || options.niche,
              formattedAddress: business.formattedAddress || null,
              phone: business.phone || null,
              googleMapsUrl: business.googleMapsUrl || null,
              websiteUrl: business.websiteUrl || null,
              rating: filterResult.rating,
              reviewCount: filterResult.reviewCount,
              lastReviewDate: filterResult.lastReviewDate || null,
              reviewsLast30Days: filterResult.reviewsLast30Days,
              reviewsLast90Days: filterResult.reviewsLast90Days,
              reviewsLast180Days: filterResult.reviewsLast180Days,
              reviewTrend: filterResult.reviewTrend,
              hasWebsite: filterResult.hasWebsite,
              auditStatus,
              auditTelemetry: auditTelemetry as any,
              reputationScore: dossier.reputationScore,
              digitalGapScore: dossier.digitalGapScore,
              opportunityScore: dossier.opportunityScore,
              confidenceScore: dossier.confidenceScore,
              totalLeadScore: dossier.overallLeadScore,
              opportunityType: dossier.opportunityType,
              dossier: dossier as any,
              updatedAt: now,
            },
          })
          .run();
      }

      // Mark Scan Complete
      db.update(discoveryScans)
        .set({
          status: "COMPLETED",
          qualifiedCount,
        })
        .where(eq(discoveryScans.id, scanId))
        .run();
    } finally {
      await auditEngine.close();
    }
  }
}
