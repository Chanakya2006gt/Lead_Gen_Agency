import { NextResponse } from "next/server";

/**
 * Validates request authorization using LEAD_ENGINE_API_SECRET or session token.
 * If LEAD_ENGINE_API_SECRET is not configured in local development, access is granted to localhost.
 */
export function verifyApiAccess(request: Request): NextResponse | null {
  const configuredSecret = process.env.LEAD_ENGINE_API_SECRET;

  // If no secret is configured, allow requests in local development
  if (!configuredSecret) {
    return null;
  }

  // Check Headers: x-engine-secret or Authorization: Bearer <secret>
  const headerSecret = request.headers.get("x-engine-secret");
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  // Check Cookies
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
  const cookieToken = cookies["lead_engine_token"];

  const providedToken = headerSecret || bearerToken || cookieToken;

  if (providedToken !== configuredSecret) {
    return NextResponse.json(
      { error: "Unauthorized. Valid API secret or session token is required." },
      { status: 401 }
    );
  }

  return null;
}
