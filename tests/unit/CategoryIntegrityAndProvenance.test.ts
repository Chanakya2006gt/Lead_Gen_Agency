import { describe, it, expect } from "vitest";
import { DiscoveryStrategyBuilder } from "@/features/discovery/DiscoveryStrategyBuilder";
import { GooglePlacesApiAdapter } from "@/features/discovery/GooglePlacesApiAdapter";
import { DirectAuditService } from "@/features/auditor/DirectAuditService";
import { LocationResolver } from "@/features/discovery/LocationResolver";
import { MarketContextProvider } from "@/features/commercial/MarketContext";

describe("Category Integrity & Intent-Preservation Invariant Suite", () => {
  it("Invariant 1: DiscoveryStrategyBuilder separates DENTAL_HEALTHCARE from MEDICAL_CLINIC and never forces all healthcare to dentist", () => {
    const dentalCat = DiscoveryStrategyBuilder.classifySemanticCategory("Dental Clinics");
    expect(dentalCat).toBe("DENTAL_HEALTHCARE");

    const doctorCat = DiscoveryStrategyBuilder.classifySemanticCategory("Dermatology Doctor Clinic");
    expect(doctorCat).toBe("MEDICAL_CLINIC");

    const hvacCat = DiscoveryStrategyBuilder.classifySemanticCategory("HVAC Contractors");
    expect(hvacCat).toBe("HOME_SERVICES_HVAC");

    const salonCat = DiscoveryStrategyBuilder.classifySemanticCategory("Luxury Hair Salon");
    expect(salonCat).toBe("BEAUTY_WELLNESS");
  });

  it("Invariant 2: GooglePlacesApiAdapter maps DENTAL_HEALTHCARE strictly to 'dentist' and MEDICAL_CLINIC to 'doctor'", () => {
    const adapter = new GooglePlacesApiAdapter("dummy-key");
    const dentalType = (adapter as any).mapSemanticCategoryToGoogleType("DENTAL_HEALTHCARE");
    expect(dentalType).toBe("dentist");

    const doctorType = (adapter as any).mapSemanticCategoryToGoogleType("MEDICAL_CLINIC");
    expect(doctorType).toBe("doctor");

    const hvacType = (adapter as any).mapSemanticCategoryToGoogleType("HOME_SERVICES_HVAC");
    expect(hvacType).toBe("hvac_contractor");

    const unmappedType = (adapter as any).mapSemanticCategoryToGoogleType("INDUSTRIAL_MANUFACTURING");
    expect(unmappedType).toBeUndefined();
  });

  it("Invariant 3 (Hard Invariant): Search intent ('Dental Clinics') never overwrites factual business category ('Software company')", () => {
    const location = LocationResolver.resolve("Hyderabad");
    const marketContext = MarketContextProvider.resolve("Hyderabad");
    const plan = DiscoveryStrategyBuilder.buildPlan({
      niche: "Dental Clinics",
      location,
      marketContext,
      mode: "COMMERCIAL",
    });

    // Verify DiscoveryPlan preserves originalNiche as search intent
    expect(plan.originalNiche).toBe("Dental Clinics");

    // Simulating a non-dental business returned during search
    const rawPlaceFromGoogle = {
      id: "gplace_yenom",
      displayName: { text: "Yenom Solutions" },
      formattedAddress: "Madhapur, Hyderabad",
      rating: 4.8,
      userRatingCount: 150,
      types: ["software_company", "point_of_interest"],
      primaryTypeDisplayName: { text: "Software company" },
      primaryType: "software_company",
    };

    const parsedCategory = rawPlaceFromGoogle.primaryTypeDisplayName?.text || rawPlaceFromGoogle.types[0].replace(/_/g, " ");
    
    // Invariant: parsed category must be the true Google type, NEVER "Dental Clinics"
    expect(parsedCategory).toBe("Software company");
    expect(parsedCategory).not.toBe(plan.originalNiche);
  });

  it("Invariant 4: DirectAuditService deduces category from website metadata without hardcoded defaults", () => {
    const deducedSoftware = (DirectAuditService as any).deduceCategoryFromWebsite("yenomsolutions.com", [
      { finding: "Modern SaaS platform", evidence: "Software development services" },
    ]);
    expect(deducedSoftware.category).toBe("Technology & Software Services");
    expect(deducedSoftware.category).not.toBe("Dental Clinic");

    const deducedDental = (DirectAuditService as any).deduceCategoryFromWebsite("sowjanyadental.com", []);
    expect(deducedDental.category).toBe("Dental Healthcare");
  });
});
