import { describe, it, expect } from "vitest";
import { SecondaryDomainResolver } from "@/features/discovery/SecondaryDomainResolver";
import { OpportunityClassifier } from "@/features/qualification/OpportunityClassifier";
import { DossierSynthesizer } from "@/features/synthesis/DossierSynthesizer";

describe("SecondaryDomainResolver & GBP Disconnect Suite", () => {
  it("OpportunityClassifier assigns DISCONNECTED_GBP_WEBSITE when isGbpDisconnected is true", () => {
    const opp = OpportunityClassifier.classify({
      hasWebsite: false,
      isGbpDisconnected: true,
      reviewCount: 317,
      rating: 4.9,
    });
    expect(opp).toBe("DISCONNECTED_GBP_WEBSITE");
  });

  it("DossierSynthesizer synthesizes specialized GBP reconnection pitch and scope", async () => {
    const dossier = await DossierSynthesizer.synthesize({
      name: "Sowjanya Dental Hospital",
      category: "Dental Clinics",
      rating: 4.9,
      reviewCount: 317,
      reviewTrend: "GROWING",
      hasWebsite: false,
      isGbpDisconnected: true,
      unlinkedWebsiteUrl: "https://sowjanyadental.in",
      formattedAddress: "Himayatnagar, Hyderabad, Telangana",
      phone: "+91 75056 00600",
    });

    expect(dossier.opportunityType).toBe("DISCONNECTED_GBP_WEBSITE");
    expect(dossier.isGbpDisconnected).toBe(true);
    expect(dossier.unlinkedWebsiteUrl).toBe("https://sowjanyadental.in");
    expect(dossier.recommendedPitch.coreAngle).toContain("sowjanyadental.in");
    expect(dossier.recommendedPitch.suggestedScope).toContain("Google Business Profile");
    expect(dossier.identifiedBottlenecks.some(b => b.includes("Disconnected Google Business Profile"))).toBe(true);
  });

  it("verifyEntityProof rejects false positive domains when neither phone nor city match", async () => {
    // Calling verifyEntityProof with an unrelated domain should fail verification
    const proof = await SecondaryDomainResolver.verifyEntityProof("https://example.com", {
      name: "Sowjanya Dental Hospital",
      formattedAddress: "Warangal, Telangana",
      phone: "+91 99999 88888",
    });

    expect(proof.verified).toBe(false);
  });
});
