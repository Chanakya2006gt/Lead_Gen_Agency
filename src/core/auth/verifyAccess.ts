import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Validates request authorization using LEAD_ENGINE_API_SECRET or session token.
 * Uses constant-time cryptographic hash comparison (crypto.timingSafeEqual)
 * to eliminate side-channel timing attack vulnerabilities.
 * If LEAD_ENGINE_API_SECRET is not configured in local development, access is granted.
 */
export function verifyApiAccess(request: Request): NextResponse | null {
  const configuredSecret = process.env.LEAD_ENGINE_API_SECRET;

  // If no secret is configured, allow requests in local development
  if (!configuredSecret || configuredSecret.trim().length === 0) {
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

  const providedToken = headerSecret || bearerToken || cookieToken || "";

  // Timing-safe cryptographic comparison using SHA-256 digest buffers
  const configuredHash = crypto.createHash("sha256").update(configuredSecret).digest();
  const providedHash = crypto.createHash("sha256").update(providedToken).digest();

  const isAuthorized = crypto.timingSafeEqual(configuredHash, providedHash);

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Unauthorized. Valid API secret or session token is required." },
      { status: 401 }
    );
  }

  return null;
}
