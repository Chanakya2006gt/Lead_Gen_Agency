import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/db";
import { leads, HumanStatus } from "@/core/db/schema";
import { verifyApiAccess } from "@/core/auth/verifyAccess";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const updateStatusSchema = z.object({
  status: z.enum(["NEW", "REVIEWED", "READY_FOR_OUTREACH", "ARCHIVED"]),
});

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const authError = verifyApiAccess(request);
  if (authError) return authError;

  try {
    const params = await props.params;
    const leadId = params.id;
    const body = await request.json();
    const validated = updateStatusSchema.parse(body);

    const updated = db
      .update(leads)
      .set({
        humanStatus: validated.status as HumanStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(leads.id, leadId))
      .returning()
      .get();

    if (!updated) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Status updated successfully",
      lead: updated,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    console.error("PATCH /api/leads/[id]/status error:", err);
    return NextResponse.json({ error: "Failed to update triage status" }, { status: 500 });
  }
}
