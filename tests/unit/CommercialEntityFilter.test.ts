import { describe, it, expect } from "vitest";
import { CommercialEntityFilter } from "@/features/qualification/CommercialEntityFilter";

describe("CommercialEntityFilter Domain Suite", () => {
  it("Rejects educational and academic institutions", () => {
    const candidate = {
      placeId: "p_edu_1",
      name: "Government Dental College & Hospital",
      category: "Dental School",
      formattedAddress: "Afzal Gunj, Hyderabad",
      rating: 4.5,
      reviewCount: 450,
      websiteUrl: null,
      phone: null,
      googleMapsUrl: null,
      reviews: [],
    };

    const res = CommercialEntityFilter.evaluate(candidate);
    expect(res.isCommercial).toBe(false);
    expect(res.exclusionReason).toContain("Educational");
  });

  it("Rejects public sector and government dispensaries", () => {
    const candidate = {
      placeId: "p_govt_1",
      name: "Urban Primary Health Centre (Govt PHC)",
      category: "Medical Clinic",
      formattedAddress: "Subedari, Warangal",
      rating: 4.2,
      reviewCount: 80,
      websiteUrl: null,
      phone: null,
      googleMapsUrl: null,
      reviews: [],
    };

    const res = CommercialEntityFilter.evaluate(candidate);
    expect(res.isCommercial).toBe(false);
    expect(res.exclusionReason).toContain("Government");
  });

  it("Rejects non-profit associations and regulatory bodies", () => {
    const candidate = {
      placeId: "p_assoc_1",
      name: "Indian Dental Association State Branch",
      category: "Association",
      formattedAddress: "Hyderabad",
      rating: 4.8,
      reviewCount: 30,
      websiteUrl: null,
      phone: null,
      googleMapsUrl: null,
      reviews: [],
    };

    const res = CommercialEntityFilter.evaluate(candidate);
    expect(res.isCommercial).toBe(false);
  });

  it("Rejects B2B surgical equipment wholesale suppliers", () => {
    const candidate = {
      placeId: "p_supply_1",
      name: "Apex Dental Supplies & Surgical Equipment Depot",
      category: "Dental Supply Store",
      formattedAddress: "Balanagar, Hyderabad",
      rating: 4.7,
      reviewCount: 95,
      websiteUrl: null,
      phone: null,
      googleMapsUrl: null,
      reviews: [],
    };

    const res = CommercialEntityFilter.evaluate(candidate);
    expect(res.isCommercial).toBe(false);
  });

  it("Accepts genuine operating commercial businesses", () => {
    const candidate = {
      placeId: "p_comm_1",
      name: "Dr. Sharma Dental Aesthetics & Implant Center",
      category: "Dental Clinic",
      formattedAddress: "Jubilee Hills, Hyderabad",
      rating: 4.9,
      reviewCount: 160,
      websiteUrl: "https://drsharmadental.com",
      phone: "+91 98765 43210",
      googleMapsUrl: null,
      reviews: [],
    };

    const res = CommercialEntityFilter.evaluate(candidate);
    expect(res.isCommercial).toBe(true);
    expect(res.exclusionReason).toBeUndefined();
  });
});
