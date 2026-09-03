import { ResolvedLocation } from "./types";

interface KnownLocationRecord {
  aliases: string[];
  canonicalName: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  cityTier: "TIER_1" | "TIER_2" | "TIER_3" | "INTERNATIONAL_METRO";
}

const KNOWN_LOCATIONS_SEED: KnownLocationRecord[] = [
  // India Tier 1 Metros
  {
    aliases: ["hyderabad", "hyderabad telangana", "hyderabad india", "secunderabad", "cyberabad", "hyd"],
    canonicalName: "Hyderabad, Telangana, India",
    country: "India",
    countryCode: "IN",
    latitude: 17.3850,
    longitude: 78.4867,
    cityTier: "TIER_1",
  },
  {
    aliases: ["bengaluru", "bangalore", "bangalore karnataka", "bengaluru karnataka", "blr"],
    canonicalName: "Bengaluru, Karnataka, India",
    country: "India",
    countryCode: "IN",
    latitude: 12.9716,
    longitude: 77.5946,
    cityTier: "TIER_1",
  },
  {
    aliases: ["mumbai", "bombay", "mumbai maharashtra", "navi mumbai", "thane"],
    canonicalName: "Mumbai, Maharashtra, India",
    country: "India",
    countryCode: "IN",
    latitude: 19.0760,
    longitude: 72.8777,
    cityTier: "TIER_1",
  },
  {
    aliases: ["delhi", "new delhi", "ncr", "gurgaon", "gurugram", "noida"],
    canonicalName: "New Delhi, Delhi, India",
    country: "India",
    countryCode: "IN",
    latitude: 28.6139,
    longitude: 77.2090,
    cityTier: "TIER_1",
  },
  {
    aliases: ["chennai", "madras", "chennai tamil nadu"],
    canonicalName: "Chennai, Tamil Nadu, India",
    country: "India",
    countryCode: "IN",
    latitude: 13.0827,
    longitude: 80.2707,
    cityTier: "TIER_1",
  },
  {
    aliases: ["kolkata", "calcutta", "kolkata west bengal"],
    canonicalName: "Kolkata, West Bengal, India",
    country: "India",
    countryCode: "IN",
    latitude: 22.5726,
    longitude: 88.3639,
    cityTier: "TIER_1",
  },
  {
    aliases: ["pune", "pune maharashtra"],
    canonicalName: "Pune, Maharashtra, India",
    country: "India",
    countryCode: "IN",
    latitude: 18.5204,
    longitude: 73.8567,
    cityTier: "TIER_1",
  },

  // India Tier 2 / Regional Hubs
  {
    aliases: ["warangal", "hanamkonda", "kazipet", "warangal telangana", "subedari"],
    canonicalName: "Warangal, Telangana, India",
    country: "India",
    countryCode: "IN",
    latitude: 17.9689,
    longitude: 79.5941,
    cityTier: "TIER_2",
  },
  {
    aliases: ["vijayawada", "vijayawada andhra pradesh", "bezawada"],
    canonicalName: "Vijayawada, Andhra Pradesh, India",
    country: "India",
    countryCode: "IN",
    latitude: 16.5062,
    longitude: 80.6480,
    cityTier: "TIER_2",
  },
  {
    aliases: ["visakhapatnam", "vizag", "visakhapatnam andhra pradesh"],
    canonicalName: "Visakhapatnam, Andhra Pradesh, India",
    country: "India",
    countryCode: "IN",
    latitude: 17.6868,
    longitude: 83.2185,
    cityTier: "TIER_2",
  },
  {
    aliases: ["kochi", "cochin", "kochi kerala", "ernakulam"],
    canonicalName: "Kochi, Kerala, India",
    country: "India",
    countryCode: "IN",
    latitude: 9.9312,
    longitude: 76.2673,
    cityTier: "TIER_2",
  },
  {
    aliases: ["coimbatore", "coimbatore tamil nadu"],
    canonicalName: "Coimbatore, Tamil Nadu, India",
    country: "India",
    countryCode: "IN",
    latitude: 11.0168,
    longitude: 76.9558,
    cityTier: "TIER_2",
  },
  {
    aliases: ["jaipur", "jaipur rajasthan"],
    canonicalName: "Jaipur, Rajasthan, India",
    country: "India",
    countryCode: "IN",
    latitude: 26.9124,
    longitude: 75.7873,
    cityTier: "TIER_2",
  },
  {
    aliases: ["ahmedabad", "ahmedabad gujarat"],
    canonicalName: "Ahmedabad, Gujarat, India",
    country: "India",
    countryCode: "IN",
    latitude: 23.0225,
    longitude: 72.5714,
    cityTier: "TIER_2",
  },

  // US & International Metros
  {
    aliases: ["dallas", "dallas tx", "dallas texas", "dfw", "plano", "frisco", "uptown dallas"],
    canonicalName: "Dallas, Texas, USA",
    country: "United States",
    countryCode: "US",
    latitude: 32.7767,
    longitude: -96.7970,
    cityTier: "INTERNATIONAL_METRO",
  },
  {
    aliases: ["austin", "austin tx", "austin texas"],
    canonicalName: "Austin, Texas, USA",
    country: "United States",
    countryCode: "US",
    latitude: 30.2672,
    longitude: -97.7431,
    cityTier: "INTERNATIONAL_METRO",
  },
  {
    aliases: ["dubai", "dubai uae", "dubai united arab emirates"],
    canonicalName: "Dubai, United Arab Emirates",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.2048,
    longitude: 55.2708,
    cityTier: "INTERNATIONAL_METRO",
  },
  {
    aliases: ["london", "london uk", "london united kingdom"],
    canonicalName: "London, England, United Kingdom",
    country: "United Kingdom",
    countryCode: "GB",
    latitude: 51.5074,
    longitude: -0.1278,
    cityTier: "INTERNATIONAL_METRO",
  },
];

