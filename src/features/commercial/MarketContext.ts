import { GeographicSignal } from "@/features/discovery/types";

export interface IndustryVocabularyContext {
  clinicTerms: string[];
  serviceTerms: string[];
  commercialDescriptors: string[];
}

export interface MarketContextResult {
  geography: string;
  country: "IN" | "US" | "AE" | "GB" | "OTHER";
  currency: "INR" | "USD" | "AED" | "GBP";
  cityTier: "TIER_1" | "TIER_2" | "TIER_3" | "INTERNATIONAL_METRO" | "UNKNOWN";
  wageIndexMultiplier: number;
  confidence: number;
  geographicSignals: GeographicSignal[];
  vocabulary: IndustryVocabularyContext;
  isFallbackPrior: boolean;
}

export class MarketContextProvider {
  // Provenance-backed Seed Signals for Known Metros
  private static readonly METRO_GEOGRAPHIC_SIGNALS: Record<string, GeographicSignal[]> = {
    hyderabad: [
      { name: "Jubilee Hills", type: "COMMERCIAL_ZONE", confidence: 0.95, source: "SEED_DATA" },
      { name: "Banjara Hills", type: "COMMERCIAL_ZONE", confidence: 0.95, source: "SEED_DATA" },
      { name: "Gachibowli", type: "MICRO_HUB", confidence: 0.9, source: "SEED_DATA" },
      { name: "Madhapur", type: "MICRO_HUB", confidence: 0.9, source: "SEED_DATA" },
      { name: "Kondapur", type: "SUBDISTRICT", confidence: 0.85, source: "SEED_DATA" },
    ],
    bengaluru: [
      { name: "Indiranagar", type: "COMMERCIAL_ZONE", confidence: 0.95, source: "SEED_DATA" },
      { name: "Koramangala", type: "COMMERCIAL_ZONE", confidence: 0.95, source: "SEED_DATA" },
      { name: "HSR Layout", type: "MICRO_HUB", confidence: 0.9, source: "SEED_DATA" },
      { name: "Whitefield", type: "SUBDISTRICT", confidence: 0.9, source: "SEED_DATA" },
    ],
    mumbai: [
      { name: "Bandra West", type: "COMMERCIAL_ZONE", confidence: 0.95, source: "SEED_DATA" },
      { name: "Andheri West", type: "MICRO_HUB", confidence: 0.9, source: "SEED_DATA" },
      { name: "Juhu", type: "COMMERCIAL_ZONE", confidence: 0.95, source: "SEED_DATA" },
      { name: "Powai", type: "SUBDISTRICT", confidence: 0.85, source: "SEED_DATA" },
    ],
    delhi: [
      { name: "South Extension", type: "COMMERCIAL_ZONE", confidence: 0.95, source: "SEED_DATA" },
      { name: "Connaught Place", type: "COMMERCIAL_ZONE", confidence: 0.95, source: "SEED_DATA" },
      { name: "Vasant Kunj", type: "SUBDISTRICT", confidence: 0.9, source: "SEED_DATA" },
      { name: "Gurgaon Sector 29", type: "MICRO_HUB", confidence: 0.9, source: "SEED_DATA" },
    ],
    warangal: [
      { name: "Hanamkonda", type: "MICRO_HUB", confidence: 0.95, source: "SEED_DATA" },
      { name: "Subedari", type: "SUBDISTRICT", confidence: 0.9, source: "SEED_DATA" },
      { name: "Kazipet", type: "SUBDISTRICT", confidence: 0.85, source: "SEED_DATA" },
    ],
    dallas: [
      { name: "Uptown", type: "COMMERCIAL_ZONE", confidence: 0.95, source: "SEED_DATA" },
      { name: "Highland Park", type: "COMMERCIAL_ZONE", confidence: 0.95, source: "SEED_DATA" },
      { name: "Plano", type: "SUBDISTRICT", confidence: 0.9, source: "SEED_DATA" },
      { name: "Frisco", type: "SUBDISTRICT", confidence: 0.9, source: "SEED_DATA" },
    ],
    dubai: [
      { name: "Downtown Dubai", type: "COMMERCIAL_ZONE", confidence: 0.95, source: "SEED_DATA" },
      { name: "Dubai Marina", type: "COMMERCIAL_ZONE", confidence: 0.95, source: "SEED_DATA" },
      { name: "Jumeirah", type: "SUBDISTRICT", confidence: 0.9, source: "SEED_DATA" },
    ],
    london: [
      { name: "Marylebone", type: "COMMERCIAL_ZONE", confidence: 0.95, source: "SEED_DATA" },
      { name: "Harley Street", type: "COMMERCIAL_ZONE", confidence: 0.98, source: "SEED_DATA" },
      { name: "Kensington", type: "SUBDISTRICT", confidence: 0.9, source: "SEED_DATA" },
    ],
  };

