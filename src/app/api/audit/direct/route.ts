import { NextResponse } from "next/server";
import { z } from "zod";
import { DirectAuditService } from "@/features/auditor/DirectAuditService";
import { verifyApiAccess } from "@/core/auth/verifyAccess";

export const dynamic = "force-dynamic";

const directAuditSchema = z.object({
  url: z.string().min(3, "Website URL is required"),
  name: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  persist: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const authError = verifyApiAccess(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const validated = directAuditSchema.parse(body);

    const result = await DirectAuditService.executeDirectTeardown({
      url: validated.url,
      name: validated.name,
      category: validated.category,
      location: validated.location,
      persist: validated.persist,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    console.error("POST /api/audit/direct error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to complete direct website teardown" },
      { status: err.message?.includes("forbidden") || err.message?.includes("Invalid URL") || err.message?.includes("restricted") ? 400 : 500 }
    );
  }
}
