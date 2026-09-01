import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/db";
import { discoveryScans, leads } from "@/core/db/schema";
import { ScanPipelineService } from "@/features/pipeline/ScanPipelineService";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const createScanSchema = z.object({
  niche: z.string().min(2, "Niche must be at least 2 characters"),
  location: z.string().min(2, "Location must be at least 2 characters"),
  radiusKm: z.number().int().min(1).max(100).default(15),
  source: z.enum(["google_places", "live_google_maps", "serpapi", "mock", "apify", "outscraper"]).default("live_google_maps"),
});

export async function GET() {
  try {
    const scans = db
      .select()
      .from(discoveryScans)
      .orderBy(desc(discoveryScans.createdAt))
      .all();

    return NextResponse.json({ scans });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = createScanSchema.parse(body);

    const scanId = await ScanPipelineService.executeScan({
      niche: validated.niche,
      location: validated.location,
      radiusKm: validated.radiusKm,
      source: validated.source,
    });

    return NextResponse.json(
      {
        message: "Scan initialized and pipeline executing in background",
        scanId,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
