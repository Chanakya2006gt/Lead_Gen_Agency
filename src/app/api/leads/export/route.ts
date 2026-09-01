import { NextResponse } from "next/server";
import { db } from "@/core/db";
import { leads, Lead } from "@/core/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scanId = searchParams.get("scanId");

    let allLeads: Lead[];
    if (scanId) {
      allLeads = db
        .select()
        .from(leads)
        .where(eq(leads.scanId, scanId))
        .orderBy(desc(leads.totalLeadScore))
        .all();
    } else {
      allLeads = db
        .select()
        .from(leads)
        .orderBy(desc(leads.totalLeadScore))
        .all();
    }

    const headers = [
      "Total Score",
      "Business Name",
      "Category",
      "Opportunity Tier",
      "Rating",
      "Review Count",
      "30d Reviews",
      "90d Reviews",
      "Velocity Trend",
      "Has Website",
      "Website URL",
      "Phone",
      "Address",
      "Triage Status",
      "Core Pitch Angle",
      "Estimated Deal Value",
    ];

    const rows = allLeads.map((l: Lead) => {
      const dossier = (l.dossier as any) || {};
      const pitch = dossier.recommendedPitch || {};

      return [
        l.totalLeadScore ?? 0,
        `"${(l.name || "").replace(/"/g, '""')}"`,
        `"${(l.category || "").replace(/"/g, '""')}"`,
        l.opportunityType,
        l.rating,
        l.reviewCount,
        l.reviewsLast30Days ?? 0,
        l.reviewsLast90Days ?? 0,
        l.reviewTrend,
        l.hasWebsite ? "YES" : "NO",
        `"${(l.websiteUrl || "").replace(/"/g, '""')}"`,
        `"${(l.phone || "").replace(/"/g, '""')}"`,
        `"${(l.formattedAddress || "").replace(/"/g, '""')}"`,
        l.humanStatus,
        `"${(pitch.coreAngle || "").replace(/"/g, '""')}"`,
        `"${(pitch.estimatedValueRange || "").replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lead_engine_export_${Date.now()}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
