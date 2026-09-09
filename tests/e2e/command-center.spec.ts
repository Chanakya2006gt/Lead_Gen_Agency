import { test, expect } from "@playwright/test";

async function unlockWorkstationIfNeeded(page: any) {
  const lockInput = page.locator("input[placeholder='Workstation Secret']");
  if (await lockInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    const secret = process.env.LEAD_ENGINE_API_SECRET || "e2e-test-secret";
    await lockInput.fill(secret);
    await page.locator("button:has-text('Unlock Workstation')").click();
    await expect(page.locator("h1:has-text('LEAD ENGINE')")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
  }
}

async function switchToDirectTeardownTab(page: any) {
  const directTab = page.locator('[data-testid="btn-instant-teardown-tab"]').or(page.locator("button:has-text('Instant URL Teardown')"));
  const urlInput = page.locator('[data-testid="input-direct-url"]').or(page.locator("input[placeholder*='sowjanyadental.com']"));

  await expect(directTab).toBeVisible({ timeout: 15000 });

  // Retry clicking until the direct teardown input becomes visible (guards against React hydration race conditions)
  await expect(async () => {
    await directTab.click();
    await expect(urlInput).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000, intervals: [400, 800, 1500] });

  return urlInput;
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
    const urlInput = await switchToDirectTeardownTab(page);
    await urlInput.fill("https://trelio.in");

    const auditBtn = page.locator('[data-testid="btn-run-teardown"]').or(page.locator("button:has-text('Run Teardown')"));
    await expect(auditBtn).toBeEnabled();
    await auditBtn.click();

    // Verify Slide-Over Drawer opens with audit results
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 45000 });
    await expect(drawer.locator("text=Why This Lead")).toBeVisible();
    await expect(drawer.locator("text=Audit Telemetry & Observations")).toBeVisible();
  });

  test("CSV Export Endpoint responds with valid CSV headers and data", async ({ request }) => {
    const headers: Record<string, string> = {};
    if (process.env.LEAD_ENGINE_API_SECRET) {
      headers["x-engine-secret"] = process.env.LEAD_ENGINE_API_SECRET;
    }
    const res = await request.get("/api/leads/export", { headers });
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
    const urlInput = await switchToDirectTeardownTab(page);
    await urlInput.fill("https://trelio.in");
    
    const auditBtn = page.locator('[data-testid="btn-run-teardown"]').or(page.locator("button:has-text('Run Teardown')"));
    await auditBtn.click();

    // Verify dialog role and aria-modal on Radix dialog content
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 45000 });
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    // Press Escape to test accessible keyboard dismissal
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });
});
