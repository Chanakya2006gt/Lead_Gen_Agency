import { NextResponse } from "next/server";
import { db } from "@/core/db";
import { discoveryScans, leads } from "@/core/db/schema";
import { verifyApiAccess } from "@/core/auth/verifyAccess";
import { ScanPipelineService } from "@/features/pipeline/ScanPipelineService";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const authError = verifyApiAccess(request);
  if (authError) return authError;

  try {
    const params = await props.params;
    const scanId = params.id;

    const scan = db
      .select()
      .from(discoveryScans)
      .where(eq(discoveryScans.id, scanId))
      .get();

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    const qualifiedLeads = db
      .select()
      .from(leads)
      .where(eq(leads.scanId, scanId))
      .orderBy(desc(leads.totalLeadScore))
      .all();

    return NextResponse.json({
      scan,
      leads: qualifiedLeads,
    });
  } catch (err: any) {
    console.error("GET /api/scans/[id] error:", err);
    return NextResponse.json({ error: "Failed to retrieve scan details" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const authError = verifyApiAccess(request);
  if (authError) return authError;

  try {
    const params = await props.params;
    const scanId = params.id;

    // 1. Immediately cancel background crawling and audit workers
    await ScanPipelineService.cancelScan(scanId);

    // 2. Safely detach leads and delete scan within an atomic transaction
    db.transaction((tx) => {
      tx.update(leads).set({ scanId: null }).where(eq(leads.scanId, scanId)).run();
      tx.delete(discoveryScans).where(eq(discoveryScans.id, scanId)).run();
    });

    return NextResponse.json({
      success: true,
      message: "Scan deleted successfully",
      scanId,
    });
  } catch (err: any) {
    console.error("DELETE /api/scans/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete scan" }, { status: 500 });
  }
}
