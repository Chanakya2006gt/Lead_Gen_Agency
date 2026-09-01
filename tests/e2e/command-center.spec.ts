import { test, expect } from "@playwright/test";
import { MockSiteServer } from "../../src/services/auditor/simulation/mockServer";

test.describe("Executive Command Center E2E Smoke & Audit Suite", () => {
  let mockServer: MockSiteServer;

  test.beforeAll(async () => {
    test.setTimeout(60000);
    mockServer = new MockSiteServer(3099);
    await mockServer.start();
  });

  test.afterAll(async () => {
    if (mockServer) {
      await mockServer.stop();
    }
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

    // Check Header & Branding
    await expect(page.locator("h1")).toContainText("LEAD ENGINE");
    await expect(page.locator("text=LIVE INTELLIGENCE")).toBeVisible();

    // Check Launchpad form
    await expect(page.locator("input[placeholder*='Dental Clinics']")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });

  test("Full Discovery Pipeline: Launch Scan -> Real-Time Ingestion -> Lead Table -> Inspect Dossier -> Triage", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/");

    // 1. Wait for submit button to be enabled
    const submitBtn = page.locator("button[type='submit']");
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });

    // Select Mock Engine for instant deterministic testing & Launch Discovery Scan
    const engineSelect = page.locator('[data-testid="select-engine"]');
    if (await engineSelect.isVisible()) {
      await engineSelect.selectOption("mock");
    }

    await submitBtn.click();

    // 2. Wait for Scan Table to populate
    await expect(page.locator("tbody tr")).not.toHaveCount(0, { timeout: 25000 });
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 25000 });

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
    await page.goto("/");

    // Ensure table has leads
    const firstRow = page.locator("tbody tr").first();
    if ((await page.locator("tbody tr").count()) === 0) {
      const submitBtn = page.locator("button[type='submit']");
      await expect(submitBtn).toBeEnabled({ timeout: 15000 });
      const engineSelect = page.locator('[data-testid="select-engine"]');
      if (await engineSelect.isVisible()) {
        await engineSelect.selectOption("mock");
      }
      await submitBtn.click();
      await expect(firstRow).toBeVisible({ timeout: 25000 });
    } else {
      await expect(firstRow).toBeVisible();
    }

    // Filter by No Website using testid
    const websiteSelect = page.locator('[data-testid="filter-website"]');
    await websiteSelect.selectOption("NO_WEBSITE");

    const noWebsiteBadge = page.locator("tbody span:has-text('NO WEBSITE')").first();
    await expect(noWebsiteBadge).toBeVisible();

    // Reset Filter
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
