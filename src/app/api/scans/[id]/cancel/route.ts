import { NextResponse } from "next/server";
import { ScanPipelineService } from "@/features/pipeline/ScanPipelineService";
import { verifyApiAccess } from "@/core/auth/verifyAccess";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const authError = verifyApiAccess(request);
  if (authError) return authError;

  try {
    const params = await props.params;
    const scanId = params.id;
    await ScanPipelineService.cancelScan(scanId);
    return NextResponse.json({ success: true, scanId, status: "CANCELLED" });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to cancel scan", message: err.message },
      { status: 500 }
    );
  }
}
