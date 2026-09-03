import { describe, it, expect } from "vitest";
import { Guardrails, DomainIntegrityViolationError } from "@/core/domain/Guardrails";

describe("Domain Guardrails & Assertion Tests", () => {
  it("assertVerifiedGoogleEvidence: Throws if NOT_VERIFIED evidence contains numeric rating or reviewCount", () => {
    expect(() => {
      Guardrails.assertVerifiedGoogleEvidence({
        status: "NOT_VERIFIED",
        rating: 4.8 as any,
        reviewCount: 120 as any,
        source: "NONE",
      });
    }).toThrow(DomainIntegrityViolationError);

    expect(() => {
      Guardrails.assertVerifiedGoogleEvidence({
        status: "NOT_VERIFIED",
        rating: null,
        reviewCount: null,
        source: "NONE",
      });
    }).not.toThrow();
  });

  it("assertNoDiscoveryIntentLeakage: Throws if categorySource is DISCOVERY_QUERY", () => {
    expect(() => {
      Guardrails.assertNoDiscoveryIntentLeakage("Dental Clinic", "Dental Clinics", "DISCOVERY_QUERY");
    }).toThrow(DomainIntegrityViolationError);

    expect(() => {
      Guardrails.assertNoDiscoveryIntentLeakage("Dental Clinic", "Dental Clinics", "GOOGLE_VERIFIED");
    }).not.toThrow();
  });

  it("assertEvidenceBackedClaim: Throws if outreach text claims Google review metrics for unverified entity", () => {
    expect(() => {
      Guardrails.assertEvidenceBackedClaim("I noticed your 4.8★ Google rating across 120 reviews", {
        status: "NOT_VERIFIED",
        rating: null,
        reviewCount: null,
        source: "NONE",
      });
    }).toThrow(DomainIntegrityViolationError);

    expect(() => {
      Guardrails.assertEvidenceBackedClaim("I noticed your 4.8★ Google rating across 120 reviews", {
        status: "VERIFIED",
        placeId: "p_123",
        googleMapsUrl: "https://maps.google.com/?cid=123",
        rating: 4.8,
        reviewCount: 120,
        source: "GOOGLE_PLACES",
        retrievedAt: new Date().toISOString(),
      });
    }).not.toThrow();
  });

  it("assertNoSyntheticProviderData: Throws if lead contains fake 4.8 / 120 unverified ratings", () => {
    expect(() => {
      Guardrails.assertNoSyntheticProviderData({
        rating: 4.8,
        reviewCount: 120,
        ratingSource: "UNVERIFIED",
      });
    }).toThrow(DomainIntegrityViolationError);

    expect(() => {
      Guardrails.assertNoSyntheticProviderData({
        rating: null,
        reviewCount: null,
        ratingSource: "UNVERIFIED",
      });
    }).not.toThrow();
  });
});
