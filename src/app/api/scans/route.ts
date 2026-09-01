import { NextResponse } from "next/server";
import { db } from "@/db";
import { discoveryScans, leads } from "@/db/schema";
import { desc } from "drizzle-orm";
import { ScanPipelineService } from "@/services/pipeline/ScanPipelineService";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createScanSchema = z.object({
  niche: z.string().min(2, "Niche must be at least 2 characters"),
  location: z.string().min(2, "Location must be at least 2 characters"),
  radiusKm: z.number().int().min(1).max(100).default(15),
  source: z.enum(["live_google_maps", "serpapi", "mock", "apify", "outscraper"]).default("live_google_maps"),
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
    const parsed = createScanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const scanId = await ScanPipelineService.executeScan({
      niche: parsed.data.niche,
      location: parsed.data.location,
      radiusKm: parsed.data.radiusKm,
      source: parsed.data.source,
    });

    return NextResponse.json({ scanId, status: "RUNNING" }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
