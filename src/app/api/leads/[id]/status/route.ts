import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const statusSchema = z.object({
  status: z.enum(["NEW", "REVIEWED", "READY_FOR_OUTREACH", "ARCHIVED"]),
});

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const leadId = params.id;
    const body = await request.json();

    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const updated = db
      .update(leads)
      .set({
        humanStatus: parsed.data.status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(leads.id, leadId))
      .returning()
      .get();

    if (!updated) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({ lead: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
