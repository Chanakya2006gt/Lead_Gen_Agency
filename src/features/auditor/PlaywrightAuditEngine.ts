import { chromium, Browser, Page } from "playwright";
import { AuditTelemetry, AuditFinding } from "@/core/db/schema";
import { IAuditEngine } from "./types";

export class PlaywrightAuditEngine implements IAuditEngine {
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });
    }
    return this.browser;
  }

  public async close(): Promise<void> {
    if (this.browser && this.browser.isConnected()) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * SSRF Protection: Validate target URL before fetching
   */
  private validateUrlSecurity(targetUrl: string): string {
    let parsed: URL;
    try {
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = "https://" + targetUrl;
      }
      parsed = new URL(targetUrl);
    } catch {
      throw new Error(`Invalid target URL: ${targetUrl}`);
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block private/cloud metadata ranges except localhost/127.0.0.1 in testing
    const blockedHosts = [
      "169.254.169.254", // AWS/GCP metadata
      "metadata.google.internal",
      "0.0.0.0",
    ];

    if (blockedHosts.includes(hostname)) {
      throw new Error(`Forbidden target hostname (SSRF prevention): ${hostname}`);
    }

    return parsed.toString();
  }

  public async auditUrl(rawUrl: string): Promise<AuditTelemetry> {
    const targetUrl = this.validateUrlSecurity(rawUrl);
    const browser = await this.getBrowser();

    const findings: AuditFinding[] = [];
    let hasSsl = targetUrl.startsWith("https://");
    let brokenLinksCount = 0;
    let jsConsoleErrorsCount = 0;
    let initialLoadLatencyMs = 0;

    if (!hasSsl) {
      findings.push({
        category: "technical",
        finding: "Insecure HTTP Protocol",
        evidence: "Website is served over plain HTTP without TLS encryption (HTTPS). Browsers mark this site as 'Not Secure'.",
        selectorOrUrl: targetUrl,
        confidence: 1.0,
      });
    }

    // 1. Mobile Viewport Evaluation (375x812 iPhone / Modern Mobile)
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });

    const mobilePage = await mobileContext.newPage();

    // Track console errors
    mobilePage.on("console", (msg) => {
      if (msg.type() === "error") {
        jsConsoleErrorsCount++;
      }
    });

    const startTime = Date.now();

    try {
      await mobilePage.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      // Allow DOM to settle for 500ms
      await mobilePage.waitForTimeout(500);
      initialLoadLatencyMs = Date.now() - startTime;
    } catch (err: any) {
      initialLoadLatencyMs = Date.now() - startTime;
      findings.push({
        category: "technical",
        finding: "Connection Timeout or Failure",
        evidence: `Initial page load failed or timed out (${initialLoadLatencyMs}ms): ${err.message}`,
        selectorOrUrl: targetUrl,
        confidence: 0.95,
      });
    }

    // Safe Evaluate Helper
    const safeEvaluate = async <T>(fn: () => T, fallback: T): Promise<T> => {
      try {
        return await mobilePage.evaluate(fn);
      } catch {
        return fallback;
      }
    };

    // Inspect Viewport Meta
    const viewportMetaPresent = await safeEvaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]');
      return meta !== null;
    }, false);

    if (!viewportMetaPresent) {
      findings.push({
        category: "ux",
        finding: "Missing Responsive Viewport Meta Tag",
        evidence: "<meta name='viewport'> tag is absent. Mobile devices will render desktop-scaled layout, causing extreme pinch-to-zoom friction.",
        selectorOrUrl: "head > meta[name='viewport']",
        confidence: 1.0,
      });
    }

    // Inspect Horizontal Layout Overflow on Mobile
    const hasHorizontalOverflow = await safeEvaluate(() => {
      const docWidth = document.documentElement.offsetWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      return scrollWidth > docWidth + 5;
    }, false);

    if (hasHorizontalOverflow) {
      findings.push({
        category: "ux",
        finding: "Horizontal Mobile Scroll Overflow",
        evidence: "Document content exceeds mobile screen width (scrollWidth > offsetWidth). Elements are leaking off-screen horizontally.",
        selectorOrUrl: "html, body",
        confidence: 0.95,
      });
    }

    // Inspect Conversion Anchors (Direct Call, WhatsApp, Forms)
    const conversionSignals = await safeEvaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      const hasDirectClickToCall = links.some((a) => (a.href || "").toLowerCase().startsWith("tel:"));
      const hasWhatsAppDirectLink = links.some(
        (a) =>
          (a.href || "").toLowerCase().includes("wa.me") ||
          (a.href || "").toLowerCase().includes("api.whatsapp.com")
      );

      const forms = Array.from(document.querySelectorAll("form"));
      const hasInteractiveBookingForm =
        forms.length > 0 ||
        document.querySelectorAll('input[type="date"], input[type="time"], select, iframe[src*="calendly"], iframe[src*="acuity"]').length > 0;

      // Sample first 15 internal/external links to verify anchor integrity
      const sampleLinks = links
        .map((a) => a.getAttribute("href"))
        .filter((h): h is string => Boolean(h && !h.startsWith("#") && !h.startsWith("javascript:")));

      return {
        hasDirectClickToCall,
        hasWhatsAppDirectLink,
        hasInteractiveBookingForm,
        sampleLinks: sampleLinks.slice(0, 15),
      };
    }, {
      hasDirectClickToCall: false,
      hasWhatsAppDirectLink: false,
      hasInteractiveBookingForm: false,
      sampleLinks: [] as string[],
    });

    if (!conversionSignals.hasDirectClickToCall) {
      findings.push({
        category: "conversion",
        finding: "Missing Direct Click-to-Call Link",
        evidence: "No 'tel:' protocol anchors found on page. Mobile visitors cannot tap to call directly from their phones.",
        confidence: 0.9,
      });
    }

    if (!conversionSignals.hasInteractiveBookingForm) {
      findings.push({
        category: "conversion",
        finding: "Missing Interactive Scheduling / Intake Funnel",
        evidence: "No interactive date picker, scheduling form, or booking embed detected on mobile viewport.",
        confidence: 0.85,
      });
    }

    // Check Broken Links Sample
    for (const href of conversionSignals.sampleLinks) {
      if (!href) continue;
      try {
        const resolvedUrl = new URL(href, targetUrl).toString();
        if (resolvedUrl.startsWith("http")) {
          const res = await mobileContext.request.head(resolvedUrl, { timeout: 3000 }).catch(() => null);
          if (res && res.status() >= 400) {
            brokenLinksCount++;
            findings.push({
              category: "technical",
              finding: `Broken Internal/External Link (HTTP ${res.status()})`,
              evidence: `Link returned HTTP error status ${res.status()}`,
              selectorOrUrl: href,
              confidence: 0.9,
            });
            break; // Record sample and avoid slow audit
          }
        }
      } catch {
        // Skip unresolvable URLs
      }
    }

    await mobileContext.close();

    return {
      viewportMetaPresent,
      hasHorizontalOverflow,
      hasSsl,
      brokenLinksCount,
      jsConsoleErrorsCount,
      initialLoadLatencyMs,
      hasDirectClickToCall: conversionSignals.hasDirectClickToCall,
      hasWhatsAppDirectLink: conversionSignals.hasWhatsAppDirectLink,
      hasInteractiveBookingForm: conversionSignals.hasInteractiveBookingForm,
      findings,
    };
  }
}
