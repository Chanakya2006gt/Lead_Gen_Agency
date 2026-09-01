import { IDiscoveryAdapter, DiscoveryParams } from "./types";
import { RawBusinessInput, RawReviewTimestamp } from "@/features/qualification/UniversalFilterService";

export class MockDiscoveryAdapter implements IDiscoveryAdapter {
  public readonly name = "MockDiscoveryAdapter";

  public async discover(params: DiscoveryParams): Promise<RawBusinessInput[]> {
    const { niche, location } = params;
    const now = new Date();

    const generateReviews = (totalReviews: number, velocityProfile: "growing" | "stable" | "declining" | "stale") => {
      const timestamps: RawReviewTimestamp[] = [];
      let last30Count = 0;
      let last90Count = 0;

      if (velocityProfile === "growing") {
        last30Count = Math.max(4, Math.floor(totalReviews * 0.08));
        last90Count = Math.max(last30Count, Math.floor(totalReviews * 0.15));
      } else if (velocityProfile === "stable") {
        last30Count = Math.max(2, Math.floor(totalReviews * 0.03));
        last90Count = Math.max(last30Count * 3, Math.floor(totalReviews * 0.09));
      } else if (velocityProfile === "declining") {
        last30Count = 0;
        last90Count = Math.max(1, Math.floor(totalReviews * 0.02));
      } else {
        last30Count = 0;
        last90Count = 0;
      }

      for (let i = 0; i < last30Count; i++) {
        const d = new Date(now.getTime() - Math.floor(Math.random() * 28 + 1) * 24 * 60 * 60 * 1000);
        timestamps.push({ publishedAtDate: d.toISOString() });
      }

      for (let i = 0; i < last90Count - last30Count; i++) {
        const d = new Date(now.getTime() - Math.floor(Math.random() * 60 + 30) * 24 * 60 * 60 * 1000);
        timestamps.push({ publishedAtDate: d.toISOString() });
      }

      return timestamps;
    };

    return [
      {
        placeId: "mock_place_01",
        name: `[DEMO] Apex ${niche} Specialists`,
        category: niche,
        rating: 4.85,
        reviewCount: 342,
        websiteUrl: null, // NO WEBSITE - Urgent Gap
        phone: "+1 (555) 234-5678",
        formattedAddress: `100 Central Ave, ${location}`,
        googleMapsUrl: "https://maps.google.com/?q=mock_place_01",
        reviews: generateReviews(342, "growing"),
      },
      {
        placeId: "mock_place_02",
        name: `[DEMO] Precision ${niche} Care Center`,
        category: niche,
        rating: 4.62,
        reviewCount: 184,
        websiteUrl: "http://localhost:3099/sites/broken-legacy",
        phone: "+1 (555) 345-6789",
        formattedAddress: `250 Main Blvd, ${location}`,
        googleMapsUrl: "https://maps.google.com/?q=mock_place_02",
        reviews: generateReviews(184, "stable"),
      },
      {
        placeId: "mock_place_03",
        name: `[DEMO] Elite ${niche} Custom Works`,
        category: niche,
        rating: 4.91,
        reviewCount: 512,
        websiteUrl: "http://localhost:3099/sites/whatsapp-heavy",
        phone: "+1 (555) 456-7890",
        formattedAddress: `420 Commerce Way, ${location}`,
        googleMapsUrl: "https://maps.google.com/?q=mock_place_03",
        reviews: generateReviews(512, "growing"),
      },
      {
        placeId: "mock_place_04",
        name: `[DEMO] Metro ${niche} Clinic`,
        category: niche,
        rating: 4.45,
        reviewCount: 96,
        websiteUrl: "http://localhost:3099/sites/modern-no-booking",
        phone: "+1 (555) 567-8901",
        formattedAddress: `800 Oak Street, ${location}`,
        googleMapsUrl: "https://maps.google.com/?q=mock_place_04",
        reviews: generateReviews(96, "stable"),
      },
      {
        placeId: "mock_place_05",
        name: `[DEMO] Heritage ${niche} Studio`,
        category: niche,
        rating: 4.7,
        reviewCount: 220,
        websiteUrl: "http://localhost:3099/sites/modern-high-converting",
        phone: "+1 (555) 678-9012",
        formattedAddress: `120 Pine Lane, ${location}`,
        googleMapsUrl: "https://maps.google.com/?q=mock_place_05",
        reviews: generateReviews(220, "growing"),
      },
      {
        placeId: "mock_place_06",
        name: `Budget ${niche} Express`,
        category: niche,
        rating: 3.75, // Below Gate 1 (Rating < 4.0)
        reviewCount: 140,
        websiteUrl: "https://example.com/budget",
        phone: "+1 (555) 789-0123",
        formattedAddress: `99 State Rd, ${location}`,
        googleMapsUrl: "https://maps.google.com/?q=mock_place_06",
        reviews: generateReviews(140, "declining"),
      },
      {
        placeId: "mock_place_07",
        name: `New Era ${niche}`,
        category: niche,
        rating: 4.8,
        reviewCount: 38, // Below Gate 2 (Reviews < 50)
        websiteUrl: "https://example.com/newera",
        phone: "+1 (555) 890-1234",
        formattedAddress: `50 Market St, ${location}`,
        googleMapsUrl: "https://maps.google.com/?q=mock_place_07",
        reviews: generateReviews(38, "growing"),
      },
    ];
  }
}
