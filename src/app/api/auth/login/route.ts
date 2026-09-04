import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { secret } = body || {};

    const configuredSecret = process.env.LEAD_ENGINE_API_SECRET;

    const isHttps = request.url.startsWith("https://") || (request.headers.get("x-forwarded-proto") === "https");
    const isLocalhost = request.url.includes("localhost") || request.url.includes("127.0.0.1");
    const useSecureCookie = process.env.NODE_ENV === "production" && isHttps && !isLocalhost;

    if (!configuredSecret || configuredSecret.trim().length === 0) {
      if (process.env.NODE_ENV !== "production" || process.env.ALLOW_INSECURE_LOCAL_AUTH === "true") {
        const response = NextResponse.json({ success: true, message: "Local insecure authentication allowed." });
        response.cookies.set("lead_engine_token", "insecure_local_dev", {
          httpOnly: true,
          secure: useSecureCookie,
          sameSite: "strict",
          path: "/",
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
        return response;
      }

      return NextResponse.json(
        { error: "LEAD_ENGINE_API_SECRET is not configured on server. Access locked." },
        { status: 500 }
      );
    }

    if (!secret || typeof secret !== "string") {
      return NextResponse.json({ error: "Secret is required." }, { status: 400 });
    }

    // Timing-safe cryptographic comparison using SHA-256 digest buffers
    const configuredHash = crypto.createHash("sha256").update(configuredSecret.trim()).digest();
    const providedHash = crypto.createHash("sha256").update(secret.trim()).digest();

    const isMatch = crypto.timingSafeEqual(configuredHash, providedHash);

    if (!isMatch) {
      return NextResponse.json({ error: "Invalid workstation API secret." }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, message: "Workstation session established." });
    response.cookies.set("lead_engine_token", configuredSecret.trim(), {
      httpOnly: true,
      secure: useSecureCookie,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error("POST /api/auth/login error:", err);
    return NextResponse.json({ error: "Authentication failed." }, { status: 500 });
  }
}
