import { db } from "@/core/db";
import { discoveryScans, leads, leadObservations } from "@/core/db/schema";
import { eq, desc, sql } from "drizzle-orm";
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
import { SecondaryDomainResolver } from "@/features/discovery/SecondaryDomainResolver";
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
    try {
      db.update(discoveryScans)
        .set({ status: "CANCELLED" })
        .where(eq(discoveryScans.id, scanId))
        .run();
    } catch {}
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
      const isAborted = this.activeControllers.get(scanId)?.signal.aborted;
      if (!isAborted) {
        console.error(`Pipeline job failed for scan ${scanId}:`, err);
        try {
          db.update(discoveryScans)
            .set({ status: "FAILED" })
            .where(eq(discoveryScans.id, scanId))
            .run();
        } catch {}
      }
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
      if (!abortController.signal.aborted) {
        db.update(discoveryScans)
          .set({ status: "FAILED" })
          .where(eq(discoveryScans.id, scanId))
          .run();
      }
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

            // Step C: Canonical Identity Resolution & Cross-Adapter Harmonization
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

            // Step D: Decoupled Semantic Website Resolution & Headless Audit
            const rawGbpWebsiteUrl = business.websiteUrl || null;
            const hasGbpWebsiteLink = Boolean(rawGbpWebsiteUrl);
            let hasWebsite = hasGbpWebsiteLink;
            let isGbpDisconnected = false;
            let unlinkedWebsiteUrl: string | null = null;
            let canonicalWebsiteUrl: string | null = rawGbpWebsiteUrl;
            let auditStatus: "PENDING" | "NO_WEBSITE" | "AUDITED" | "FAILED" = "PENDING";
            let auditTelemetry = null;

            if (!hasGbpWebsiteLink) {
              // Attempt Secondary Multi-Tier Domain Resolution & Entity Proof
              const secondaryResult = await SecondaryDomainResolver.resolve({
                name: business.name,
                formattedAddress: business.formattedAddress,
                locationInput: options.location,
                phone: business.phone,
              });

              if (secondaryResult.verified && secondaryResult.unlinkedWebsiteUrl) {
                hasWebsite = true;
                isGbpDisconnected = true;
                unlinkedWebsiteUrl = secondaryResult.unlinkedWebsiteUrl;
                canonicalWebsiteUrl = secondaryResult.unlinkedWebsiteUrl;

                try {
                  const allowLocalhost = options.source === "mock" || process.env.NODE_ENV === "test";
                  auditTelemetry = await auditEngine.auditUrl(canonicalWebsiteUrl, allowLocalhost);
                  auditStatus = "AUDITED";
                } catch (auditErr) {
                  console.warn(`Audit failed for unlinked site ${business.name} (${canonicalWebsiteUrl}):`, auditErr);
                  auditStatus = "FAILED";
                }
              } else {
                hasWebsite = false;
                isGbpDisconnected = false;
                auditStatus = "NO_WEBSITE";
              }
            } else {
              try {
                const allowLocalhost = options.source === "mock" || process.env.NODE_ENV === "test";
                auditTelemetry = await auditEngine.auditUrl(rawGbpWebsiteUrl!, allowLocalhost);
                auditStatus = "AUDITED";
              } catch (auditErr) {
                console.warn(`Audit failed for ${business.name} (${rawGbpWebsiteUrl}):`, auditErr);
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
                hasWebsite,
                isGbpDisconnected,
                unlinkedWebsiteUrl,
                websiteUrl: canonicalWebsiteUrl,
                phone: business.phone,
                formattedAddress: business.formattedAddress,
                googleMapsUrl: business.googleMapsUrl,
                auditTelemetry,
              },
              process.env.OPENAI_API_KEY
            );

            const now = new Date().toISOString();

            // Fetch existing lead before transaction to check domain migration gate
            let existingLeadPreTx = db.select().from(leads).where(eq(leads.placeId, placeId)).get();

            let verifiedMigrationUrl = canonicalWebsiteUrl;
            if (existingLeadPreTx && existingLeadPreTx.websiteUrl && canonicalWebsiteUrl && canonicalWebsiteUrl !== existingLeadPreTx.websiteUrl) {
              const migrationPassed = await SecondaryDomainResolver.verifyDomainMigration(
                canonicalWebsiteUrl,
                { name: business.name, formattedAddress: business.formattedAddress, phone: business.phone },
                existingLeadPreTx.websiteUrl
              );
              if (!migrationPassed || auditStatus === "FAILED") {
                verifiedMigrationUrl = existingLeadPreTx.websiteUrl;
              }
            }

            // =========================================================================
            // Step F: ATOMIC ACID TRANSACTION INVARIANT
            // Database Invariant -> Atomic Transaction -> Immutable Observation -> Derived Authoritative State
            // =========================================================================
            db.transaction((tx) => {
              // 0. Safety Guard: Check if scan still exists (user might have deleted it during run)
              const scanRow = tx
                .select({ id: discoveryScans.id })
                .from(discoveryScans)
                .where(eq(discoveryScans.id, scanId))
                .get();

              if (!scanRow || abortController.signal.aborted) {
                return; // Gracefully abort write
              }

              // 1. Fetch existing lead record within transaction
              let existingLead = tx.select().from(leads).where(eq(leads.placeId, placeId)).get();

              // Secondary Linking fallback if not found by primary placeId
              if (!existingLead && business.phone) {
                const allLeads = tx.select({
                  id: leads.id,
                  placeId: leads.placeId,
                  name: leads.name,
                  phone: leads.phone,
                  formattedAddress: leads.formattedAddress,
                }).from(leads).all();

                const secondaryMatch = BusinessIdentityResolver.findMatchingLead(
                  {
                    name: business.name,
                    formattedAddress: business.formattedAddress,
                    phone: business.phone,
                    googleMapsUrl: business.googleMapsUrl,
                  },
                  allLeads
                );

                if (secondaryMatch) {
                  existingLead = tx.select().from(leads).where(eq(leads.id, secondaryMatch.id)).get();
                }
              }

              const targetLeadId = existingLead?.id || crypto.randomUUID();

              // 2. Fetch Authoritative Preceding Observation from Ledger (not from mutable row)
              const latestPrecedingObservation = existingLead
                ? tx.select()
                    .from(leadObservations)
                    .where(eq(leadObservations.leadId, existingLead.id))
                    .orderBy(desc(leadObservations.observedAt))
                    .limit(1)
                    .get()
                : null;

              const previousReviewCount = latestPrecedingObservation
                ? latestPrecedingObservation.observedReviewCount
                : null;
              const previousRating = latestPrecedingObservation
                ? latestPrecedingObservation.observedRating
                : null;

              // Calculate True Longitudinal Deltas against Preceding Observation
              const reviewCountDelta = previousReviewCount !== null
                ? filterResult.reviewCount - previousReviewCount
                : 0;
              const ratingDelta = previousRating !== null
                ? +(filterResult.rating - previousRating).toFixed(1)
                : 0;

              // 3. Clock-Skew / Out-of-Order Guard:
              // Only update current lead mutable properties if incoming observation is newer or equal to lastObservedAt
              const isNewestObservation =
                !existingLead ||
                new Date(now).getTime() >=
                  new Date(existingLead.lastObservedAt || existingLead.createdAt).getTime();

              // 4. Authoritative Semantic Website State Calculation
              const effectiveWebsiteUrl = verifiedMigrationUrl || existingLead?.websiteUrl || null;
              const effectiveGbpWebsiteUrl = rawGbpWebsiteUrl || existingLead?.gbpWebsiteUrl || null;
              const effectiveUnlinkedWebsiteUrl = unlinkedWebsiteUrl || existingLead?.unlinkedWebsiteUrl || null;
              const effectiveHasGbpLink = Boolean(effectiveGbpWebsiteUrl);
              const effectiveHasWebsite = Boolean(effectiveWebsiteUrl);
              const effectiveIsGbpDisconnected = effectiveHasWebsite && !effectiveHasGbpLink;

              const effectivePhone = business.phone || existingLead?.phone || null;
              const effectiveAddress = business.formattedAddress || existingLead?.formattedAddress || null;
              const effectiveMapsUrl = business.googleMapsUrl || existingLead?.googleMapsUrl || null;

              if (existingLead) {
                if (isNewestObservation) {
                  // Atomic Update of Current State with Newest Data
                  tx.update(leads)
                    .set({
                      scanId, // Associate with current discovery scan
                      name: business.name,
                      category: business.category || options.niche,
                      formattedAddress: effectiveAddress,
                      phone: effectivePhone,
                      googleMapsUrl: effectiveMapsUrl,
                      hasWebsite: effectiveHasWebsite,
                      hasGbpWebsiteLink: effectiveHasGbpLink,
                      isGbpDisconnected: effectiveIsGbpDisconnected,
                      websiteUrl: effectiveWebsiteUrl,
                      gbpWebsiteUrl: effectiveGbpWebsiteUrl,
                      unlinkedWebsiteUrl: effectiveUnlinkedWebsiteUrl,
                      rating: filterResult.rating,
                      reviewCount: filterResult.reviewCount,
                      previousRating: previousRating ?? existingLead.previousRating,
                      previousReviewCount: previousReviewCount ?? existingLead.previousReviewCount,
                      lastReviewDate: filterResult.lastReviewDate || existingLead.lastReviewDate,
                      reviewsLast30Days: filterResult.reviewsLast30Days,
                      reviewsLast90Days: filterResult.reviewsLast90Days,
                      reviewsLast180Days: filterResult.reviewsLast180Days,
                      reviewTrend: filterResult.reviewTrend,
                      auditStatus: (auditStatus === "FAILED" && existingLead.auditStatus === "AUDITED") ? existingLead.auditStatus : auditStatus,
                      auditTelemetry: (auditTelemetry || existingLead.auditTelemetry) as any,
                      reputationScore: dossier.reputationScore,
                      digitalGapScore: dossier.digitalGapScore,
                      opportunityScore: dossier.opportunityScore,
                      confidenceScore: dossier.confidenceScore,
                      totalLeadScore: dossier.overallLeadScore,
                      opportunityType: dossier.opportunityType,
                      dossier: dossier as any,
                      lastObservedAt: now,
                      reviewCountDelta,
                      ratingDelta,
                      identitySource,
                      updatedAt: now,
                    })
                    .where(eq(leads.id, existingLead.id))
                    .run();
                }
              } else {
                // Atomic Insert of New Lead Entity
                tx.insert(leads)
                  .values({
                    id: targetLeadId,
                    scanId,
                    placeId,
                    name: business.name,
                    category: business.category || options.niche,
                    formattedAddress: effectiveAddress,
                    phone: effectivePhone,
                    googleMapsUrl: effectiveMapsUrl,
                    hasWebsite: effectiveHasWebsite,
                    hasGbpWebsiteLink: effectiveHasGbpLink,
                    isGbpDisconnected: effectiveIsGbpDisconnected,
                    websiteUrl: effectiveWebsiteUrl,
                    gbpWebsiteUrl: effectiveGbpWebsiteUrl,
                    unlinkedWebsiteUrl: effectiveUnlinkedWebsiteUrl,
                    rating: filterResult.rating,
                    reviewCount: filterResult.reviewCount,
                    previousRating: null,
                    previousReviewCount: null,
                    lastReviewDate: filterResult.lastReviewDate || null,
                    reviewsLast30Days: filterResult.reviewsLast30Days,
                    reviewsLast90Days: filterResult.reviewsLast90Days,
                    reviewsLast180Days: filterResult.reviewsLast180Days,
                    reviewTrend: filterResult.reviewTrend,
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
                    firstObservedAt: now,
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

              // 5. Immutable Observation Append: ALWAYS append observation to ledger
              tx.insert(leadObservations)
                .values({
                  id: crypto.randomUUID(),
                  leadId: targetLeadId,
                  scanId,
                  observedRating: filterResult.rating,
                  observedReviewCount: filterResult.reviewCount,
                  observedWebsiteUrl: effectiveWebsiteUrl,
                  observedPhone: effectivePhone,
                  observedAt: now,
                })
                .run();

              // 6. Authoritative Observation Count Synchronization from Ledger
              const authoritativeCount = tx
                .select({ count: sql<number>`count(*)` })
                .from(leadObservations)
                .where(eq(leadObservations.leadId, targetLeadId))
                .get()?.count ?? 1;

              tx.update(leads)
                .set({ observationCount: authoritativeCount })
                .where(eq(leads.id, targetLeadId))
                .run();
            });

            qualifiedCount++;
          })
        );

        // Update running qualified count on scan record after each batch if not aborted
        if (!abortController.signal.aborted) {
          db.update(discoveryScans)
            .set({ qualifiedCount })
            .where(eq(discoveryScans.id, scanId))
            .run();
        }
      }

      // Mark scan as COMPLETED if not cancelled/aborted
      if (!abortController.signal.aborted) {
        db.update(discoveryScans)
          .set({
            status: "COMPLETED",
            qualifiedCount,
          })
          .where(eq(discoveryScans.id, scanId))
          .run();
      }
    } finally {
      this.activeControllers.delete(scanId);
      await auditEngine.close();
    }
  }
}