  private static readonly INDIA_VOCABULARY: IndustryVocabularyContext = {
    clinicTerms: ["Hospital", "Hospital & Research Centre", "Clinic", "Care Center", "Speciality Clinic"],
    serviceTerms: ["Consultant", "Specialist", "Aesthetics", "Surgeon"],
    commercialDescriptors: ["Multispeciality", "Super Speciality", "Private", "Dental Care"],
  };

  private static readonly US_VOCABULARY: IndustryVocabularyContext = {
    clinicTerms: ["Practice", "Dental Group", "Care Center", "Office", "Associates"],
    serviceTerms: ["Dentistry", "Specialists", "Aesthetics", "Surgery"],
    commercialDescriptors: ["Family & Cosmetic", "Comprehensive", "Private Practice"],
  };

  public static resolve(locationInput?: string | null): MarketContextResult {
    const raw = (locationInput || "").toLowerCase().trim();

    if (!raw) {
      return {
        geography: "National Baseline",
        country: "IN",
        currency: "INR",
        cityTier: "TIER_1",
        wageIndexMultiplier: 1.0,
        confidence: 0.5,
        geographicSignals: [],
        vocabulary: this.INDIA_VOCABULARY,
        isFallbackPrior: true,
      };
    }

    // Match Geographic Signals
    let signals: GeographicSignal[] = [];
    for (const [key, sigs] of Object.entries(this.METRO_GEOGRAPHIC_SIGNALS)) {
      if (raw.includes(key)) {
        signals = sigs;
        break;
      }
    }

    // UAE Check
    if (raw.includes("dubai") || raw.includes("uae") || raw.includes("emirates") || raw.includes("abu dhabi")) {
      return {
        geography: locationInput || "United Arab Emirates",
        country: "AE",
        currency: "AED",
        cityTier: "INTERNATIONAL_METRO",
        wageIndexMultiplier: 1.3,
        confidence: 0.9,
        geographicSignals: signals,
        vocabulary: this.US_VOCABULARY,
        isFallbackPrior: false,
      };
    }

    // UK Check
    if (raw.includes("london") || raw.includes("uk") || raw.includes("united kingdom") || raw.includes("england")) {
      return {
        geography: locationInput || "United Kingdom",
        country: "GB",
        currency: "GBP",
        cityTier: "INTERNATIONAL_METRO",
        wageIndexMultiplier: 1.25,
        confidence: 0.9,
        geographicSignals: signals,
        vocabulary: this.US_VOCABULARY,
        isFallbackPrior: false,
      };
    }

    // US Check
    if (/dallas|austin|houston|phoenix|seattle|san francisco|chicago|los angeles|united states|usa|\btx\b|\bca\b|\bny\b|\bfl\b/.test(raw)) {
      return {
        geography: locationInput || "United States",
        country: "US",
        currency: "USD",
        cityTier: "INTERNATIONAL_METRO",
        wageIndexMultiplier: 1.4,
        confidence: 0.9,
        geographicSignals: signals,
        vocabulary: this.US_VOCABULARY,
        isFallbackPrior: false,
      };
    }

    // India Tier 1 Check
    const tier1Keys = ["hyderabad", "bengaluru", "bangalore", "mumbai", "delhi", "chennai", "kolkata", "pune", "ahmedabad"];
    if (tier1Keys.some((k) => raw.includes(k))) {
      return {
        geography: locationInput || "India Metro",
        country: "IN",
        currency: "INR",
        cityTier: "TIER_1",
        wageIndexMultiplier: 1.0,
        confidence: 0.95,
        geographicSignals: signals,
        vocabulary: this.INDIA_VOCABULARY,
        isFallbackPrior: false,
      };
    }

    // India Tier 2 / Regional Check
    const tier2Keys = ["warangal", "hanamkonda", "vijayawada", "visakhapatnam", "vizag", "coimbatore", "kochi", "jaipur", "indore"];
    if (tier2Keys.some((k) => raw.includes(k))) {
      return {
        geography: locationInput || "India Regional",
        country: "IN",
        currency: "INR",
        cityTier: "TIER_2",
        wageIndexMultiplier: 0.8,
        confidence: 0.9,
        geographicSignals: signals,
        vocabulary: this.INDIA_VOCABULARY,
        isFallbackPrior: false,
      };
    }

    // General India Check
    if (/india|telangana|andhra|karnataka|maharashtra|tamil nadu|delhi|gujarat|kerala/.test(raw)) {
      return {
        geography: locationInput || "India",
        country: "IN",
        currency: "INR",
        cityTier: "TIER_3",
        wageIndexMultiplier: 0.75,
        confidence: 0.7,
        geographicSignals: [],
        vocabulary: this.INDIA_VOCABULARY,
        isFallbackPrior: false,
      };
    }

    // Unknown Market Fallback: Zero fabricated signals, conservative confidence
    return {
      geography: locationInput || "Unknown Market",
      country: "OTHER",
      currency: "USD",
      cityTier: "UNKNOWN",
      wageIndexMultiplier: 1.0,
      confidence: 0.25,
      geographicSignals: [],
      vocabulary: this.US_VOCABULARY,
      isFallbackPrior: true,
    };
  }
}
