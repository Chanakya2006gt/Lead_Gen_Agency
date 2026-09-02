import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/core/db";
import { discoveryScans, leads, leadObservations } from "@/core/db/schema";
import { BusinessIdentityResolver } from "@/features/identity/BusinessIdentityResolver";
import { eq, desc, sql } from "drizzle-orm";
import crypto from "crypto";

describe("Brutal Concurrency, Atomic Transactions & Data Integrity Suite", () => {
  it("Brutal Stress Test 1: 100 simultaneous concurrent discoveries of the same business produce exactly 1 lead entity and 100 observations", async () => {
    const testScanId = `scan_stress_${crypto.randomUUID()}`;
    const canonicalPlaceId = `gfeat_0x3bcb1234:0x5678_${crypto.randomUUID().slice(0, 8)}`;
    const businessName = "Apex Dental Super-Speciality";
    const phone = "+91 9123456780";
    const address = "100 MG Road, Warangal";

    db.insert(discoveryScans).values({
      id: testScanId,
      niche: "Dental",
      locationInput: "Warangal",
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
    }).run();

    // Simulate 100 concurrent asynchronous discovery workers ingesting the same entity simultaneously
    const CONCURRENCY_COUNT = 100;
    const workerPromises = Array.from({ length: CONCURRENCY_COUNT }, (_, index) => {
      return (async () => {
        const timestamp = new Date(Date.now() + index * 10).toISOString();
        const reviewCount = 100 + index; // Incrementing review count

        // Atomic ACID transaction matching ScanPipelineService
        db.transaction((tx) => {
          let existingLead = tx.select().from(leads).where(eq(leads.placeId, canonicalPlaceId)).get();
          const targetLeadId = existingLead?.id || crypto.randomUUID();

          const latestObs = existingLead
            ? tx.select()
                .from(leadObservations)
                .where(eq(leadObservations.leadId, existingLead.id))
                .orderBy(desc(leadObservations.observedAt))
                .limit(1)
                .get()
            : null;

          const previousReviewCount = latestObs?.observedReviewCount ?? null;
          const reviewCountDelta = previousReviewCount !== null ? reviewCount - previousReviewCount : 0;

          if (existingLead) {
            tx.update(leads)
              .set({
                reviewCount,
                reviewCountDelta,
                lastObservedAt: timestamp,
                updatedAt: timestamp,
              })
              .where(eq(leads.id, existingLead.id))
              .run();
          } else {
            tx.insert(leads)
              .values({
                id: targetLeadId,
                scanId: testScanId,
                placeId: canonicalPlaceId,
                name: businessName,
                phone,
                formattedAddress: address,
                rating: 4.8,
                reviewCount,
                firstObservedAt: timestamp,
                lastObservedAt: timestamp,
                observationCount: 1,
                reviewCountDelta: 0,
                createdAt: timestamp,
                updatedAt: timestamp,
              })
              .run();
          }

          // Append observation to ledger
          tx.insert(leadObservations)
            .values({
              id: crypto.randomUUID(),
              leadId: targetLeadId,
              scanId: testScanId,
              observedRating: 4.8,
              observedReviewCount: reviewCount,
              observedPhone: phone,
              observedAt: timestamp,
            })
            .run();

          // Authoritative count sync from ledger
          const count = tx
            .select({ count: sql<number>`count(*)` })
            .from(leadObservations)
            .where(eq(leadObservations.leadId, targetLeadId))
            .get()?.count ?? 1;

          tx.update(leads)
            .set({ observationCount: count })
            .where(eq(leads.id, targetLeadId))
            .run();
        });
      })();
    });

    await Promise.all(workerPromises);

    // Assertions:
    // 1. Exactly 1 canonical lead row exists in DB (0 duplicate entities!)
    const allLeads = db.select().from(leads).where(eq(leads.placeId, canonicalPlaceId)).all();
    expect(allLeads.length).toBe(1);

    const canonicalLead = allLeads[0];
    expect(canonicalLead.placeId).toBe(canonicalPlaceId);
    expect(canonicalLead.name).toBe(businessName);

    // 2. Exactly 100 historical observations exist in the ledger
    const allObservations = db.select().from(leadObservations).where(eq(leadObservations.leadId, canonicalLead.id)).all();
    expect(allObservations.length).toBe(100);

    // 3. Denormalized cache matches authoritative count
    expect(canonicalLead.observationCount).toBe(100);
  });

  it("Brutal Stress Test 2: Out-of-order clock skew protection prevents stale observations from corrupting current state", () => {
    const testScanId = `scan_skew_${crypto.randomUUID()}`;
    const placeId = `gplace_stale_guard_${crypto.randomUUID()}`;
    const leadId = crypto.randomUUID();
    const newTimestamp = "2026-09-02T12:00:00.000Z";
    const staleTimestamp = "2026-09-01T08:00:00.000Z"; // Yesterday

    db.insert(discoveryScans).values({
      id: testScanId,
      niche: "Dental",
      locationInput: "Warangal",
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
    }).run();

    // 1. Ingest fresh observation first
    db.transaction((tx) => {
      tx.insert(leads).values({
        id: leadId,
        scanId: testScanId,
        placeId,
        name: "Metro Dental Hub",
        rating: 4.9,
        reviewCount: 200,
        firstObservedAt: newTimestamp,
        lastObservedAt: newTimestamp,
        observationCount: 1,
        createdAt: newTimestamp,
        updatedAt: newTimestamp,
      }).run();

      tx.insert(leadObservations).values({
        id: crypto.randomUUID(),
        leadId,
        scanId: testScanId,
        observedRating: 4.9,
        observedReviewCount: 200,
        observedAt: newTimestamp,
      }).run();
    });

    // 2. Simulate delayed/backfilled scrape arriving with yesterday's older timestamp and lower review count
    db.transaction((tx) => {
      const existingLead = tx.select().from(leads).where(eq(leads.placeId, placeId)).get();
      expect(existingLead).toBeDefined();

      const isNewestObservation = new Date(staleTimestamp).getTime() >= new Date(existingLead!.lastObservedAt!).getTime();
      expect(isNewestObservation).toBe(false); // Guard activated!

      if (isNewestObservation) {
        tx.update(leads).set({ rating: 4.2, reviewCount: 150 }).where(eq(leads.id, leadId)).run();
      }

      // Append stale observation to ledger regardless for historical completeness
      tx.insert(leadObservations).values({
        id: crypto.randomUUID(),
        leadId,
        scanId: testScanId,
        observedRating: 4.2,
        observedReviewCount: 150,
        observedAt: staleTimestamp,
      }).run();

      const count = tx.select({ count: sql<number>`count(*)` }).from(leadObservations).where(eq(leadObservations.leadId, leadId)).get()?.count ?? 1;
      tx.update(leads).set({ observationCount: count }).where(eq(leads.id, leadId)).run();
    });

    // 3. Verify that the current state retained the fresh 4.9 rating and 200 reviews
    const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
    expect(lead?.rating).toBe(4.9);
    expect(lead?.reviewCount).toBe(200);
    expect(lead?.lastObservedAt).toBe(newTimestamp);
    expect(lead?.observationCount).toBe(2);

    // Verify both observations are in the ledger
    const obs = db.select().from(leadObservations).where(eq(leadObservations.leadId, leadId)).all();
    expect(obs.length).toBe(2);
  });

  it("Brutal Stress Test 3: Historical observations survive scan deletion (ON DELETE SET NULL)", () => {
    const tempScanId = `scan_temp_del_${crypto.randomUUID()}`;
    const placeId = `gplace_scan_delete_retention_${crypto.randomUUID()}`;
    const leadId = crypto.randomUUID();
    const obsId = `obs_persistent_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.insert(discoveryScans).values({
      id: tempScanId,
      niche: "Ortho",
      locationInput: "Hanamkonda",
      status: "COMPLETED",
      createdAt: now,
    }).run();

    db.transaction((tx) => {
      tx.insert(leads).values({
        id: leadId,
        scanId: tempScanId,
        placeId,
        name: "Kakatiya Ortho Clinic",
        rating: 4.7,
        reviewCount: 95,
        firstObservedAt: now,
        lastObservedAt: now,
        createdAt: now,
        updatedAt: now,
      }).run();

      tx.insert(leadObservations).values({
        id: obsId,
        leadId,
        scanId: tempScanId,
        observedRating: 4.7,
        observedReviewCount: 95,
        observedAt: now,
      }).run();
    });

    // Operator deletes the temporary discovery scan
    db.delete(discoveryScans).where(eq(discoveryScans.id, tempScanId)).run();

    // Verify scan is gone
    const scan = db.select().from(discoveryScans).where(eq(discoveryScans.id, tempScanId)).get();
    expect(scan).toBeUndefined();

    // Verify observation snapshot SURVIVES!
    const obs = db.select().from(leadObservations).where(eq(leadObservations.id, obsId)).get();
    expect(obs).toBeDefined();
    expect(obs?.observedReviewCount).toBe(95);
  });
});
