export interface MarketContextResult {
  geography: string;
  country: "IN" | "US" | "AE" | "GB" | "OTHER";
  currency: "INR" | "USD" | "AED" | "GBP" | "USD";
  cityTier: "TIER_1" | "TIER_2" | "TIER_3" | "INTERNATIONAL_METRO" | "UNKNOWN";
  wageIndexMultiplier: number; // Fallback prior only (e.g. 1.0 for Tier 1, 0.8 for Tier 2)
  isFallbackPrior: true;
}

export class MarketContextProvider {
  private static readonly INDIA_TIER_1_CITIES = [
    "hyderabad",
    "bengaluru",
    "bangalore",
    "mumbai",
    "delhi",
    "new delhi",
    "gurugram",
    "gurgaon",
    "noida",
    "chennai",
    "kolkata",
    "pune",
    "ahmedabad",
  ];

  private static readonly INDIA_TIER_2_CITIES = [
    "warangal",
    "vijayawada",
    "visakhapatnam",
    "vizag",
    "coimbatore",
    "kochi",
    "mysuru",
    "mysore",
    "chandigarh",
    "indore",
    "jaipur",
    "nagpur",
    "bhopal",
    "surat",
    "vadodara",
    "patna",
    "lucknow",
    "kanpur",
    "bhubaneswar",
  ];

  private static readonly UAE_LOCATIONS = ["dubai", "abu dhabi", "sharjah", "uae", "ajman"];
  private static readonly UK_LOCATIONS = ["london", "manchester", "birmingham", "uk", "united kingdom", "edinburgh", "glasgow"];
  private static readonly US_LOCATIONS = ["tx", "ca", "ny", "fl", "dallas", "austin", "houston", "phoenix", "seattle", "san francisco", "chicago", "los angeles", "united states", "usa"];

  public static resolve(locationInput?: string | null): MarketContextResult {
    const raw = (locationInput || "").toLowerCase().trim();

    if (!raw) {
      return {
        geography: "India (National Baseline)",
        country: "IN",
        currency: "INR",
        cityTier: "TIER_1",
        wageIndexMultiplier: 1.0,
        isFallbackPrior: true,
      };
    }

    // UAE Check
    if (this.UAE_LOCATIONS.some((loc) => raw.includes(loc))) {
      return {
        geography: locationInput || "United Arab Emirates",
        country: "AE",
        currency: "AED",
        cityTier: "INTERNATIONAL_METRO",
        wageIndexMultiplier: 1.3,
        isFallbackPrior: true,
      };
    }

    // UK Check
    if (this.UK_LOCATIONS.some((loc) => raw.includes(loc))) {
      return {
        geography: locationInput || "United Kingdom",
        country: "GB",
        currency: "GBP",
        cityTier: "INTERNATIONAL_METRO",
        wageIndexMultiplier: 1.25,
        isFallbackPrior: true,
      };
    }

    // US Check
    if (this.US_LOCATIONS.some((loc) => raw.includes(loc))) {
      return {
        geography: locationInput || "United States",
        country: "US",
        currency: "USD",
        cityTier: "INTERNATIONAL_METRO",
        wageIndexMultiplier: 1.4,
        isFallbackPrior: true,
      };
    }

    // India Tier 1 Check
    if (this.INDIA_TIER_1_CITIES.some((city) => raw.includes(city))) {
      return {
        geography: locationInput || "India Metro",
        country: "IN",
        currency: "INR",
        cityTier: "TIER_1",
        wageIndexMultiplier: 1.0,
        isFallbackPrior: true,
      };
    }

    // India Tier 2 Check
    if (this.INDIA_TIER_2_CITIES.some((city) => raw.includes(city))) {
      return {
        geography: locationInput || "India Regional",
        country: "IN",
        currency: "INR",
        cityTier: "TIER_2",
        wageIndexMultiplier: 0.8,
        isFallbackPrior: true,
      };
    }

    // Default India National Baseline
    return {
      geography: locationInput || "India",
      country: "IN",
      currency: "INR",
      cityTier: "TIER_2",
      wageIndexMultiplier: 0.85,
      isFallbackPrior: true,
    };
  }
}
