import {
  DiscoveryBudget,
  DiscoveryMode,
  DiscoveryPlan,
  QueryIntent,
  QueryVariant,
  ResolvedLocation,
  SemanticCategory,
} from "./types";
import { MarketContextResult } from "@/features/commercial/MarketContext";

interface NicheTaxonomyRule {
  category: SemanticCategory;
  categoryEquivalents: string[];
  commercialVariants: string[];
  serviceSpecialties: { query: string; specialty: string }[];
  prohibitedExclusions: string[];
}

export class DiscoveryStrategyBuilder {
  private static readonly TAXONOMY_RULES: Record<string, NicheTaxonomyRule> = {
    dental: {
      category: "DENTAL_HEALTHCARE",
      categoryEquivalents: ["Dentists", "Dental Hospital"],
      commercialVariants: ["Private Dental Clinic", "Multispeciality Dental Clinic"],
      serviceSpecialties: [
        { query: "Dental Implants", specialty: "IMPLANTS" },
        { query: "Orthodontics", specialty: "ORTHODONTICS" },
        { query: "Cosmetic Dentistry", specialty: "COSMETIC" },
      ],
      prohibitedExclusions: ["college", "school", "university", "equipment", "supplies", "distributor", "association"],
    },
    medical: {
      category: "MEDICAL_CLINIC",
      categoryEquivalents: ["Doctors", "Speciality Clinics", "Polyclinics"],
      commercialVariants: ["Private Medical Clinic", "Specialist Consultation Center"],
      serviceSpecialties: [
        { query: "Cardiology Consultation", specialty: "CARDIOLOGY" },
        { query: "Dermatology Specialist", specialty: "DERMATOLOGY" },
      ],
      prohibitedExclusions: ["college", "civil hospital", "phc", "dispensary"],
    },
    hvac: {
      category: "HOME_SERVICES_HVAC",
      categoryEquivalents: ["HVAC Contractors", "Air Conditioning Services"],
      commercialVariants: ["Commercial HVAC Services", "Emergency HVAC Contractors"],
      serviceSpecialties: [
        { query: "Commercial Refrigeration", specialty: "REFRIGERATION" },
        { query: "Heating System Installation", specialty: "HEATING" },
      ],
      prohibitedExclusions: ["parts warehouse", "wholesale", "training institute"],
    },
    roofing: {
      category: "HOME_SERVICES_ROOFING",
      categoryEquivalents: ["Roofing Contractors", "Roof Replacement Specialists"],
      commercialVariants: ["Commercial Roofing Contractors", "Residential Roofing Specialists"],
      serviceSpecialties: [
        { query: "Metal Roofing Installation", specialty: "METAL_ROOFING" },
        { query: "Flat Roof Repair", specialty: "FLAT_ROOFING" },
      ],
      prohibitedExclusions: ["supplies", "materials depot", "wholesale"],
    },
    salon: {
      category: "BEAUTY_WELLNESS",
      categoryEquivalents: ["Hair Salons", "Beauty Parlours"],
      commercialVariants: ["Luxury Hair & Skin Salon", "Premium Beauty Studio"],
      serviceSpecialties: [
        { query: "Skin & Hair Aesthetics", specialty: "AESTHETICS" },
        { query: "Bridal Makeup Studio", specialty: "BRIDAL" },
      ],
      prohibitedExclusions: ["academy", "institute", "wholesale cosmetics"],
    },
    manufacturing: {
      category: "INDUSTRIAL_MANUFACTURING",
      categoryEquivalents: ["Precision Engineering", "Industrial Component Manufacturers"],
      commercialVariants: ["Industrial Fabrication Works", "CNC Machining Job Shop"],
      serviceSpecialties: [
        { query: "Heavy Forgings", specialty: "FORGINGS" },
        { query: "Custom Sheet Metal Fabrication", specialty: "FABRICATION" },
      ],
      prohibitedExclusions: ["college", "textbook", "association"],
    },
  };

  /**
   * Classify user niche into precise semantic category
   */
  public static classifySemanticCategory(niche: string): SemanticCategory {
    const raw = niche.toLowerCase();
    if (/dent/.test(raw)) return "DENTAL_HEALTHCARE";
    if (/clinic|doctor|hospital|physio|derma|health|medical/.test(raw)) return "MEDICAL_CLINIC";
    if (/hvac|ac repair|air condition/.test(raw)) return "HOME_SERVICES_HVAC";
    if (/roof/.test(raw)) return "HOME_SERVICES_ROOFING";
    if (/plumb/.test(raw)) return "HOME_SERVICES_PLUMBING";
    if (/salon|beauty|spa|hair|aesthetics|makeup/.test(raw)) return "BEAUTY_WELLNESS";
    if (/manufactur|machin|fabricat|industrial|forging|engineering/.test(raw)) return "INDUSTRIAL_MANUFACTURING";
    if (/law|legal|attorney|account|audit|cpa/.test(raw)) return "PROFESSIONAL_LEGAL";
    if (/hotel|restaurant|cafe|bakery|catering/.test(raw)) return "HOSPITALITY_FOOD";
    if (/auto|car repair|mechanic|garage|body shop/.test(raw)) return "AUTOMOTIVE_SERVICES";
    return "GENERAL_COMMERCIAL";
  }

