import { IDiscoveryAdapter, DiscoveryParams, DiscoveryPlan } from "./types";
import { RawBusinessInput, RawReviewTimestamp } from "@/features/qualification/UniversalFilterService";
import { LocationResolver } from "./LocationResolver";
import { MarketContextProvider } from "@/features/commercial/MarketContext";
import { DiscoveryStrategyBuilder } from "./DiscoveryStrategyBuilder";

export class ApifyMapsAdapter implements IDiscoveryAdapter {
  public readonly name = "ApifyMapsAdapter";
  private readonly apiToken: string;

  constructor(apiToken?: string) {
    this.apiToken = apiToken || process.env.APIFY_API_TOKEN || "";
  }

  public async discover(planOrParams: DiscoveryPlan | DiscoveryParams): Promise<RawBusinessInput[]> {
    if (!this.apiToken) {
      throw new Error("Apify API token is not configured in environment (APIFY_API_TOKEN).");
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

    const searchStrings = plan.queries
      .slice(0, plan.budget.maxProviderCalls)
      .map((q) => q.textQuery);

    const url = `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${this.apiToken}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchStringsArray: searchStrings,
        maxCrawledPlacesPerSearch: plan.budget.maxResultsPerQuery,
        language: "en",
        reviewsSort: "newest",
        maxReviews: 20,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apify request failed with status ${response.status}: ${errorText}`);
    }

    const items: any[] = await response.json();
    const candidateMap = new Map<string, RawBusinessInput>();

    for (const item of items) {
      const placeId = item.placeId || item.id || `apify_${Math.random().toString(36).substring(2, 9)}`;
      if (!candidateMap.has(placeId)) {
        const reviews: RawReviewTimestamp[] = (item.reviews || []).map((r: any) => ({
          publishedAtDate: r.publishedAtDate || r.date || new Date().toISOString(),
        }));

        candidateMap.set(placeId, {
          placeId,
          name: item.title || item.name || "Unknown Business",
          category: item.categoryName || item.category || plan.originalNiche,
          rating: Number(item.totalScore || item.rating || 0),
          reviewCount: Number(item.reviewsCount || item.reviewsDistribution?.total || 0),
          websiteUrl: item.website || item.url || null,
          phone: item.phone || item.phoneUnformatted || null,
          formattedAddress: item.address || plan.location.canonicalName,
          googleMapsUrl: item.url || null,
          reviews,
        });

        if (candidateMap.size >= plan.budget.maxTotalCandidates) {
          break;
        }
      }
    }

    return Array.from(candidateMap.values());
  }
}
