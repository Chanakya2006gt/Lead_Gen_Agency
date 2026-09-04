import { NextRequest, NextResponse } from "next/server";
import { LocationResolver } from "@/features/discovery/LocationResolver";
import { MarketContextProvider } from "@/features/commercial/MarketContext";
import { verifyApiAccess } from "@/core/auth/verifyAccess";

export const dynamic = "force-dynamic";

export interface MarketDiscoverySuggestion {
  label: string;
  category: string;
  reason: string;
  confidence: number;
}

export async function GET(req: NextRequest) {
  const authError = verifyApiAccess(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const locationInput = searchParams.get("location") || "";

  const resolvedLocation = LocationResolver.resolve(locationInput);
  const marketContext = MarketContextProvider.resolve(locationInput);

  const suggestions: MarketDiscoverySuggestion[] = [];

  if (marketContext.country === "IN") {
    suggestions.push(
      {
        label: "Dental Clinics & Hospitals",
        category: "Healthcare",
        reason: "High-intent private clinical practices with strong direct conversion ROI",
        confidence: 0.95,
      },
      {
        label: "Luxury Salons & Aesthetics Studios",
        category: "Beauty & Wellness",
        reason: "Premium consumer services located in high-spending commercial zones",
        confidence: 0.9,
      },
      {
        label: "Precision Engineering & Fabrication",
        category: "Industrial",
        reason: "High-capacity B2B enterprises with critical digital storefront gaps",
        confidence: 0.88,
      },
      {
        label: "Multi-Speciality Eye & Skin Care",
        category: "Healthcare",
        reason: "Regional specialized care with high client lifetime value",
        confidence: 0.85,
      }
    );
  } else {
    suggestions.push(
      {
        label: "Dental Practices & Aesthetics",
        category: "Healthcare",
        reason: "High LTV private dental practices and elective cosmetic clinics",
        confidence: 0.95,
      },
      {
        label: "HVAC & Commercial Refrigeration",
        category: "Home Services",
        reason: "Emergency call-driven local maintenance and replacement contracts",
        confidence: 0.92,
      },
      {
        label: "Commercial Roofing Contractors",
        category: "Home Services",
        reason: "High average contract value ($15k–$50k+) with active search demand",
        confidence: 0.9,
      },
      {
        label: "Cosmetic & Medical Aesthetics",
        category: "Wellness",
        reason: "High margin cash-pay elective procedures",
        confidence: 0.88,
      }
    );
  }

  return NextResponse.json({
    location: resolvedLocation,
    marketContext: {
      geography: marketContext.geography,
      country: marketContext.country,
      currency: marketContext.currency,
      cityTier: marketContext.cityTier,
      confidence: marketContext.confidence,
      geographicSignals: marketContext.geographicSignals,
    },
    suggestions,
  });
}
