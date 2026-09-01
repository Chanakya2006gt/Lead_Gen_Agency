import { NextResponse } from "next/server";
import { db } from "@/db";
import { discoveryScans, leads } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
