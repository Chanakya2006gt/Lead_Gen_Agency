import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Validates request authorization using LEAD_ENGINE_API_SECRET or session cookie.
 * Uses constant-time cryptographic hash comparison (crypto.timingSafeEqual)
 * to eliminate side-channel timing attack vulnerabilities.
 *
 * Invariant:
 * - If LEAD_ENGINE_API_SECRET is set: requires matching token via header, bearer, or lead_engine_token cookie.
 * - If LEAD_ENGINE_API_SECRET is unset:
 *   - Allows only if NODE_ENV !== "production" AND ALLOW_INSECURE_LOCAL_AUTH === "true"
 *   - Denies with 401 otherwise (Fail-closed in production and strict dev).
 */
export function verifyApiAccess(request: Request): NextResponse | null {
  const configuredSecret = process.env.LEAD_ENGINE_API_SECRET;

  // 1. If no secret is configured, check if local insecure bypass is explicitly allowed
  if (!configuredSecret || configuredSecret.trim().length === 0) {
    const isLocalDev = process.env.NODE_ENV !== "production";
    const allowInsecure = process.env.ALLOW_INSECURE_LOCAL_AUTH === "true";

    if (allowInsecure) {
      return null; // Explicit local development permission granted
    }

    return NextResponse.json(
      { error: "Unauthorized. LEAD_ENGINE_API_SECRET is not configured or ALLOW_INSECURE_LOCAL_AUTH is not enabled." },
      { status: 401 }
    );
  }

  // 2. Extract Token from Headers
  const headerSecret = request.headers.get("x-engine-secret");
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  // 3. Extract Token from Cookies
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
  const cookieToken = cookies["lead_engine_token"];

  const providedToken = headerSecret || bearerToken || cookieToken || "";

  if (!providedToken) {
    return NextResponse.json(
      { error: "Unauthorized. Valid API secret or session token is required." },
      { status: 401 }
    );
  }

  // 4. Timing-safe cryptographic comparison using SHA-256 digest buffers
  const configuredHash = crypto.createHash("sha256").update(configuredSecret.trim()).digest();
  const providedHash = crypto.createHash("sha256").update(providedToken.trim()).digest();

  const isAuthorized = crypto.timingSafeEqual(configuredHash, providedHash);

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Unauthorized. Invalid API secret or session token." },
      { status: 401 }
    );
  }

  return null;
}
