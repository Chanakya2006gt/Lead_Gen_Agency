import { MarketContextResult } from "@/features/commercial/MarketContext";
import { RawBusinessInput } from "@/features/qualification/UniversalFilterService";

export type DiscoveryMode = "STANDARD" | "COMMERCIAL" | "EXHAUSTIVE";

export interface ResolvedLocation {
  input: string;
  canonicalName: string;
  country: string;
  countryCode: string; // "IN", "US", "AE", "GB", etc.
  latitude: number | null;
  longitude: number | null;
  cityTier: "TIER_1" | "TIER_2" | "TIER_3" | "INTERNATIONAL_METRO" | "UNKNOWN";
  confidence: number;
  source: "EXACT_COORDINATE" | "CANONICAL_DATABASE" | "HEURISTIC_PARSER" | "FALLBACK";
}

export type QueryIntent =
  | "USER_EXPLICIT"
  | "CATEGORY_EQUIVALENT"
  | "HIGH_INTENT_COMMERCIAL"
  | "SERVICE_SPECIALTY"
  | "GEOGRAPHIC_MICRO_HUB";

export type SemanticCategory =
  | "DENTAL_HEALTHCARE"
  | "MEDICAL_CLINIC"
  | "HOME_SERVICES_HVAC"
  | "HOME_SERVICES_ROOFING"
  | "HOME_SERVICES_PLUMBING"
  | "BEAUTY_WELLNESS"
  | "INDUSTRIAL_MANUFACTURING"
  | "PROFESSIONAL_LEGAL"
  | "HOSPITALITY_FOOD"
  | "AUTOMOTIVE_SERVICES"
  | "GENERAL_COMMERCIAL";

export interface QueryVariant {
  textQuery: string;
  intent: QueryIntent;
  priority: number; // 1 (Highest) to 5 (Lowest)
  source: "USER_INPUT" | "MARKET_CONTEXT" | "COMMERCIAL_EXPANSION";
  semanticCategory: SemanticCategory;
  specialty?: string; // e.g. "IMPLANTS", "ORTHODONTICS", "COMMERCIAL_ROOFING"
  subDistrict?: string;
  targetCoordinates?: { lat: number; lng: number; radiusMeters: number };
}

export interface DiscoveryBudget {
  maxQueries: number;
  maxProviderCalls: number;
  maxResultsPerQuery: number;
  maxTotalCandidates: number;
  maxGeographicTargets: number;
}

export interface GeographicSignal {
  name: string;
  type: "MICRO_HUB" | "SUBDISTRICT" | "COMMERCIAL_ZONE";
  confidence: number;
  source: "SEED_DATA" | "MARKET_RESEARCH" | "HEURISTIC";
  coordinates?: { lat: number; lng: number };
}

export interface DiscoveryPlan {
  originalNiche: string;
  mode: DiscoveryMode;
  location: ResolvedLocation;
  marketContext: MarketContextResult;
  queries: QueryVariant[];
  budget: DiscoveryBudget;
  providerOptimizationFilters?: {
    minRating?: number; // Upstream quota/cost optimization only (e.g. 3.8); NOT business qualification
  };
  createdAt: string;
}

export interface DiscoveryParams {
  niche: string;
  location: string;
  radiusKm?: number;
  maxResults?: number;
  mode?: DiscoveryMode;
}

export interface IDiscoveryAdapter {
  readonly name: string;
  discover(planOrParams: DiscoveryPlan | DiscoveryParams): Promise<RawBusinessInput[]>;
}
