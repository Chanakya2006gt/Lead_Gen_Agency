import { test, expect } from "@playwright/test";

test.describe("Executive Command Center E2E Smoke & Audit Suite", () => {
  test("Dashboard loads with clean security headers, studio layout, and launchpad", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    // Verify OWASP Security Headers
    const headers = response?.headers() || {};
    expect((headers["x-frame-options"] || "").toLowerCase()).toBe("deny");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");

    // Check Header Brand
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

    // Verify Discovery Engine selector is present
    const engineSelect = page.locator('[data-testid="select-engine"]');
    await expect(engineSelect).toBeVisible();
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
    const viewButton = page.locator("tbody tr button").first();
    await viewButton.click();

    // 4. Verify Sales Intelligence Dossier Modal
    const modal = page.locator(".fixed.inset-0");
    await expect(modal).toBeVisible();
    await expect(modal.locator("text=Why This Lead")).toBeVisible();
    await expect(modal.locator("text=Audit Telemetry & Observations")).toBeVisible();
    await expect(modal.locator("text=High-Conviction Sales Copy")).toBeVisible();

    // 5. Test Copy Script Button
    const copyButton = modal.locator("button:has-text('Copy')").first();
    if (await copyButton.isVisible()) {
      await copyButton.click();
      await expect(modal.locator("text=Copied")).toBeVisible();
    }

    // 6. Test Triage Action (Ready for Outreach)
    const statusSelect = modal.locator("select");
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption("READY_FOR_OUTREACH");
    }

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

    // 2. Filter by Has Website using testid
    const websiteSelect = page.locator('[data-testid="filter-website"]');
    await websiteSelect.selectOption("HAS_WEBSITE");
    await expect(page.locator("tbody tr").first()).toBeVisible();

    // 3. Reset Filter
    await websiteSelect.selectOption("ALL");
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });

  test("CSV Export Endpoint responds with valid CSV headers and data", async ({ request }) => {
    const response = await request.get("/api/leads/export");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");

    const text = await response.text();
    expect(text).toContain("Total Score,Business Name,Category");
  });
});
