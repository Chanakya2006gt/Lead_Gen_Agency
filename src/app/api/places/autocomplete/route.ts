import { NextResponse } from "next/server";
import { verifyApiAccess } from "@/core/auth/verifyAccess";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = verifyApiAccess(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get("input");

    if (!input || input.trim().length < 2) {
      return NextResponse.json({ predictions: [] });
    }

    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ predictions: [] });
    }

    // Call Google Places Autocomplete API (cities and regions)
    const googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      input.trim()
    )}&types=(regions)&key=${apiKey}`;

    const res = await fetch(googleUrl);
    if (!res.ok) {
      throw new Error(`Google Autocomplete HTTP ${res.status}`);
    }

    const data = await res.json();
    const predictions = (data.predictions || []).map((p: any) => ({
      description: p.description,
      place_id: p.place_id,
      main_text: p.structured_formatting?.main_text || p.description,
      secondary_text: p.structured_formatting?.secondary_text || "",
    }));

    return NextResponse.json({ predictions });
  } catch (err: any) {
    console.error("Places autocomplete error:", err);
    return NextResponse.json({ predictions: [] });
  }
}
