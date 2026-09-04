import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/db";
import { discoveryScans, leads } from "@/core/db/schema";
import { ScanPipelineService } from "@/features/pipeline/ScanPipelineService";
import { verifyApiAccess } from "@/core/auth/verifyAccess";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const createScanSchema = z.object({
  niche: z.string().min(2, "Niche must be at least 2 characters"),
  location: z.string().min(2, "Location must be at least 2 characters"),
  radiusKm: z.number().int().min(1).max(100).default(15),
  source: z.enum(["google_places", "live_google_maps", "serpapi", "mock", "apify", "outscraper"]).default("google_places"),
  mode: z.enum(["STANDARD", "COMMERCIAL", "EXHAUSTIVE"]).default("COMMERCIAL"),
});

export async function GET(request: Request) {
  const authError = verifyApiAccess(request);
  if (authError) return authError;

  try {
    const scans = db
      .select()
      .from(discoveryScans)
      .orderBy(desc(discoveryScans.createdAt))
      .all();

    return NextResponse.json({ scans });
  } catch (err: any) {
    console.error("GET /api/scans error:", err);
    return NextResponse.json({ error: "Failed to retrieve discovery scans" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = verifyApiAccess(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const validated = createScanSchema.parse(body);

    const scanId = await ScanPipelineService.executeScan({
      niche: validated.niche,
      location: validated.location,
      radiusKm: validated.radiusKm,
      source: validated.source,
      mode: validated.mode,
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
    console.error("POST /api/scans error:", err);
    return NextResponse.json({ error: "Failed to initialize discovery scan" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authError = verifyApiAccess(request);
  if (authError) return authError;

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    if (body.confirm !== "DESTROY_ALL") {
      return NextResponse.json(
        { error: "Explicit confirmation required. Body must include { confirm: 'DESTROY_ALL' }." },
        { status: 400 }
      );
    }

    db.transaction((tx) => {
      tx.delete(leads).run();
      tx.delete(discoveryScans).run();
    });

    return NextResponse.json({ success: true, message: "All scan history and leads cleared." });
  } catch (err: any) {
    console.error("DELETE /api/scans error:", err);
    return NextResponse.json({ error: "Failed to clear scan history" }, { status: 500 });
  }
}
