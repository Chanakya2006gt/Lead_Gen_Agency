import { IDiscoveryAdapter, DiscoveryParams } from "./types";
import { RawBusinessInput, RawReviewTimestamp } from "@/services/filter/UniversalFilterService";

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

    const { niche, location, radiusKm, maxResults = 50 } = params;
    const searchString = `${niche} in ${location}`;

    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${this.apiToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchStringsArray: [searchString],
          maxCrawledPlacesPerSearch: maxResults,
          includeReviews: true,
          maxReviews: 50,
          language: "en",
        }),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      throw new Error(`Apify run failed (${runResponse.status}): ${errorText}`);
    }

    const runData = await runResponse.json();
    const datasetId = runData.data?.defaultDatasetId;

    if (!datasetId) {
      throw new Error("Failed to retrieve dataset ID from Apify run.");
    }

    // Wait for dataset ready (or fetch items)
    const itemsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${this.apiToken}&format=json`
    );

    if (!itemsResponse.ok) {
      throw new Error(`Failed to fetch Apify dataset items (${itemsResponse.status})`);
    }

    const items: any[] = await itemsResponse.json();

    return items.map((item) => {
      const reviews: RawReviewTimestamp[] = (item.reviews || []).map((r: any) => ({
        publishedAtDate: r.publishedAtDate || r.date,
      }));

      return {
        placeId: item.placeId || item.id || `apify_${Math.random().toString(36).substring(2, 9)}`,
        name: item.title || item.name || "Unknown Business",
        category: item.categoryName || item.category || niche,
        rating: typeof item.totalScore === "number" ? item.totalScore : Number(item.rating || 0),
        reviewCount: typeof item.reviewsCount === "number" ? item.reviewsCount : Number(item.reviewCount || 0),
        websiteUrl: item.website || item.url || null,
        phone: item.phone || item.phoneNumber || null,
        formattedAddress: item.address || item.formattedAddress || null,
        googleMapsUrl: item.url || item.googleMapsUrl || null,
        reviews,
      };
    });
  }
}
