import { RawBusinessInput } from "@/features/qualification/UniversalFilterService";
import { IDiscoveryAdapter, DiscoveryParams } from "./types";

export class SerpApiGoogleMapsAdapter implements IDiscoveryAdapter {
  public readonly name = "SerpApiGoogleMapsAdapter";
  private apiKey: string | null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SERPAPI_API_KEY || null;
  }

  public async discover(params: DiscoveryParams): Promise<RawBusinessInput[]> {
    const { niche, location, maxResults = 15 } = params;
    const query = `${niche} in ${location}`;

    if (!this.apiKey) {
      throw new Error("SERPAPI_API_KEY is not configured in environment variables.");
    }

    const searchUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(
      query
    )}&api_key=${this.apiKey}`;

    const res = await fetch(searchUrl);
    if (!res.ok) {
      throw new Error(`SerpApi HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const rawPlaces = (data.local_results || []).slice(0, maxResults);
    const results: RawBusinessInput[] = [];

    for (const item of rawPlaces) {
      const name = item.title || "";
      if (!name) continue;

      const placeId = item.place_id || `serp_${Buffer.from(name).toString("hex").substring(0, 16)}`;
      const rating = typeof item.rating === "number" ? item.rating : 0;
      const reviewCount = typeof item.reviews === "number" ? item.reviews : 0;
      const websiteUrl = item.website || item.links?.website || null;
      const phone = item.phone || null;
      const formattedAddress = item.address || "";
      const googleMapsUrl = item.link || null;
      const category = item.type || item.category || undefined;

      results.push({
        placeId,
        name,
        category,
        rating,
        reviewCount,
        websiteUrl,
        phone,
        formattedAddress,
        googleMapsUrl,
        reviews: [], // SerpAPI map local_results does not include full review timestamps
      });
    }

    return results;
  }
}
