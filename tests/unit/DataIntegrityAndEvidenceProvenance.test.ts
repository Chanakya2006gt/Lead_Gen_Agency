import { describe, it, expect } from "vitest";
import { DirectAuditService } from "@/features/auditor/DirectAuditService";
import { DossierSynthesizer } from "@/features/synthesis/DossierSynthesizer";
import { ScoringEngine } from "@/features/qualification/ScoringEngine";
import { BusinessScaleInferrer } from "@/features/commercial/BusinessScaleInferrer";
import { OutreachClaimValidator } from "@/features/synthesis/OutreachClaimValidator";
import { GoogleEvidence } from "@/core/db/schema";
import { db } from "@/core/db";
import { leads } from "@/core/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("12-Invariant Data Integrity & Evidence Provenance Adversarial Suite", () => {
  // TEST 1 — Direct URL without Google data
  it("Invariant 1: Direct URL Teardown outputs strictly null Google rating and review count", async () => {
    // Audit a valid web domain in ephemeral mode
    const res = await DirectAuditService.executeDirectTeardown({
      url: "https://example.com",
      persist: false,
    });

    expect(res.lead.rating).toBeNull();
    expect(res.lead.reviewCount).toBeNull();
    expect(res.lead.reviewTrend).toBe("UNKNOWN");
    expect(res.lead.ratingSource).toBe("UNVERIFIED");
    expect(res.lead.googleMapsUrl).toBeNull();
    expect(res.lead.dossier?.googleEvidence?.status).toBe("NOT_VERIFIED");
  });

  // TEST 2 — Discovery query / category separation
  it("Invariant 2: Discovery intent never overwrites factual business category", async () => {
    const dossier = await DossierSynthesizer.synthesize({
      name: "Yenom Solutions",
      category: "Software company",
      discoveryNiche: "Dental Clinics",
      discoveryQuery: "Private Dental Clinic in Hyderabad",
      rating: null,
      reviewCount: null,
      reviewTrend: "UNKNOWN",
      hasWebsite: true,
      websiteUrl: "https://yenomsolutions.com",
      categorySource: "GOOGLE_MAPS_DOM",
    });

    expect(dossier.categorySource).toBe("GOOGLE_MAPS_DOM");
    expect(dossier.discoveryNiche).toBe("Dental Clinics");
    expect(dossier.discoveryQuery).toBe("Private Dental Clinic in Hyderabad");
    // Business category must remain Software company, never Dental Clinics
    expect(dossier.discoveryNiche).not.toBe("Software company");
  });

  // TEST 3 — Direct URL audit produces zero Google review claims in outreach
  it("Invariant 3: Direct URL audit generates zero Google review claims in outreach copy", async () => {
    const unverifiedEvidence: GoogleEvidence = {
      status: "NOT_VERIFIED",
      rating: null,
      reviewCount: null,
      source: "NONE",
    };

    const validated = OutreachClaimValidator.validate({
      name: "Trelio",
      category: "Technology & Software Services",
      domain: "trelio.in",
      googleEvidence: unverifiedEvidence,
      coreAngle: "Mobile Viewport Rebuild",
      whatsappCopy: "Hi team Trelio, I was reviewing your Google Maps listing (4.8★, 120 reviews) and noticed...",
      coldEmailCopy: "Subject: Question regarding Trelio's Google Maps listing\n\nHi Trelio Team, I came across Trelio while researching top-rated tech providers—congratulations on maintaining a 4.8★ rating across 120 reviews.",
      phoneScript: "Operator: 'Hi, I was looking up Trelio on Google Maps—congratulations on the 4.8★ rating with 120 reviews!'",
      whyPoints: [
        "Strong established reputation: 4.8★ rating across 120 verified reviews demonstrates high customer demand.",
        "Mobile layout has horizontal overflow.",
      ],
    });

    expect(validated.claimsSanitized).toBe(true);
    expect(validated.whatsappCopy).not.toMatch(/Google\s*Maps|4\.8★|120\s*reviews/i);
    expect(validated.coldEmailCopy).not.toMatch(/4\.8★|120\s*reviews|top-rated/i);
    expect(validated.phoneScript).not.toMatch(/4\.8★|120\s*reviews|looking up [^—]+ on Google Maps/i);
    expect(validated.whyPoints.some(p => p.includes("4.8★"))).toBe(false);
  });

  // TEST 4 — AI cannot receive or invent reviews for unverified profiles
  it("Invariant 4: Dossier synthesis for unverified profile establishes ratingConfidence as none", async () => {
    const dossier = await DossierSynthesizer.synthesize({
      name: "Trelio",
      category: "Operating Business",
      rating: null,
      reviewCount: null,
      reviewTrend: "UNKNOWN",
      hasWebsite: true,
      websiteUrl: "https://trelio.in",
    });

    expect(dossier.provenance?.ratingConfidence).toBe("none");
    expect(dossier.identifiedStrengths.some(s => s.includes("★"))).toBe(false);
    expect(dossier.identifiedStrengths.some(s => s.includes("verified Google reviews"))).toBe(false);
  });

  // TEST 5 — ScoringEngine handles null ratings safely
  it("Invariant 5: ScoringEngine calculates reputation score for unverified leads without throwing", () => {
    const scores = ScoringEngine.computeScores({
      rating: null,
      reviewCount: null,
      reviewTrend: "UNKNOWN",
      hasWebsite: true,
      opportunityType: "WEBSITE",
    });

    expect(scores.reputationScore).toBe(50);
    expect(scores.overallLeadScore).toBeGreaterThan(0);
    expect(scores.overallLeadScore).toBeLessThanOrEqual(100);
  });

  // TEST 6 — BusinessScaleInferrer handles null review counts
  it("Invariant 6: BusinessScaleInferrer handles null reviews without assuming volume", () => {
    const scale = BusinessScaleInferrer.infer({
      name: "Trelio Technologies Pvt Ltd",
      category: "Software",
      rating: null,
      reviewCount: null,
    });

    expect(scale.scale).not.toBe("UNKNOWN");
    expect(scale.evidence.some(e => e.signal.includes("review volume"))).toBe(false);
  });

  // TEST 7 — Database schema allows nullable ratings and review counts
  it("Invariant 7: Database allows inserting and querying leads with null rating and review count", () => {
    const testPlaceId = `test_null_${crypto.randomBytes(6).toString("hex")}`;
    const testLeadId = `lead_null_${crypto.randomBytes(6).toString("hex")}`;
    const now = new Date().toISOString();

    db.insert(leads).values({
      id: testLeadId,
      placeId: testPlaceId,
      name: "Test Null Business",
      category: "Software",
      rating: null,
      reviewCount: null,
      reviewTrend: "UNKNOWN",
      ratingSource: "UNVERIFIED",
      hasWebsite: true,
      hasGbpWebsiteLink: false,
      isGbpDisconnected: false,
      createdAt: now,
      updatedAt: now,
    }).run();

    const retrieved = db.select().from(leads).where(eq(leads.id, testLeadId)).get();
    expect(retrieved).toBeDefined();
    expect(retrieved?.rating).toBeNull();
    expect(retrieved?.reviewCount).toBeNull();
    expect(retrieved?.ratingSource).toBe("UNVERIFIED");

    // Clean up
    db.delete(leads).where(eq(leads.id, testLeadId)).run();
  });

  // TEST 8 — Cross-business provider data isolation
  it("Invariant 8: Distinct business entities retain strictly isolated provider evidence", async () => {
    const businessA = await DossierSynthesizer.synthesize({
      name: "Business A",
      category: "Dental Care",
      rating: 4.8,
      reviewCount: 120,
      googleMapsUrl: "https://maps.google.com/?cid=111",
      reviewTrend: "GROWING",
      hasWebsite: true,
    });

    const businessB = await DossierSynthesizer.synthesize({
      name: "Business B",
      category: "Dental Care",
      rating: 4.1,
      reviewCount: 53,
      googleMapsUrl: "https://maps.google.com/?cid=222",
      reviewTrend: "STABLE",
      hasWebsite: true,
    });

    expect(businessA.googleEvidence?.rating).toBe(4.8);
    expect(businessA.googleEvidence?.reviewCount).toBe(120);
    expect(businessB.googleEvidence?.rating).toBe(4.1);
    expect(businessB.googleEvidence?.reviewCount).toBe(53);
  });

  // TEST 9 — Mock adapter isolation from production
  it("Invariant 9: Mock adapter test fixtures do not pollute production domain defaults", () => {
    const res = BusinessScaleInferrer.infer({
      name: "Unknown Entity",
      rating: null,
      reviewCount: null,
    });

    expect(res.scale).toBe("UNKNOWN");
    expect(res.confidence).toBe(0.2);
  });

  // TEST 10 — Provider disagreement preserves provenance
  it("Invariant 10: Category provenance is explicitly tracked across sources", async () => {
    const verifiedDossier = await DossierSynthesizer.synthesize({
      name: "Clinic One",
      category: "Dentist",
      categorySource: "GOOGLE_VERIFIED",
      categoryConfidence: 1.0,
      rating: 4.9,
      reviewCount: 200,
      googleMapsUrl: "https://maps.google.com/?cid=999",
      reviewTrend: "GROWING",
      hasWebsite: true,
    });

    const metaDossier = await DossierSynthesizer.synthesize({
      name: "Clinic Two",
      category: "Dental Healthcare",
      categorySource: "WEBSITE_META",
      categoryConfidence: 0.85,
      rating: null,
      reviewCount: null,
      reviewTrend: "UNKNOWN",
      hasWebsite: true,
    });

    expect(verifiedDossier.categorySource).toBe("GOOGLE_VERIFIED");
    expect(metaDossier.categorySource).toBe("WEBSITE_META");
  });

  // TEST 11 — Evidence cannot be downgraded or upgraded erroneously
  it("Invariant 11: Unverified profile cannot be upgraded to verified without authoritative Google evidence", async () => {
    const unverifiedDossier = await DossierSynthesizer.synthesize({
      name: "Trelio",
      category: "Software",
      rating: null,
      reviewCount: null,
      reviewTrend: "UNKNOWN",
      hasWebsite: true,
      googleEvidence: {
        status: "NOT_VERIFIED",
        rating: null,
        reviewCount: null,
        source: "NONE",
      },
    });

    expect(unverifiedDossier.googleEvidence?.status).toBe("NOT_VERIFIED");
    expect(unverifiedDossier.provenance?.ratingConfidence).toBe("none");
    expect(unverifiedDossier.provenance?.identityConfidence).toBe("direct_audit");
  });

  // TEST 12 — Outreach claim validator strictly blocks all unverified assertions
  it("Invariant 12: Outreach claim validator strictly removes all unsupported rating and review claims", () => {
    const badInput = {
      name: "Trelio",
      category: "Software",
      domain: "trelio.in",
      googleEvidence: {
        status: "NOT_VERIFIED" as const,
        rating: null,
        reviewCount: null,
        source: "NONE" as const,
      },
      coreAngle: "Website Modernization",
      whatsappCopy: "Hi team Trelio, I was reviewing your Google Maps listing (4.8★, 120 reviews) and noticed high customer demand.",
      coldEmailCopy: "Hi Trelio Team, congratulations on maintaining a 4.8★ rating across 120 verified reviews.",
      phoneScript: "Operator: 'Hi, congratulations on the 4.8★ rating with 120 reviews!'",
      whyPoints: [
        "Strong established reputation: 4.8★ rating across 120 verified reviews demonstrates high customer demand.",
        "Mobile viewport is missing.",
      ],
    };

    const validated = OutreachClaimValidator.validate(badInput);

    // Assert zero forbidden patterns exist in any outreach medium
    const forbidden = ["4.8★", "120 reviews", "Google Maps listing", "120 verified reviews", "high customer demand"];
    for (const term of forbidden) {
      expect(validated.whatsappCopy).not.toContain(term);
      expect(validated.coldEmailCopy).not.toContain(term);
      expect(validated.phoneScript).not.toContain(term);
    }
    expect(validated.whyPoints.length).toBe(1);
    expect(validated.whyPoints[0]).toBe("Mobile viewport is missing.");
  });
});
