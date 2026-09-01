import { IDiscoveryAdapter, DiscoveryParams } from "./types";
import { RawBusinessInput, RawReviewTimestamp } from "@/services/filter/UniversalFilterService";

export class OutscraperAdapter implements IDiscoveryAdapter {
  public readonly name = "OutscraperAdapter";
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OUTSCRAPER_API_KEY || "";
  }

  public async discover(params: DiscoveryParams): Promise<RawBusinessInput[]> {
    if (!this.apiKey) {
      throw new Error("Outscraper API key is not configured in environment (OUTSCRAPER_API_KEY).");
    }

    const { niche, location, radiusKm, maxResults = 50 } = params;
    const query = `${niche}, ${location}`;

    const url = `https://api.app.outscraper.com/maps/search-v3?query=${encodeURIComponent(
      query
    )}&limit=${maxResults}&reviewsLimit=25&async=false`;

    const response = await fetch(url, {
      headers: { "X-API-KEY": this.apiKey },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Outscraper API failed (${response.status}): ${errorText}`);
    }

    const json = await response.json();
    const results: any[] = json.data?.[0] || [];

    return results.map((item) => {
      const reviews: RawReviewTimestamp[] = (item.reviews_data || []).map((r: any) => ({
        publishedAtDate: r.google_review_datetime_utc || r.review_datetime_utc,
      }));

      return {
        placeId: item.place_id || item.google_id || `outscraper_${Math.random().toString(36).substring(2, 9)}`,
        name: item.name || "Unknown Business",
        category: item.type || item.subtypes?.[0] || niche,
        rating: Number(item.rating || 0),
        reviewCount: Number(item.reviews || 0),
        websiteUrl: item.site || item.website || null,
        phone: item.phone || null,
        formattedAddress: item.full_address || item.formatted_address || null,
        googleMapsUrl: item.location_link || null,
        reviews,
      };
    });
  }
}
