import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get("input");

    if (!input || input.trim().length < 2) {
      return NextResponse.json({ predictions: [] });
    }

    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      // Fallback popular cities if API key is not yet set
      const commonCities = [
        "Warangal, Telangana, India",
        "Hyderabad, Telangana, India",
        "Bengaluru, Karnataka, India",
        "Mumbai, Maharashtra, India",
        "Delhi, India",
        "Dallas, TX, USA",
        "Austin, TX, USA",
        "Phoenix, AZ, USA",
        "Miami, FL, USA",
        "New York, NY, USA",
        "London, United Kingdom",
        "Dubai, United Arab Emirates",
        "Toronto, ON, Canada",
        "Sydney, Australia",
      ];
      const filtered = commonCities
        .filter((c) => c.toLowerCase().includes(input.toLowerCase()))
        .map((description) => ({
          description,
          place_id: `fallback_${Buffer.from(description).toString("hex").substring(0, 12)}`,
        }));
      return NextResponse.json({ predictions: filtered });
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
    return NextResponse.json({ predictions: [], error: err.message }, { status: 500 });
  }
}
