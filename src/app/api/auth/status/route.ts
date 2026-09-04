import { NextResponse } from "next/server";
import { verifyApiAccess } from "@/core/auth/verifyAccess";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const configuredSecret = process.env.LEAD_ENGINE_API_SECRET;
  const allowInsecure = (process.env.NODE_ENV !== "production" && process.env.ALLOW_INSECURE_LOCAL_AUTH === "true") && (!configuredSecret || configuredSecret.trim().length === 0);
  const authError = verifyApiAccess(request);

  return NextResponse.json({
    authenticated: !authError,
    requiresAuth: Boolean(configuredSecret && configuredSecret.trim().length > 0),
    allowInsecure,
  });
}