export class LocationResolver {
  /**
   * Resolve an arbitrary location input into a structured ResolvedLocation
   */
  public static resolve(input: string): ResolvedLocation {
    const rawInput = (input || "").trim();
    if (!rawInput) {
      return {
        input: "",
        canonicalName: "Unknown Location",
        country: "Unknown",
        countryCode: "UNKNOWN",
        latitude: null,
        longitude: null,
        cityTier: "UNKNOWN",
        confidence: 0.1,
        source: "FALLBACK",
      };
    }

    const normalized = rawInput.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

    // 1. Exact or Substring Match from Canonical Seed Database
    for (const record of KNOWN_LOCATIONS_SEED) {
      if (record.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))) {
        return {
          input: rawInput,
          canonicalName: record.canonicalName,
          country: record.country,
          countryCode: record.countryCode,
          latitude: record.latitude,
          longitude: record.longitude,
          cityTier: record.cityTier,
          confidence: 0.95,
          source: "CANONICAL_DATABASE",
        };
      }
    }

    // 2. Heuristic Region / Country Detection
    if (/india|telangana|andhra|karnataka|maharashtra|tamil nadu|delhi|gujarat|kerala/i.test(rawInput)) {
      return {
        input: rawInput,
        canonicalName: rawInput,
        country: "India",
        countryCode: "IN",
        latitude: null, // Zero fabricated coordinates
        longitude: null,
        cityTier: "TIER_3",
        confidence: 0.65,
        source: "HEURISTIC_PARSER",
      };
    }

    if (/usa|united states|texas|california|florida|new york|tx|ca|ny|fl/i.test(rawInput)) {
      return {
        input: rawInput,
        canonicalName: rawInput,
        country: "United States",
        countryCode: "US",
        latitude: null,
        longitude: null,
        cityTier: "INTERNATIONAL_METRO",
        confidence: 0.6,
        source: "HEURISTIC_PARSER",
      };
    }

    if (/uae|emirates|dubai|abu dhabi/i.test(rawInput)) {
      return {
        input: rawInput,
        canonicalName: rawInput,
        country: "United Arab Emirates",
        countryCode: "AE",
        latitude: null,
        longitude: null,
        cityTier: "INTERNATIONAL_METRO",
        confidence: 0.65,
        source: "HEURISTIC_PARSER",
      };
    }

    if (/uk|england|britain|london/i.test(rawInput)) {
      return {
        input: rawInput,
        canonicalName: rawInput,
        country: "United Kingdom",
        countryCode: "GB",
        latitude: null,
        longitude: null,
        cityTier: "INTERNATIONAL_METRO",
        confidence: 0.65,
        source: "HEURISTIC_PARSER",
      };
    }

    // 3. Conservative Fallback for completely obscure/unknown locations
    return {
      input: rawInput,
      canonicalName: rawInput,
      country: "Unknown",
      countryCode: "UNKNOWN",
      latitude: null,
      longitude: null,
      cityTier: "UNKNOWN",
      confidence: 0.2,
      source: "FALLBACK",
    };
  }
}
