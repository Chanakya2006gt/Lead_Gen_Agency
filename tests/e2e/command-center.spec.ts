import { test, expect } from "@playwright/test";
import { MockSiteServer } from "../../src/features/auditor/mockServer";

test.describe("Executive Command Center E2E Smoke & Audit Suite", () => {
  let mockServer: MockSiteServer;

  test.beforeAll(async () => {
    test.setTimeout(60000);
    try {
      mockServer = new MockSiteServer(3099);
      await mockServer.start();
    } catch (err) {
      console.warn("Mock server 3099 initialization:", err);
    }
  });

  test.afterAll(async () => {
    if (mockServer) {
      try {
        await mockServer.stop();
      } catch {}
    }
    try {
      const { db } = await import("../../src/core/db");
      const { discoveryScans, leads } = await import("../../src/core/db/schema");
      const { like, eq } = await import("drizzle-orm");
      const demoLeads = db.select().from(leads).where(like(leads.name, "%[DEMO]%")).all();
      for (const dl of demoLeads) {
        if (dl.scanId) {
          db.delete(discoveryScans).where(eq(discoveryScans.id, dl.scanId)).run();
          db.delete(leads).where(eq(leads.scanId, dl.scanId)).run();
        }
      }
    } catch {}
  });

  test("Dashboard loads with clean security headers, studio layout, and launchpad", async ({
    page,
  }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    // Verify OWASP Security Headers
    const headers = response?.headers() || {};
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");

    // Check Header Brand Elements
    await expect(page.locator("h1")).toContainText("LEAD ENGINE");

    // Check Launchpad form
    await expect(page.locator("input[placeholder*='Dental Clinics']")).toBeVisible();
    await expect(page.locator('[data-testid="btn-launch-discovery"]')).toBeVisible();
  });

  test("Full Discovery Pipeline: Launch Scan -> Real-Time Ingestion -> Lead Table -> Inspect Dossier -> Triage", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/");

    // 1. Wait for submit button to be enabled
    const submitBtn = page.locator('[data-testid="btn-launch-discovery"]');
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });

    // Select Mock Engine for instant deterministic testing & Launch Discovery Scan
    const engineSelect = page.locator('[data-testid="select-engine"]');
    if (await engineSelect.isVisible()) {
      await engineSelect.selectOption("mock");
    }

    await page.waitForTimeout(300);

    const [scanResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/scans") && res.request().method() === "POST", {
        timeout: 15000,
      }),
      submitBtn.click({ force: true }),
    ]);
    expect(scanResponse.status()).toBe(201);

    // 2. Wait for Scan Table to populate
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 35000 });

    // 3. Inspect a High-Conviction Lead Dossier
    const inspectButton = page.locator("button:has-text('Inspect')").first();
    await inspectButton.click();

    // 4. Verify Lead Dossier Modal
    const modal = page.locator(".fixed.inset-0");
    await expect(modal).toBeVisible();
    await expect(modal.locator("text=LEAD SCORE")).toBeVisible();
    await expect(modal.locator("text=Reputation Velocity")).toBeVisible();
    await expect(modal.locator("text=Digital Surface Gap")).toBeVisible();
    await expect(modal.locator("text=Surgical Pitch & Outreach Deck")).toBeVisible();

    // 5. Test Copy Script Button
    const copyButton = modal.locator("button:has-text('Copy Script')");
    if (await copyButton.isVisible()) {
      await copyButton.click();
      await expect(modal.locator("text=Copied to Clipboard!")).toBeVisible();
    }

    // 6. Test Triage Action (Ready for Outreach)
    const outreachBtn = modal.locator("button:has-text('Ready for Outreach')");
    await outreachBtn.click();
    await expect(modal.locator("text=READY_FOR_OUTREACH")).toBeVisible();

    // 7. Close Modal
    const closeBtn = modal.locator("button:has(svg.lucide-x)");
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test("Filter & Search Controls Work Smoothly", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/");

    // 1. Wait for Scan Table to populate from existing scans
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 15000 });

    // 2. Filter by No Website using testid
    const websiteSelect = page.locator('[data-testid="filter-website"]');
    await websiteSelect.selectOption("NO_WEBSITE");

    const noWebsiteBadge = page.locator("tbody span:has-text('NO WEBSITE')").first();
    await expect(noWebsiteBadge).toBeVisible();

    // 3. Reset Filter
    await websiteSelect.selectOption("ALL");
  });

  test("CSV Export Endpoint responds with valid CSV headers and data", async ({ request }) => {
    const response = await request.get("/api/leads/export");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");

    const text = await response.text();
    expect(text).toContain("Total Score,Business Name,Category");
  });
});
