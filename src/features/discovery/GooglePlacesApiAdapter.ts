import { RawBusinessInput, RawReviewTimestamp } from "@/features/qualification/UniversalFilterService";
import { IDiscoveryAdapter, DiscoveryParams, DiscoveryPlan, SemanticCategory } from "./types";
import { LocationResolver } from "./LocationResolver";
import { MarketContextProvider } from "@/features/commercial/MarketContext";
import { DiscoveryStrategyBuilder } from "./DiscoveryStrategyBuilder";

export class GooglePlacesApiAdapter implements IDiscoveryAdapter {
  public readonly name = "GooglePlacesApiAdapter";
  private apiKey: string | null;

  constructor(apiKey?: string) {
    this.apiKey =
      apiKey ||
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY ||
      null;
  }

  public async discover(planOrParams: DiscoveryPlan | DiscoveryParams): Promise<RawBusinessInput[]> {
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

    if (!this.apiKey) {
      throw new Error("GOOGLE_MAPS_API_KEY is not configured in environment variables.");
    }

    const candidateMap = new Map<string, RawBusinessInput>();
    const maxCalls = Math.min(plan.queries.length, plan.budget.maxProviderCalls);

    for (let i = 0; i < maxCalls; i++) {
      const queryVariant = plan.queries[i];
      try {
        const batch = await this.queryPlacesNew(queryVariant.textQuery, queryVariant.semanticCategory, plan);
        for (const item of batch) {
          if (!candidateMap.has(item.placeId)) {
            candidateMap.set(item.placeId, item);
          }
          if (candidateMap.size >= plan.budget.maxTotalCandidates) {
            break;
          }
        }
      } catch (err) {
        console.warn(`Places API (New) failed for query "${queryVariant.textQuery}", trying classic fallback:`, err);
        try {
          const fallbackBatch = await this.queryPlacesClassic(queryVariant.textQuery, plan);
          for (const item of fallbackBatch) {
            if (!candidateMap.has(item.placeId)) {
              candidateMap.set(item.placeId, item);
            }
          }
        } catch (classicErr) {
          console.warn(`Places API (Classic) also failed:`, classicErr);
        }
      }

      if (candidateMap.size >= plan.budget.maxTotalCandidates) {
        break;
      }
    }

    return Array.from(candidateMap.values());
  }

  /**
   * Maps semantic categories strictly to verified Google Places API Table A place types
   */
  private mapSemanticCategoryToGoogleType(category: SemanticCategory): string | undefined {
    switch (category) {
      case "DENTAL_HEALTHCARE":
        return "dentist";
      case "MEDICAL_CLINIC":
        return "doctor";
      case "HOME_SERVICES_HVAC":
        return "hvac_contractor";
      case "HOME_SERVICES_ROOFING":
        return "roofing_contractor";
      case "HOME_SERVICES_PLUMBING":
        return "plumber";
      case "BEAUTY_WELLNESS":
        return "beauty_salon";
      case "HOSPITALITY_FOOD":
        return "restaurant";
      case "AUTOMOTIVE_SERVICES":
        return "car_repair";
      case "PROFESSIONAL_LEGAL":
        return "lawyer";
      default:
        return undefined; // No reliable single type; rely on text search without forcing invalid type
    }
  }

  /**
   * Google Places API (New) Text Search
   * https://places.googleapis.com/v1/places:searchText
   */
  private async queryPlacesNew(query: string, category: SemanticCategory, plan: DiscoveryPlan): Promise<RawBusinessInput[]> {
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
      "places.primaryType",
      "places.primaryTypeDisplayName",
    ].join(",");

    const requestBody: any = {
      textQuery: query,
      pageSize: Math.min(20, plan.budget.maxResultsPerQuery),
    };

    const googleType = this.mapSemanticCategoryToGoogleType(category);
    if (googleType) {
      requestBody.includedType = googleType;
    }

    if (plan.location.latitude !== null && plan.location.longitude !== null) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: plan.location.latitude,
            longitude: plan.location.longitude,
          },
          radius: 15000.0,
        },
      };
    }

    if (plan.providerOptimizationFilters?.minRating) {
      requestBody.minRating = plan.providerOptimizationFilters.minRating;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey!,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(requestBody),
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
      
      // Extract Google's verified primary category with full provenance
      const googlePrimaryType = p.primaryType || p.types?.[0] || undefined;
      const googlePrimaryTypeDisplayName = p.primaryTypeDisplayName?.text || p.primaryTypeDisplayName || (googlePrimaryType ? googlePrimaryType.replace(/_/g, " ") : undefined);
      const placeCategory = googlePrimaryTypeDisplayName || (googlePrimaryType ? googlePrimaryType.replace(/_/g, " ") : "Operating Business");

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
        category: placeCategory,
        rating,
        reviewCount,
        websiteUrl,
        phone,
        formattedAddress,
        googleMapsUrl,
        reviews,
        discoveryNiche: plan.originalNiche,
        discoveryQuery: query,
        googlePrimaryType,
        googlePrimaryTypeDisplayName,
        categorySource: "GOOGLE_VERIFIED",
        categoryConfidence: 1.0,
      });
    }

    return results;
  }

  /**
   * Google Places API (Classic) Text Search & Place Details Fallback
   */
  private async queryPlacesClassic(query: string, plan: DiscoveryPlan): Promise<RawBusinessInput[]> {
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

    const rawResults = (data.results || []).slice(0, plan.budget.maxResultsPerQuery);
    const results: RawBusinessInput[] = [];

    for (const item of rawResults) {
      const placeId = item.place_id;
      let websiteUrl: string | null = null;
      let phone: string | null = null;
      let reviews: RawReviewTimestamp[] = [];

      if (placeId) {
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,formatted_phone_number,international_phone_number,url,reviews,types&key=${this.apiKey}`;
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
      const googlePrimaryType = item.types?.[0] || undefined;
      const placeCategory = googlePrimaryType ? googlePrimaryType.replace(/_/g, " ") : "Operating Business";

      results.push({
        placeId: placeId || `gplace_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: item.name,
        category: placeCategory,
        rating,
        reviewCount,
        websiteUrl,
        phone,
        formattedAddress: item.formatted_address || "",
        googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
        reviews,
        discoveryNiche: plan.originalNiche,
        discoveryQuery: query,
        googlePrimaryType,
        googlePrimaryTypeDisplayName: placeCategory,
        categorySource: "GOOGLE_VERIFIED",
        categoryConfidence: 0.9,
      });
    }

    return results;
  }
}
