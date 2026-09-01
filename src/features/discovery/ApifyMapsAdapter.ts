import { IDiscoveryAdapter, DiscoveryParams } from "./types";
import { RawBusinessInput, RawReviewTimestamp } from "@/features/qualification/UniversalFilterService";

export class ApifyMapsAdapter implements IDiscoveryAdapter {
  public readonly name = "ApifyMapsAdapter";
  private readonly apiToken: string;

  constructor(apiToken?: string) {
    this.apiToken = apiToken || process.env.APIFY_API_TOKEN || "";
  }

  public async discover(params: DiscoveryParams): Promise<RawBusinessInput[]> {
    if (!this.apiToken) {
      throw new Error("Apify API token is not configured in environment (APIFY_API_TOKEN).");
    }

    const { niche, location, maxResults = 20 } = params;
    const searchString = `${niche} in ${location}`;

    const url = `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${this.apiToken}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchStringsArray: [searchString],
        maxCrawledPlacesPerSearch: maxResults,
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

    return items.map((item) => {
      const reviews: RawReviewTimestamp[] = (item.reviews || []).map((r: any) => ({
        publishedAtDate: r.publishedAtDate || r.date || new Date().toISOString(),
      }));

      return {
        placeId: item.placeId || item.id || `apify_${Math.random().toString(36).substring(2, 9)}`,
        name: item.title || item.name || "Unknown Business",
        category: item.categoryName || item.category || niche,
        rating: Number(item.totalScore || item.rating || 0),
        reviewCount: Number(item.reviewsCount || item.reviewsDistribution?.total || 0),
        websiteUrl: item.website || item.url || null,
        phone: item.phone || item.phoneUnformatted || null,
        formattedAddress: item.address || location,
        googleMapsUrl: item.url || null,
        reviews,
      };
    });
  }
}
