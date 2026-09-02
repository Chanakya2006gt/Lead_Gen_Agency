import { db } from "@/core/db";
import { discoveryScans, leads, leadObservations } from "@/core/db/schema";
import { eq } from "drizzle-orm";
import { IDiscoveryAdapter } from "@/features/discovery/types";
import { GooglePlacesApiAdapter } from "@/features/discovery/GooglePlacesApiAdapter";
import { MockDiscoveryAdapter } from "@/features/discovery/MockDiscoveryAdapter";
import { LiveGoogleMapsAdapter } from "@/features/discovery/LiveGoogleMapsAdapter";
import { SerpApiGoogleMapsAdapter } from "@/features/discovery/SerpApiGoogleMapsAdapter";
import { ApifyMapsAdapter } from "@/features/discovery/ApifyMapsAdapter";
import { OutscraperAdapter } from "@/features/discovery/OutscraperAdapter";
import { UniversalFilterService } from "@/features/qualification/UniversalFilterService";
import { PlaywrightAuditEngine } from "@/features/auditor/PlaywrightAuditEngine";
import { DossierSynthesizer } from "@/features/synthesis/DossierSynthesizer";
import { BusinessIdentityResolver } from "@/features/identity/BusinessIdentityResolver";
import crypto from "crypto";

export interface ScanOptions {
  niche: string;
  location: string;
  radiusKm?: number;
  source?: "google_places" | "live_google_maps" | "serpapi" | "mock" | "apify" | "outscraper";
}

export class ScanPipelineService {
  private static activeControllers: Map<string, AbortController> = new Map();

  /**
   * Cancels a running scan and halts background audit loops immediately
   */
  public static async cancelScan(scanId: string): Promise<boolean> {
    const controller = this.activeControllers.get(scanId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(scanId);
    }
    db.update(discoveryScans)
      .set({ status: "CANCELLED" })
      .where(eq(discoveryScans.id, scanId))
      .run();
    return true;
  }

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
    const abortController = new AbortController();
    this.activeControllers.set(scanId, abortController);

    // Select Discovery Adapter
    let adapter: IDiscoveryAdapter;
    if (options.source === "google_places") {
      adapter = new GooglePlacesApiAdapter();
    } else if (options.source === "serpapi") {
      adapter = new SerpApiGoogleMapsAdapter();
    } else if (options.source === "apify") {
      adapter = new ApifyMapsAdapter();
    } else if (options.source === "outscraper") {
      adapter = new OutscraperAdapter();
    } else if (options.source === "mock" && (process.env.NODE_ENV === "test" || process.env.PLAYWRIGHT_TEST === "1")) {
      adapter = new MockDiscoveryAdapter();
    } else {
      if (process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY) {
        adapter = new GooglePlacesApiAdapter();
      } else {
        adapter = new LiveGoogleMapsAdapter();
      }
    }

    // Step A: Ingest raw business records
    let rawBusinesses: any[] = [];
    try {
      rawBusinesses = await adapter.discover({
        niche: options.niche,
        location: options.location,
        radiusKm: options.radiusKm || 15,
      });
    } catch (discoveryErr: any) {
      console.error(`Discovery adapter (${adapter.name}) failed:`, discoveryErr);
      db.update(discoveryScans)
        .set({ status: "FAILED" })
        .where(eq(discoveryScans.id, scanId))
        .run();
      return;
    }

    if (abortController.signal.aborted) {
      db.update(discoveryScans).set({ status: "CANCELLED" }).where(eq(discoveryScans.id, scanId)).run();
      return;
    }

    db.update(discoveryScans)
      .set({ rawDiscoveredCount: rawBusinesses.length })
      .where(eq(discoveryScans.id, scanId))
      .run();

    if (rawBusinesses.length === 0) {
      db.update(discoveryScans)
        .set({ status: "COMPLETED", qualifiedCount: 0 })
        .where(eq(discoveryScans.id, scanId))
        .run();
      return;
    }

