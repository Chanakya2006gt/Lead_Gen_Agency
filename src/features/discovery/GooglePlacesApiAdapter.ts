import { RawBusinessInput, RawReviewTimestamp } from "@/features/qualification/UniversalFilterService";
import { IDiscoveryAdapter, DiscoveryParams } from "./types";

export class GooglePlacesApiAdapter implements IDiscoveryAdapter {
  public readonly name = "GooglePlacesApiAdapter";
  private apiKey: string | null;

  constructor(apiKey?: string) {
    this.apiKey =
      apiKey ||
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      null;
  }

  public async discover(params: DiscoveryParams): Promise<RawBusinessInput[]> {
    const { niche, location, maxResults = 20 } = params;
    const query = `${niche} in ${location}`;

    if (!this.apiKey) {
      throw new Error("GOOGLE_MAPS_API_KEY is not configured in environment variables.");
    }

    // Try Google Places API (New) first
    try {
      const placesNew = await this.queryPlacesNew(query, maxResults);
      if (placesNew && placesNew.length > 0) {
        return placesNew;
      }
    } catch (err) {
      console.warn("Google Places API (New) request failed, trying Classic Places API:", err);
    }

    // Fallback to Google Places API (Classic Text Search)
    const placesClassic = await this.queryPlacesClassic(query, maxResults);
    return placesClassic;
  }

  /**
   * Google Places API (New) Text Search
   * https://places.googleapis.com/v1/places:searchText
   */
  private async queryPlacesNew(query: string, maxResults: number): Promise<RawBusinessInput[]> {
    const url = "https://places.googleapis.com/v1/places:searchText";
    const fieldMask = [
      "places.id",
      "places.displayName",
      "places.formattedAddress",
      "places.rating",
      "places.userRatingCount",
      "places.websiteUri",
      "places.internationalPhoneNumber",
      "places.nationalPhoneNumber",
      "places.googleMapsUri",
      "places.reviews",
      "places.types",
      "places.primaryTypeDisplayName",
    ].join(",");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey!,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize: Math.min(20, maxResults),
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Google Places (New) HTTP ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    const places = data.places || [];
    const results: RawBusinessInput[] = [];

    for (const p of places) {
      const name = p.displayName?.text || p.displayName || "";
      if (!name) continue;

      const placeId = p.id || `gplace_${Buffer.from(name).toString("hex").substring(0, 16)}`;
      const rating = typeof p.rating === "number" ? p.rating : 0;
      const reviewCount = typeof p.userRatingCount === "number" ? p.userRatingCount : 0;
      const websiteUrl = p.websiteUri || null;
      const phone = p.internationalPhoneNumber || p.nationalPhoneNumber || null;
      const formattedAddress = p.formattedAddress || "";
      const googleMapsUrl = p.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " " + formattedAddress)}`;
      const category = p.primaryTypeDisplayName?.text || p.types?.[0]?.replace(/_/g, " ") || undefined;

      // Extract ONLY real review timestamps returned by Google
      const reviews: RawReviewTimestamp[] = [];
      if (Array.isArray(p.reviews)) {
        for (const rev of p.reviews) {
          if (rev.publishTime) {
            reviews.push({ publishedAtDate: rev.publishTime });
          }
        }
      }

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
        reviews,
      });
    }

    return results;
  }

  /**
   * Google Places API (Classic) Text Search & Place Details
   */
  private async queryPlacesClassic(query: string, maxResults: number): Promise<RawBusinessInput[]> {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&key=${this.apiKey}`;

    const res = await fetch(searchUrl);
    if (!res.ok) {
      throw new Error(`Google Places (Classic) HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(`Google Places API returned status: ${data.status} - ${data.error_message || ""}`);
    }

    const rawResults = (data.results || []).slice(0, maxResults);
    const results: RawBusinessInput[] = [];

    for (const item of rawResults) {
      const placeId = item.place_id;
      let websiteUrl: string | null = null;
      let phone: string | null = null;
      let reviews: RawReviewTimestamp[] = [];

      // Fetch place details for website, phone, and real reviews if placeId exists
      if (placeId) {
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,formatted_phone_number,international_phone_number,url,reviews&key=${this.apiKey}`;
          const detailRes = await fetch(detailsUrl);
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            if (detailData.result) {
              websiteUrl = detailData.result.website || null;
              phone = detailData.result.international_phone_number || detailData.result.formatted_phone_number || null;
              if (Array.isArray(detailData.result.reviews)) {
                for (const r of detailData.result.reviews) {
                  if (r.time) {
                    reviews.push({ publishedAtDate: new Date(r.time * 1000).toISOString() });
                  }
                }
              }
            }
          }
        } catch (detailErr) {
          console.warn(`Failed to fetch details for place ${placeId}:`, detailErr);
        }
      }

      const rating = typeof item.rating === "number" ? item.rating : 0;
      const reviewCount = typeof item.user_ratings_total === "number" ? item.user_ratings_total : 0;

      results.push({
        placeId: placeId || `gplace_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: item.name,
        category: item.types?.[0]?.replace(/_/g, " ") || undefined,
        rating,
        reviewCount,
        websiteUrl,
        phone,
        formattedAddress: item.formatted_address || "",
        googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
        reviews,
      });
    }

    return results;
  }
}
