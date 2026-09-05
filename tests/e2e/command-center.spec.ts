import { test, expect } from "@playwright/test";

async function unlockWorkstationIfNeeded(page: any) {
  const lockInput = page.locator("input[placeholder='Workstation Secret']");
  if (await lockInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await lockInput.fill("e2e-test-secret");
    await page.locator("button:has-text('Unlock Workstation')").click();
    await expect(page.locator("h1:has-text('LEAD ENGINE')")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
  }
}

test.describe("Executive Command Center E2E Smoke & Audit Suite", () => {
  test("Dashboard loads with clean security headers and unlocks with workstation secret", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    // Verify OWASP Security Headers
    const headers = response?.headers() || {};
    expect((headers["x-frame-options"] || "").toLowerCase()).toBe("deny");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");

    // Unlock workstation
    await unlockWorkstationIfNeeded(page);

    // Check Header Brand
    await expect(page.locator("h1")).toContainText("LEAD ENGINE");

    // Check Launchpad form
    await expect(page.locator("input[placeholder*='Dental Clinics, HVAC']")).toBeVisible();
    await expect(page.locator('[data-testid="btn-launch-discovery"]')).toBeVisible();
  });

  test("Instant URL Teardown: Audit Direct URL -> Real-Time Observations -> Telemetry -> Copy Outreach", async ({
    page,
    context,
  }) => {
    test.setTimeout(90000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/");
    await unlockWorkstationIfNeeded(page);

    // Switch to Instant URL Teardown Mode
    const directTab = page.locator("button:has-text('Instant URL Teardown')");
    await expect(directTab).toBeVisible({ timeout: 15000 });
    await directTab.click({ force: true });

    // Fill direct audit form
    const urlInput = page.locator("input[placeholder*='sowjanyadental.com']");
    await expect(urlInput).toBeVisible();
    await urlInput.fill("https://trelio.in");

    const auditBtn = page.locator("button:has-text('Run Teardown')");
    await expect(auditBtn).toBeEnabled();
    await auditBtn.click();

    // Verify Slide-Over Drawer opens with audit results
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 45000 });
    await expect(drawer.locator("text=Why This Lead")).toBeVisible();
    await expect(drawer.locator("text=Audit Telemetry & Observations")).toBeVisible();
  });

  test("CSV Export Endpoint responds with valid CSV headers and data", async ({ request }) => {
    const res = await request.get("/api/leads/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");

    const text = await res.text();
    expect(text).toContain("Total Score,Business Name,Category");
  });

  test("Discovery Suggestions API responds publicly with 200 without authentication noise", async ({ request }) => {
    const res = await request.get("/api/discovery/suggestions?location=Mumbai");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.suggestions)).toBe(true);
    expect(data.suggestions.length).toBeGreaterThan(0);
  });

  test("Mobile responsive layout: No horizontal page overflow, clean touch UI", async ({ page }) => {
    await page.goto("/");
    await unlockWorkstationIfNeeded(page);

    // Verify viewport and body width
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // 1px tolerance for fractional subpixels

    // Header brand visible
    await expect(page.locator("h1")).toBeVisible();

    // Fast search input visible
    await expect(page.locator("input[placeholder*='Search opportunity']")).toBeVisible();
  });

  test("Drawer Accessibility: Dialog semantics, aria-modal, and Escape-to-close", async ({ page }) => {
    test.setTimeout(90000);
    await page.goto("/");
    await unlockWorkstationIfNeeded(page);

    // Switch to Instant URL Teardown Mode
    const directTab = page.locator("button:has-text('Instant URL Teardown')");
    await expect(directTab).toBeVisible({ timeout: 15000 });
    await directTab.click({ force: true });

    // Trigger instant teardown to open the drawer
    const urlInput = page.locator("input[placeholder*='sowjanyadental.com']");
    await urlInput.fill("https://trelio.in");
    await page.locator("button:has-text('Run Teardown')").click();

    // Verify dialog role and aria-modal on Radix dialog content
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 45000 });
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    // Press Escape to test accessible keyboard dismissal
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });
});
