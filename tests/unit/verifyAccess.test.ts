import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyApiAccess } from "@/core/auth/verifyAccess";

describe("Fail-Closed API Authentication Guard (verifyApiAccess)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("Denies access (401) when secret is unset in production environment", () => {
    delete process.env.LEAD_ENGINE_API_SECRET;
    delete process.env.ALLOW_INSECURE_LOCAL_AUTH;
    (process.env as any).NODE_ENV = "production";

    const req = new Request("http://localhost:3000/api/scans", {
      method: "GET",
    });

    const result = verifyApiAccess(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it("Denies access (401) in production even if ALLOW_INSECURE_LOCAL_AUTH is set to 'true'", () => {
    delete process.env.LEAD_ENGINE_API_SECRET;
    process.env.ALLOW_INSECURE_LOCAL_AUTH = "true";
    (process.env as any).NODE_ENV = "production";

    const req = new Request("http://localhost:3000/api/scans", {
      method: "GET",
    });

    const result = verifyApiAccess(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it("Denies access (401) in development when ALLOW_INSECURE_LOCAL_AUTH is not set to 'true'", () => {
    delete process.env.LEAD_ENGINE_API_SECRET;
    delete process.env.ALLOW_INSECURE_LOCAL_AUTH;
    (process.env as any).NODE_ENV = "development";

    const req = new Request("http://localhost:3000/api/scans", {
      method: "GET",
    });

    const result = verifyApiAccess(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it("Allows access in development when ALLOW_INSECURE_LOCAL_AUTH is explicitly 'true'", () => {
    delete process.env.LEAD_ENGINE_API_SECRET;
    (process.env as any).NODE_ENV = "development";
    process.env.ALLOW_INSECURE_LOCAL_AUTH = "true";

    const req = new Request("http://localhost:3000/api/scans", {
      method: "GET",
    });

    const result = verifyApiAccess(req);
    expect(result).toBeNull();
  });

  it("Denies access (401) when secret is set but invalid token is provided", () => {
    process.env.LEAD_ENGINE_API_SECRET = "secure-workstation-token-12345";

    const req = new Request("http://localhost:3000/api/scans", {
      method: "POST",
      headers: {
        "x-engine-secret": "wrong-secret",
      },
    });

    const result = verifyApiAccess(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it("Allows access when valid x-engine-secret header is supplied", () => {
    process.env.LEAD_ENGINE_API_SECRET = "secure-workstation-token-12345";

    const req = new Request("http://localhost:3000/api/scans", {
      method: "POST",
      headers: {
        "x-engine-secret": "secure-workstation-token-12345",
      },
    });

    const result = verifyApiAccess(req);
    expect(result).toBeNull();
  });

  it("Allows access when valid Bearer authorization header is supplied", () => {
    process.env.LEAD_ENGINE_API_SECRET = "secure-workstation-token-12345";

    const req = new Request("http://localhost:3000/api/scans", {
      method: "POST",
      headers: {
        Authorization: "Bearer secure-workstation-token-12345",
      },
    });

    const result = verifyApiAccess(req);
    expect(result).toBeNull();
  });

  it("Allows access when valid lead_engine_token cookie is supplied", () => {
    process.env.LEAD_ENGINE_API_SECRET = "secure-workstation-token-12345";

    const req = new Request("http://localhost:3000/api/scans", {
      method: "GET",
      headers: {
        Cookie: "lead_engine_token=secure-workstation-token-12345; other_cookie=xyz",
      },
    });

    const result = verifyApiAccess(req);
    expect(result).toBeNull();
  });
});
