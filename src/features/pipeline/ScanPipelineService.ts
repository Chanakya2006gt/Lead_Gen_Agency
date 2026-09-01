import { db } from "@/core/db";
import { discoveryScans, leads } from "@/core/db/schema";
import { eq } from "drizzle-orm";
import { IDiscoveryAdapter } from "@/features/discovery/types";
import { MockDiscoveryAdapter } from "@/features/discovery/MockDiscoveryAdapter";
import { LiveGoogleMapsAdapter } from "@/features/discovery/LiveGoogleMapsAdapter";
import { SerpApiGoogleMapsAdapter } from "@/features/discovery/SerpApiGoogleMapsAdapter";
import { ApifyMapsAdapter } from "@/features/discovery/ApifyMapsAdapter";
import { OutscraperAdapter } from "@/features/discovery/OutscraperAdapter";
import { UniversalFilterService } from "@/features/qualification/UniversalFilterService";
import { PlaywrightAuditEngine } from "@/features/auditor/PlaywrightAuditEngine";
import { DossierSynthesizer } from "@/features/synthesis/DossierSynthesizer";
import crypto from "crypto";

export interface ScanOptions {
  niche: string;
  location: string;
  radiusKm?: number;
  source?: "live_google_maps" | "serpapi" | "mock" | "apify" | "outscraper";
}

export class ScanPipelineService {
  /**
   * Dispatches discovery & audit pipeline job in the background
   */
  public static async executeScan(options: ScanOptions): Promise<string> {
    const scanId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 1. Initialize Scan record in DB
    db.insert(discoveryScans)
      .values({
        id: scanId,
        niche: options.niche,
        locationInput: options.location,
        radiusKm: options.radiusKm || 15,
        status: "RUNNING",
        rawDiscoveredCount: 0,
        qualifiedCount: 0,
        createdAt: now,
      })
      .run();

    // 2. Launch background execution asynchronously
    this.runPipelineJob(scanId, options).catch((err) => {
      console.error(`Pipeline job failed for scan ${scanId}:`, err);
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
        // Step B: Universal 13 Invariant Qualification
        const filterResult = UniversalFilterService.evaluate(business);

        if (!filterResult.qualified) {
          continue; // Hard gate rejection
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

        // Update running qualified count on scan record
        db.update(discoveryScans)
          .set({ qualifiedCount })
          .where(eq(discoveryScans.id, scanId))
          .run();
      }

      // Mark scan as COMPLETED
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
