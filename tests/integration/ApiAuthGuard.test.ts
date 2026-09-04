import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET as getSuggestions } from "@/app/api/discovery/suggestions/route";
import { GET as getScans, POST as postScans, DELETE as deleteScans } from "@/app/api/scans/route";
import { GET as exportLeads } from "@/app/api/leads/export/route";
import { POST as directAudit } from "@/app/api/audit/direct/route";
import { NextRequest } from "next/server";

describe("API Routes Fail-Closed Authentication & Invariant Integration Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("All protected endpoints return 401 in production when unauthenticated", async () => {
    process.env.LEAD_ENGINE_API_SECRET = "production-super-secret";
    (process.env as any).NODE_ENV = "production";

    // 1. GET /api/discovery/suggestions
    const sugReq = new NextRequest("http://localhost:3000/api/discovery/suggestions?location=Hyderabad");
    const sugRes = await getSuggestions(sugReq);
    expect(sugRes.status).toBe(401);

    // 2. GET /api/scans
    const scansReq = new Request("http://localhost:3000/api/scans");
    const scansRes = await getScans(scansReq);
    expect(scansRes.status).toBe(401);

    // 3. POST /api/scans
    const postReq = new Request("http://localhost:3000/api/scans", {
      method: "POST",
      body: JSON.stringify({ niche: "Dental", location: "Warangal" }),
    });
    const postRes = await postScans(postReq);
    expect(postRes.status).toBe(401);

    // 4. GET /api/leads/export
    const exportReq = new Request("http://localhost:3000/api/leads/export");
    const exportRes = await exportLeads(exportReq);
    expect(exportRes.status).toBe(401);

    // 5. POST /api/audit/direct
    const directReq = new Request("http://localhost:3000/api/audit/direct", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const directRes = await directAudit(directReq);
    expect(directRes.status).toBe(401);
  });

  it("DELETE /api/scans requires explicit { confirm: 'DESTROY_ALL' }", async () => {
    process.env.LEAD_ENGINE_API_SECRET = "test-secret";

    const deleteReqWithoutConfirm = new Request("http://localhost:3000/api/scans", {
      method: "DELETE",
      headers: {
        "x-engine-secret": "test-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirm: "wrong" }),
    });

    const res = await deleteScans(deleteReqWithoutConfirm);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("DESTROY_ALL");
  });
});