  /**
   * Build a bounded, evidence-backed DiscoveryPlan
   */
  public static buildPlan(params: {
    niche: string;
    location: ResolvedLocation;
    marketContext: MarketContextResult;
    mode?: DiscoveryMode;
  }): DiscoveryPlan {
    const mode: DiscoveryMode = params.mode || "STANDARD";
    const niche = params.niche.trim();
    const locationName = params.location.canonicalName || params.location.input || "Local Market";
    const semanticCategory = this.classifySemanticCategory(niche);

    // 1. Determine Discovery Budget by Mode
    const budget: DiscoveryBudget = this.getBudget(mode);

    // 2. Resolve Taxonomy & Rule Set
    const ruleKey = Object.keys(this.TAXONOMY_RULES).find((k) => niche.toLowerCase().includes(k));
    const taxonomy = ruleKey ? this.TAXONOMY_RULES[ruleKey] : null;

    const candidateQueries: QueryVariant[] = [];

    // Priority 1: User Explicit Query
    candidateQueries.push({
      textQuery: `${niche} in ${locationName}`,
      intent: "USER_EXPLICIT",
      priority: 1,
      source: "USER_INPUT",
      semanticCategory,
    });

    if (taxonomy) {
      // Priority 2: Category Equivalents (e.g. Dentists, Dental Hospital)
      const maxEq = mode === "STANDARD" ? 1 : 2;
      for (const eq of taxonomy.categoryEquivalents.slice(0, maxEq)) {
        if (!candidateQueries.some((q) => q.textQuery.toLowerCase().includes(eq.toLowerCase()))) {
          candidateQueries.push({
            textQuery: `${eq} in ${locationName}`,
            intent: "CATEGORY_EQUIVALENT",
            priority: 2,
            source: "MARKET_CONTEXT",
            semanticCategory,
          });
        }
      }

      // Priority 3: High-Intent Commercial Variants
      if (mode !== "STANDARD") {
        const maxComm = mode === "COMMERCIAL" ? 1 : 2;
        for (const comm of taxonomy.commercialVariants.slice(0, maxComm)) {
          candidateQueries.push({
            textQuery: `${comm} in ${locationName}`,
            intent: "HIGH_INTENT_COMMERCIAL",
            priority: 3,
            source: "COMMERCIAL_EXPANSION",
            semanticCategory,
          });
        }
      }

      // Priority 4: Service Specialties (Intent-Preserving, e.g. Dental Implants)
      if (mode !== "STANDARD") {
        const maxSpec = mode === "COMMERCIAL" ? 1 : 2;
        for (const spec of taxonomy.serviceSpecialties.slice(0, maxSpec)) {
          candidateQueries.push({
            textQuery: `${spec.query} in ${locationName}`,
            intent: "SERVICE_SPECIALTY",
            priority: 4,
            source: "COMMERCIAL_EXPANSION",
            semanticCategory,
            specialty: spec.specialty,
          });
        }
      }
    }

    // Priority 5: Geographic Micro-Hub Sweeps (Only if valid coordinates and geographic signals exist)
    if (mode === "EXHAUSTIVE" && params.location.latitude !== null && params.marketContext.geographicSignals.length > 0) {
      const topHubs = params.marketContext.geographicSignals.slice(0, budget.maxGeographicTargets);
      for (const hub of topHubs) {
        candidateQueries.push({
          textQuery: `${niche} in ${hub.name}, ${locationName}`,
          intent: "GEOGRAPHIC_MICRO_HUB",
          priority: 5,
          source: "MARKET_CONTEXT",
          semanticCategory,
          subDistrict: hub.name,
        });
      }
    }

    // Sort by priority and clamp strictly to budget.maxQueries
    const prioritizedQueries = candidateQueries
      .sort((a, b) => a.priority - b.priority)
      .slice(0, budget.maxQueries);

    return {
      originalNiche: niche,
      mode,
      location: params.location,
      marketContext: params.marketContext,
      queries: prioritizedQueries,
      budget,
      providerOptimizationFilters: {
        minRating: 3.8, // Quota guardrail only
      },
      createdAt: new Date().toISOString(),
    };
  }

  private static getBudget(mode: DiscoveryMode): DiscoveryBudget {
    switch (mode) {
      case "STANDARD":
        return {
          maxQueries: 2,
          maxProviderCalls: 2,
          maxResultsPerQuery: 20,
          maxTotalCandidates: 30,
          maxGeographicTargets: 0,
        };
      case "COMMERCIAL":
        return {
          maxQueries: 5,
          maxProviderCalls: 5,
          maxResultsPerQuery: 20,
          maxTotalCandidates: 60,
          maxGeographicTargets: 2,
        };
      case "EXHAUSTIVE":
        return {
          maxQueries: 8,
          maxProviderCalls: 10,
          maxResultsPerQuery: 20,
          maxTotalCandidates: 120,
          maxGeographicTargets: 4,
        };
    }
  }
}