    const auditEngine = new PlaywrightAuditEngine();
    let qualifiedCount = 0;

    try {
      // Step B: Filter qualified businesses using 13 Universal Invariants
      const qualifiedItems = rawBusinesses
        .map((business) => ({ business, filterResult: UniversalFilterService.evaluate(business) }))
        .filter((item) => item.filterResult.qualified);

      // Process audits in parallel concurrency batches (3 at a time) for speed
      const BATCH_SIZE = 3;
      for (let i = 0; i < qualifiedItems.length; i += BATCH_SIZE) {
        if (abortController.signal.aborted) {
          console.log(`Scan ${scanId} was cancelled by operator.`);
          db.update(discoveryScans).set({ status: "CANCELLED", qualifiedCount }).where(eq(discoveryScans.id, scanId)).run();
          return;
        }

        const batch = qualifiedItems.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async ({ business, filterResult }) => {
            if (abortController.signal.aborted) return;

            qualifiedCount++;

            // Step C: Identity Resolution & Stable Entity Extraction
            const placeId = business.placeId || BusinessIdentityResolver.resolveId({
              name: business.name,
              formattedAddress: business.formattedAddress,
              phone: business.phone,
              googleMapsUrl: business.googleMapsUrl,
            });

            let identitySource = "deterministic";
            if (placeId.startsWith("gplace_") || placeId.startsWith("gfeat_") || placeId.startsWith("gcid_")) {
              identitySource = "google_verified";
            }

            // Check if this business entity already exists in our database
            const existingLead = db.select().from(leads).where(eq(leads.placeId, placeId)).get();

            // Non-Destructive Field Resolution: preserve verified existing contact points if current scrape glitched
            const effectiveWebsiteUrl = business.websiteUrl || existingLead?.websiteUrl || null;
            const effectivePhone = business.phone || existingLead?.phone || null;
            const effectiveAddress = business.formattedAddress || existingLead?.formattedAddress || null;
            const effectiveMapsUrl = business.googleMapsUrl || existingLead?.googleMapsUrl || null;
            const effectiveHasWebsite = Boolean(effectiveWebsiteUrl);

            // Step D: Headless Dual-Viewport Audit or No-Website Fast Track
            let auditStatus: "PENDING" | "NO_WEBSITE" | "AUDITED" | "FAILED" = "PENDING";
            let auditTelemetry = null;

            if (!effectiveHasWebsite) {
              auditStatus = "NO_WEBSITE";
            } else if (effectiveWebsiteUrl) {
              try {
                const allowLocalhost = options.source === "mock" || process.env.NODE_ENV === "test";
                auditTelemetry = await auditEngine.auditUrl(effectiveWebsiteUrl, allowLocalhost);
                auditStatus = "AUDITED";
              } catch (auditErr) {
                console.warn(`Audit failed for ${business.name} (${effectiveWebsiteUrl}):`, auditErr);
                auditStatus = "FAILED";
              }
            }

            if (abortController.signal.aborted) return;

            // Step E: Grounded Dossier Synthesis & 4D Scoring with Signal Provenance
            const dossier = await DossierSynthesizer.synthesize(
              {
                name: business.name,
                category: business.category || options.niche,
                rating: filterResult.rating,
                reviewCount: filterResult.reviewCount,
                reviewTrend: filterResult.reviewTrend,
                reviewsLast30Days: filterResult.reviewsLast30Days,
                reviewsLast90Days: filterResult.reviewsLast90Days,
                hasWebsite: effectiveHasWebsite,
                websiteUrl: effectiveWebsiteUrl,
                phone: effectivePhone,
                formattedAddress: effectiveAddress,
                googleMapsUrl: effectiveMapsUrl,
                auditTelemetry,
              },
              process.env.OPENAI_API_KEY
            );

            const now = new Date().toISOString();

            // Calculate Longitudinal Metrics across Scans
            const reviewCountDelta = existingLead ? filterResult.reviewCount - existingLead.reviewCount : 0;
            const ratingDelta = existingLead ? +(filterResult.rating - existingLead.rating).toFixed(1) : 0;
            const observationCount = existingLead ? existingLead.observationCount + 1 : 1;
            const firstObservedAt = existingLead?.firstObservedAt || existingLead?.createdAt || now;
            const leadId = existingLead?.id || crypto.randomUUID();

            // Step F: Non-Destructive Entity Persistence (Upsert)
            if (existingLead) {
              db.update(leads)
                .set({
                  scanId, // Associate with current active scan
                  name: business.name,
                  category: business.category || options.niche,
                  formattedAddress: effectiveAddress,
                  phone: effectivePhone,
                  googleMapsUrl: effectiveMapsUrl,
                  websiteUrl: effectiveWebsiteUrl,
                  rating: filterResult.rating,
                  reviewCount: filterResult.reviewCount,
                  lastReviewDate: filterResult.lastReviewDate || existingLead.lastReviewDate,
                  reviewsLast30Days: filterResult.reviewsLast30Days,
                  reviewsLast90Days: filterResult.reviewsLast90Days,
                  reviewsLast180Days: filterResult.reviewsLast180Days,
                  reviewTrend: filterResult.reviewTrend,
                  hasWebsite: effectiveHasWebsite,
                  auditStatus: auditStatus === "PENDING" && existingLead.auditStatus === "AUDITED" ? existingLead.auditStatus : auditStatus,
                  auditTelemetry: (auditTelemetry || existingLead.auditTelemetry) as any,
                  reputationScore: dossier.reputationScore,
                  digitalGapScore: dossier.digitalGapScore,
                  opportunityScore: dossier.opportunityScore,
                  confidenceScore: dossier.confidenceScore,
                  totalLeadScore: dossier.overallLeadScore,
                  opportunityType: dossier.opportunityType,
                  dossier: dossier as any,
                  lastObservedAt: now,
                  observationCount,
                  reviewCountDelta,
                  ratingDelta,
                  identitySource,
                  updatedAt: now,
                })
                .where(eq(leads.id, existingLead.id))
                .run();
            } else {
              db.insert(leads)
                .values({
                  id: leadId,
                  scanId,
                  placeId,
                  name: business.name,
                  category: business.category || options.niche,
                  formattedAddress: effectiveAddress,
                  phone: effectivePhone,
                  googleMapsUrl: effectiveMapsUrl,
                  websiteUrl: effectiveWebsiteUrl,
                  rating: filterResult.rating,
                  reviewCount: filterResult.reviewCount,
                  lastReviewDate: filterResult.lastReviewDate || null,
                  reviewsLast30Days: filterResult.reviewsLast30Days,
                  reviewsLast90Days: filterResult.reviewsLast90Days,
                  reviewsLast180Days: filterResult.reviewsLast180Days,
                  reviewTrend: filterResult.reviewTrend,
                  hasWebsite: effectiveHasWebsite,
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
                  firstObservedAt,
                  lastObservedAt: now,
                  observationCount: 1,
                  reviewCountDelta: 0,
                  ratingDelta: 0,
                  identitySource,
                  createdAt: now,
                  updatedAt: now,
                })
                .run();
            }

            // Record point-in-time observation entry
            db.insert(leadObservations)
              .values({
                id: crypto.randomUUID(),
                leadId,
                scanId,
                observedRating: filterResult.rating,
                observedReviewCount: filterResult.reviewCount,
                observedWebsiteUrl: effectiveWebsiteUrl,
                observedPhone: effectivePhone,
                observedAt: now,
              })
              .run();
          })
        );

        // Update running qualified count on scan record after each batch
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
      this.activeControllers.delete(scanId);
      await auditEngine.close();
    }
  }
}
