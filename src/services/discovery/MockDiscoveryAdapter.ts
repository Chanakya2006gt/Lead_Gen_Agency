import { IDiscoveryAdapter, DiscoveryParams } from "./types";
import { RawBusinessInput, RawReviewTimestamp } from "@/services/filter/UniversalFilterService";

export class MockDiscoveryAdapter implements IDiscoveryAdapter {
  public readonly name = "MockDiscoveryAdapter";

  public async discover(params: DiscoveryParams): Promise<RawBusinessInput[]> {
    const { niche, location } = params;
    const now = new Date();

    const generateReviews = (
      count30d: number,
      count90d: number,
      count180d: number
    ): RawReviewTimestamp[] => {
      const list: RawReviewTimestamp[] = [];
      // 30d reviews
      for (let i = 0; i < count30d; i++) {
        const d = new Date(now.getTime() - Math.floor(Math.random() * 28 + 1) * 86400000);
        list.push({ publishedAtDate: d.toISOString() });
      }
      // 31-90d reviews
      const additional90d = Math.max(0, count90d - count30d);
      for (let i = 0; i < additional90d; i++) {
        const d = new Date(now.getTime() - (Math.floor(Math.random() * 58 + 31) * 86400000));
        list.push({ publishedAtDate: d.toISOString() });
      }
      // 91-180d reviews
      const additional180d = Math.max(0, count180d - count90d);
      for (let i = 0; i < additional180d; i++) {
        const d = new Date(now.getTime() - (Math.floor(Math.random() * 88 + 91) * 86400000));
        list.push({ publishedAtDate: d.toISOString() });
      }
      return list;
    };

    const mockPool: RawBusinessInput[] = [
      // 1. Prime High-Conviction NO-WEBSITE Target (High rating, high volume, growing)
      {
        placeId: `mock_place_01_${niche.toLowerCase().replace(/\s+/g, "_")}`,
        name: `Apex ${niche} Specialists`,
        category: niche,
        rating: 4.85,
        reviewCount: 342,
        websiteUrl: null, // NO WEBSITE - Instant High-Priority
        phone: "+1 (555) 234-8901",
        formattedAddress: `104 Central Avenue, ${location}`,
        googleMapsUrl: `https://maps.google.com/?cid=mock_01`,
        reviews: generateReviews(8, 22, 45),
      },
      // 2. High Opportunity Broken Legacy Site (High reviews, stable momentum, no mobile viewport)
      {
        placeId: `mock_place_02_${niche.toLowerCase().replace(/\s+/g, "_")}`,
        name: `Precision ${niche} Care Center`,
        category: niche,
        rating: 4.62,
        reviewCount: 184,
        websiteUrl: "http://localhost:3099/sites/broken-legacy",
        phone: "+1 (555) 345-6789",
        formattedAddress: `402 West Blvd, Suite 12, ${location}`,
        googleMapsUrl: `https://maps.google.com/?cid=mock_02`,
        reviews: generateReviews(4, 11, 26),
      },
      // 3. Custom Operational Software Candidate (Quotation / WhatsApp intake heavy)
      {
        placeId: `mock_place_03_${niche.toLowerCase().replace(/\s+/g, "_")}`,
        name: `Elite Custom ${niche} Works`,
        category: niche,
        rating: 4.91,
        reviewCount: 512,
        websiteUrl: "http://localhost:3099/sites/whatsapp-heavy",
        phone: "+1 (555) 456-7890",
        formattedAddress: `78 Industrial Parkway, ${location}`,
        googleMapsUrl: `https://maps.google.com/?cid=mock_03`,
        reviews: generateReviews(14, 38, 70),
      },
      // 4. Website + Automation Candidate (Lacks online booking/intake)
      {
        placeId: `mock_place_04_${niche.toLowerCase().replace(/\s+/g, "_")}`,
        name: `Metro ${niche} & Associates`,
        category: niche,
        rating: 4.45,
        reviewCount: 96,
        websiteUrl: "http://localhost:3099/sites/modern-no-booking",
        phone: "+1 (555) 567-8901",
        formattedAddress: `512 Market Square, ${location}`,
        googleMapsUrl: `https://maps.google.com/?cid=mock_04`,
        reviews: generateReviews(3, 8, 14),
      },
      // 5. Stale Lead (High reviews, but ZERO reviews in last 90d)
      {
        placeId: `mock_place_05_${niche.toLowerCase().replace(/\s+/g, "_")}`,
        name: `Heritage ${niche} Studio`,
        category: niche,
        rating: 4.70,
        reviewCount: 220,
        websiteUrl: "http://localhost:3099/sites/modern-high-converting",
        phone: "+1 (555) 678-9012",
        formattedAddress: `900 Old Town Road, ${location}`,
        googleMapsUrl: `https://maps.google.com/?cid=mock_05`,
        reviews: generateReviews(0, 0, 2), // Stale
      },
      // 6. Unqualified: Low Rating (3.8★ - Rejected by Gate 1)
      {
        placeId: `mock_place_06_unqualified_rating`,
        name: `Budget Express ${niche}`,
        category: niche,
        rating: 3.75, // Below 4.0
        reviewCount: 150,
        websiteUrl: "http://localhost:3099/sites/budget",
        phone: "+1 (555) 789-0123",
        formattedAddress: `12 Highway 9, ${location}`,
        googleMapsUrl: `https://maps.google.com/?cid=mock_06`,
        reviews: generateReviews(5, 12, 20),
      },
      // 7. Unqualified: Low Reviews (38 reviews - Rejected by Gate 2)
      {
        placeId: `mock_place_07_unqualified_reviews`,
        name: `New Era ${niche}`,
        category: niche,
        rating: 4.95,
        reviewCount: 38, // Below 50
        websiteUrl: "http://localhost:3099/sites/new-era",
        phone: "+1 (555) 890-1234",
        formattedAddress: `300 Sunrise Plaza, ${location}`,
        googleMapsUrl: `https://maps.google.com/?cid=mock_07`,
        reviews: generateReviews(6, 15, 25),
      },
    ];

    return mockPool;
  }
}
