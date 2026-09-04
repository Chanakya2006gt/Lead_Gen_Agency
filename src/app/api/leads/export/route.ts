import { NextResponse } from "next/server";
import { db } from "@/core/db";
import { leads, Lead } from "@/core/db/schema";
import { verifyApiAccess } from "@/core/auth/verifyAccess";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = verifyApiAccess(request);
  if (authError) return authError;

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

    const sanitizeCell = (val: any): string => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      // CSV Formula Injection Prevention: prefix dangerous formula trigger characters with single quote
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = allLeads.map((l: Lead) => {
      const dossier = (l.dossier as any) || {};
      const pitch = dossier.recommendedPitch || {};

      return [
        l.totalLeadScore ?? 0,
        sanitizeCell(l.name),
        sanitizeCell(l.category),
        sanitizeCell(l.opportunityType),
        l.rating !== null ? l.rating : "UNVERIFIED",
        l.reviewCount !== null ? l.reviewCount : "UNVERIFIED",
        l.reviewsLast30Days !== null ? l.reviewsLast30Days : "N/A",
        l.reviewsLast90Days !== null ? l.reviewsLast90Days : "N/A",
        sanitizeCell(l.reviewTrend),
        l.hasWebsite ? "YES" : "NO",
        sanitizeCell(l.websiteUrl),
        sanitizeCell(l.phone),
        sanitizeCell(l.formattedAddress),
        sanitizeCell(l.humanStatus),
        sanitizeCell(pitch.coreAngle),
        sanitizeCell(pitch.estimatedValueRange),
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
    console.error("GET /api/leads/export error:", err);
    return NextResponse.json({ error: "Failed to export leads" }, { status: 500 });
  }
}
