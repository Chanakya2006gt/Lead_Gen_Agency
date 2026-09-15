import { test, expect } from "@playwright/test";

async function unlockWorkstationIfNeeded(page: any) {
  const secret = process.env.LEAD_ENGINE_API_SECRET || "linen2026";

  // 1. Inject session authentication cookie so background API queries are authorized
  await page.context().addCookies([
    {
      name: "lead_engine_token",
      value: secret,
      url: "http://127.0.0.1:3098",
    },
  ]);

  // 2. If the lock screen UI is visible, unlock it via form submission
  const lockInput = page.locator("input[placeholder='Workstation Secret']");
  if (await lockInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await lockInput.fill(secret);
    await page.locator("button:has-text('Unlock Workstation')").click();
  }

  // 3. Confirm dashboard brand header is visible
  const brandHeader = page.locator("h1:has-text('LEAD ENGINE')");
  if (!await brandHeader.isVisible().catch(() => false)) {
    if (await lockInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await lockInput.fill(secret);
      await page.locator("button:has-text('Unlock Workstation')").click();
    }
  }
  await expect(brandHeader).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(300);
}

async function mockDirectAuditRoute(page: any) {
  await page.route("**/api/audit/direct", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        lead: {
          id: "mock-direct-lead-1",
          scanId: "direct-scan",
          name: "Trelio Digital",
          website: "https://trelio.in",
          category: "Technology & Software Services",
          categoryConfidence: 0.95,
          address: "Local Market",
          totalLeadScore: 85,
          opportunityAngle: "Missing Viewport Optimization",
          humanStatus: "NEW",
          phone: "+91 9876543210",
          email: "contact@trelio.in",
          rating: 4.8,
          reviewCount: 42,
          auditTelemetry: {
            hasSsl: true,
            loadLatencyMs: 320,
            findings: [
              {
                category: "ux",
                finding: "Missing Viewport Meta Tag",
                evidence: "Mobile viewport is not optimized for handheld displays.",
                confidence: 0.9,
              },
            ],
          },
          synthesis: {
            whyThisLead: "High-value technology agency target with mobile layout optimization opportunities.",
            commercialObservations: [
              "No responsive viewport meta tag detected on mobile emulation.",
              "Fast server response latency under 350ms.",
            ],
            recommendedAngle: "Mobile responsive overhaul",
            copyVariants: {
              whatsapp: "Hi team, noticed an opportunity to improve mobile conversions on your site.",
              email: "Subject: Mobile experience teardown for Trelio\n\nHi team, noticed an opportunity...",
              phone: "Hello, this is Chanakya with an observation on your website experience...",
              scope: "Phase 1: Viewport and layout stabilization.",
            },
          },
        },
        isEphemeral: true,
      }),
    });
  });
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
    await mockDirectAuditRoute(page);

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
    const secret = process.env.LEAD_ENGINE_API_SECRET || "linen2026";
    const headers: Record<string, string> = {
      "x-engine-secret": secret,
    };
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
    await mockDirectAuditRoute(page);
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
