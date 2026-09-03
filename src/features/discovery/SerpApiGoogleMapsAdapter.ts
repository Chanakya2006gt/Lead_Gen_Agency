import { RawBusinessInput } from "@/features/qualification/UniversalFilterService";
import { IDiscoveryAdapter, DiscoveryParams, DiscoveryPlan } from "./types";
import { LocationResolver } from "./LocationResolver";
import { MarketContextProvider } from "@/features/commercial/MarketContext";
import { DiscoveryStrategyBuilder } from "./DiscoveryStrategyBuilder";

export class SerpApiGoogleMapsAdapter implements IDiscoveryAdapter {
  public readonly name = "SerpApiGoogleMapsAdapter";
  private apiKey: string | null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SERPAPI_API_KEY || null;
  }

  public async discover(planOrParams: DiscoveryPlan | DiscoveryParams): Promise<RawBusinessInput[]> {
    if (!this.apiKey) {
      throw new Error("SERPAPI_API_KEY is not configured in environment variables.");
    }

    let plan: DiscoveryPlan;
    if ("queries" in planOrParams) {
      plan = planOrParams;
    } else {
      const location = LocationResolver.resolve(planOrParams.location);
      const marketContext = MarketContextProvider.resolve(planOrParams.location);
      plan = DiscoveryStrategyBuilder.buildPlan({
        niche: planOrParams.niche,
        location,
        marketContext,
        mode: planOrParams.mode || "STANDARD",
      });
    }

    const candidateMap = new Map<string, RawBusinessInput>();
    const maxCalls = Math.min(plan.queries.length, plan.budget.maxProviderCalls);

    for (let i = 0; i < maxCalls; i++) {
      const q = plan.queries[i];
      const searchUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(
        q.textQuery
      )}&api_key=${this.apiKey}`;

      try {
        const res = await fetch(searchUrl);
        if (res.ok) {
          const data = await res.json();
          const rawPlaces = data.local_results || [];

          for (const item of rawPlaces) {
            const name = item.title || "";
            if (!name) continue;

            const placeId = item.place_id || `serp_${Buffer.from(name).toString("hex").substring(0, 16)}`;
            if (!candidateMap.has(placeId)) {
              candidateMap.set(placeId, {
                placeId,
                name,
                category: item.type || item.category || plan.originalNiche,
                rating: typeof item.rating === "number" ? item.rating : 0,
                reviewCount: typeof item.reviews === "number" ? item.reviews : 0,
                websiteUrl: item.website || item.links?.website || null,
                phone: item.phone || null,
                formattedAddress: item.address || plan.location.canonicalName,
                googleMapsUrl: item.link || null,
                reviews: [],
              });

              if (candidateMap.size >= plan.budget.maxTotalCandidates) {
                break;
              }
            }
          }
        }
      } catch (err) {
        console.warn(`SerpAPI error for query ${q.textQuery}:`, err);
      }

      if (candidateMap.size >= plan.budget.maxTotalCandidates) {
        break;
      }
    }

    return Array.from(candidateMap.values());
  }
}
