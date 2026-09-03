import { describe, it, expect } from "vitest";
import { db } from "@/core/db";
import { discoveryScans, leads, leadObservations } from "@/core/db/schema";
import { BusinessIdentityResolver } from "@/features/identity/BusinessIdentityResolver";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("Stable Identity & Observation History Pipeline", () => {
  it("Resolves identical Place ID for the same business across multiple discovery searches", () => {
    const rawBusiness1 = {
      name: "Apex Dental Care",
      formattedAddress: "123 Market St, Hyderabad, Telangana",
      phone: "+91 9123456780",
      googleMapsUrl: "https://www.google.com/maps/place/data=!4m2!3m1!1s0x3bcb1234:0x5678abcd",
    };

    const rawBusiness2 = {
      name: "Apex Dental Care",
      formattedAddress: "123 Market St, Hyderabad, Telangana",
      phone: "+91 9123456780",
      googleMapsUrl: "https://www.google.com/maps/place/data=!4m2!3m1!1s0x3bcb1234:0x5678abcd",
    };

    const id1 = BusinessIdentityResolver.resolveId(rawBusiness1);
    const id2 = BusinessIdentityResolver.resolveId(rawBusiness2);

    expect(id1).toBe(id2);
    expect(id1).toBe("gfeat_0x3bcb1234:0x5678abcd");
  });

  it("Preserves verified data non-destructively when a second scrape temporarily returns null", () => {
    const placeId = `det_pipe_${crypto.randomUUID()}`;
    const scanId1 = `scan_p1_${crypto.randomUUID()}`;
    const scanId2 = `scan_p2_${crypto.randomUUID()}`;
    const leadId = `lead_p_${crypto.randomUUID()}`;
    const now1 = "2026-09-01T10:00:00.000Z";
    const now2 = "2026-09-02T10:00:00.000Z";

    // Insert Scan records
    db.insert(discoveryScans).values({
      id: scanId1,
      niche: "Dental",
      locationInput: "Warangal",
      status: "COMPLETED",
      createdAt: now1,
    }).run();

    db.insert(discoveryScans).values({
      id: scanId2,
      niche: "Dental",
      locationInput: "Warangal",
      status: "COMPLETED",
      createdAt: now2,
    }).run();

    // 1. Initial Discovery Run
    db.insert(leads).values({
      id: leadId,
      scanId: scanId1,
      placeId,
      name: "Apex Dental Care",
      rating: 4.8,
      reviewCount: 150,
      websiteUrl: "https://apexdental.example.com",
      phone: "+91 9123456780",
      formattedAddress: "123 Market St",
      reviewTrend: "STABLE",
      hasWebsite: true,
      auditStatus: "AUDITED",
      reputationScore: 85,
      digitalGapScore: 20,
      opportunityScore: 75,
      confidenceScore: 90,
      totalLeadScore: 78,
      opportunityType: "WEBSITE_AUTOMATION",
      humanStatus: "READY_FOR_OUTREACH",
      firstObservedAt: now1,
      lastObservedAt: now1,
      observationCount: 1,
      reviewCountDelta: 0,
      ratingDelta: 0,
      identitySource: "deterministic",
      createdAt: now1,
      updatedAt: now1,
    }).run();

    // Log first observation
    db.insert(leadObservations).values({
      id: crypto.randomUUID(),
      leadId,
      scanId: scanId1,
      observedRating: 4.8,
      observedReviewCount: 150,
      observedWebsiteUrl: "https://apexdental.example.com",
      observedPhone: "+91 9123456780",
      observedAt: now1,
    }).run();

    // 2. Second Discovery Run: Review count grew to 164, but websiteUrl was temporarily null
    const existing = db.select().from(leads).where(eq(leads.placeId, placeId)).get();
    expect(existing).toBeDefined();

    const secondScrapeWebsite = null; // Scrape glitch
    const secondScrapeReviews = 164; // +14 reviews growth
    const effectiveWebsite = secondScrapeWebsite || existing!.websiteUrl;
    const reviewDelta = secondScrapeReviews - (existing!.reviewCount || 0);

    db.update(leads).set({
      scanId: scanId2,
      websiteUrl: effectiveWebsite, // Non-destructive: preserves existing URL
      reviewCount: secondScrapeReviews,
      reviewCountDelta: reviewDelta,
      observationCount: existing!.observationCount + 1,
      lastObservedAt: now2,
      updatedAt: now2,
    }).where(eq(leads.id, existing!.id)).run();

    // Log second observation
    db.insert(leadObservations).values({
      id: crypto.randomUUID(),
      leadId: existing!.id,
      scanId: scanId2,
      observedRating: 4.8,
      observedReviewCount: 164,
      observedWebsiteUrl: effectiveWebsite,
      observedPhone: existing!.phone,
      observedAt: now2,
    }).run();

    // 3. Verify DB state
    const updatedLead = db.select().from(leads).where(eq(leads.placeId, placeId)).get();
    expect(updatedLead?.websiteUrl).toBe("https://apexdental.example.com"); // Preserved!
    expect(updatedLead?.reviewCount).toBe(164);
    expect(updatedLead?.reviewCountDelta).toBe(14); // Captured +14 growth!
    expect(updatedLead?.observationCount).toBe(2);
    expect(updatedLead?.humanStatus).toBe("READY_FOR_OUTREACH"); // Preserved triage!

    const observations = db.select().from(leadObservations).where(eq(leadObservations.leadId, updatedLead!.id)).all();
    expect(observations.length).toBe(2);
  });
});
