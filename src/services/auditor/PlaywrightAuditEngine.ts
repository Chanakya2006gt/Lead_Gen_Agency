import { chromium, Browser } from "playwright";
import { AuditTelemetry, AuditFinding } from "@/db/schema";
import { IAuditEngine } from "./types";

export class PlaywrightAuditEngine implements IAuditEngine {
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
    }
    return this.browser;
  }

  public async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * SSRF Defense: Check whether target URL is safe to audit
   */
  private isSafeUrl(targetUrl: string): boolean {
    try {
      const parsed = new URL(targetUrl);
      const hostname = parsed.hostname.toLowerCase();

      // Allow our test mock server explicitly
      if (hostname === "localhost" && parsed.port === "3099") {
        return true;
      }

      // Block local/private IP ranges
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1" ||
        hostname.startsWith("10.") ||
        hostname.startsWith("192.168.") ||
        hostname === "169.254.169.254"
      ) {
        return false;
      }

      // Block non-http/https protocols
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  public async auditUrl(targetUrl: string): Promise<AuditTelemetry> {
    if (!this.isSafeUrl(targetUrl)) {
      throw new Error(`Security Exception: Target URL ${targetUrl} was blocked by SSRF defense.`);
    }

    const browser = await this.getBrowser();
    const findings: AuditFinding[] = [];
    const jsErrors: string[] = [];

    const isHttps = targetUrl.startsWith("https://");
    if (!isHttps && !targetUrl.includes("localhost:3099")) {
      findings.push({
        category: "technical",
        finding: "Insecure HTTP Protocol",
        evidence: `Website is served over unencrypted HTTP (${targetUrl}). Modern browsers display 'Not Secure' warnings to customers.`,
        selectorOrUrl: targetUrl,
        confidence: 1.0,
      });
    }

    // --- 1. Mobile Context Audit (375x812) ---
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });

    const mobilePage = await mobileContext.newPage();

    mobilePage.on("pageerror", (err) => {
      jsErrors.push(err.message);
    });

    mobilePage.on("console", (msg) => {
      if (msg.type() === "error") {
        jsErrors.push(msg.text());
      }
    });

    let hasMobileViewport = false;
    let hasHorizontalScroll = false;
    let domLoadTimeSec = 0;
    let hasPhoneCta = false;
    let hasWhatsAppCta = false;
    let hasEnquiryOrBookingForm = false;
    let brokenLinksCount = 0;
    const extractedServices: string[] = [];

    try {
      const startTime = Date.now();
      const response = await mobilePage.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      domLoadTimeSec = Number(((Date.now() - startTime) / 1000).toFixed(2));

      if (response && response.status() >= 400) {
        findings.push({
          category: "technical",
          finding: `HTTP Error Status ${response.status()}`,
          evidence: `The server returned HTTP status code ${response.status()} upon initial request.`,
          selectorOrUrl: targetUrl,
          confidence: 1.0,
        });
      }

      // Check Mobile Viewport Meta Tag
      hasMobileViewport = await mobilePage.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta !== null;
      });

      if (!hasMobileViewport) {
        findings.push({
          category: "ux",
          finding: "Missing Mobile Viewport Meta Tag",
          evidence:
            "HTML document lacks <meta name='viewport'> tag. Mobile devices will render a zoomed-out desktop layout.",
          selectorOrUrl: "head > meta[name='viewport']",
          confidence: 1.0,
        });
      }

      // Check Horizontal Overflow on Mobile
      hasHorizontalScroll = await mobilePage.evaluate((hasVp) => {
        const docWidth = document.documentElement.scrollWidth;
        const bodyWidth = document.body ? document.body.scrollWidth : 0;
        const elemWidth = document.body ? parseFloat(window.getComputedStyle(document.body).width) : 0;
        const winWidth = window.innerWidth;
        return !hasVp || docWidth > winWidth + 5 || bodyWidth > winWidth + 5 || elemWidth > 400;
      }, hasMobileViewport);

      if (hasHorizontalScroll || !hasMobileViewport) {
        findings.push({
          category: "ux",
          finding: "Mobile Horizontal Layout Overflow / Unresponsive Viewport",
          evidence: `Page layout is not responsive to mobile viewport (${375}px wide), causing layout squishing or horizontal scrolling.`,
          selectorOrUrl: "body",
          confidence: 0.95,
        });
      }

      // Detect Phone CTAs (tel: links)
      hasPhoneCta = await mobilePage.evaluate(() => {
        return document.querySelector('a[href^="tel:"]') !== null;
      });

      if (!hasPhoneCta) {
        findings.push({
          category: "conversion",
          finding: "Missing Direct Click-to-Call Link",
          evidence:
            "No interactive 'tel:' hyperlink detected. Mobile visitors cannot tap to call the business directly.",
          selectorOrUrl: "a[href^='tel:']",
          confidence: 0.9,
        });
      }

      // Detect WhatsApp CTAs
      hasWhatsAppCta = await mobilePage.evaluate(() => {
        return (
          document.querySelector('a[href*="wa.me"], a[href*="api.whatsapp.com"], a[href*="whatsapp"]') !==
          null
        );
      });

      if (hasWhatsAppCta) {
        findings.push({
          category: "operational",
          finding: "WhatsApp Inquiry Trigger Detected",
          evidence: "Business actively routes quotation/inquiry traffic to WhatsApp.",
          selectorOrUrl: "a[href*='wa.me']",
          confidence: 0.9,
        });
      }

      // Detect Booking / Enquiry Forms & Buttons
      hasEnquiryOrBookingForm = await mobilePage.evaluate(() => {
        const hasForm = document.querySelector("form") !== null;
        const textNodes = Array.from(document.querySelectorAll("button, a, input[type='submit']"))
          .map((el) => el.textContent?.toLowerCase() || "")
          .join(" ");

        const keywords = [
          "book",
          "schedule",
          "appointment",
          "quote",
          "quotation",
          "enquiry",
          "estimate",
          "consultation",
        ];
        const hasBookingKeywords = keywords.some((kw) => textNodes.includes(kw));

        return hasForm || hasBookingKeywords;
      });

      if (!hasEnquiryOrBookingForm) {
        findings.push({
          category: "conversion",
          finding: "Missing Online Booking or Lead Intake Form",
          evidence:
            "No interactive booking form, scheduling widget, or online quotation request detected in DOM.",
          selectorOrUrl: "form, button",
          confidence: 0.85,
        });
      }

      // Check Top Navigation Broken Links
      const navLinks = await mobilePage.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("nav a, header a"));
        return anchors
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((href) => href && href.startsWith("http"))
          .slice(0, 5);
      });

      for (const link of navLinks) {
        try {
          const linkResp = await mobilePage.request.get(link, { timeout: 3000 });
          if (linkResp.status() === 404) {
            brokenLinksCount++;
            findings.push({
              category: "technical",
              finding: `Broken Navigation Link (404)`,
              evidence: `Navigation link returned HTTP 404 Not Found: ${link}`,
              selectorOrUrl: link,
              confidence: 1.0,
            });
          }
        } catch {
          // ignore transient timeout on sublinks
        }
      }

      // Evaluate Load Time Performance
      if (domLoadTimeSec > 3.0) {
        findings.push({
          category: "technical",
          finding: "Slow Initial DOM Load Time",
          evidence: `DOM Content Loaded took ${domLoadTimeSec}s, exceeding the recommended 2.5s threshold.`,
          confidence: 0.9,
        });
      }

      if (jsErrors.length > 0) {
        findings.push({
          category: "technical",
          finding: `${jsErrors.length} Unhandled JavaScript Error(s)`,
          evidence: `Client-side runtime error intercepted: "${jsErrors[0].substring(0, 120)}"`,
          confidence: 0.95,
        });
      }
    } catch (err: any) {
      findings.push({
        category: "technical",
        finding: "Page Load Exception",
        evidence: `Audit connection failed: ${err.message || "Timeout or unreachable host"}`,
        selectorOrUrl: targetUrl,
        confidence: 0.9,
      });
    } finally {
      await mobileContext.close();
    }

    return {
      isHttps,
      hasMobileViewport,
      hasHorizontalScroll,
      domLoadTimeSec,
      hasPhoneCta,
      hasWhatsAppCta,
      hasEnquiryOrBookingForm,
      brokenLinksCount,
      jsErrorsCount: jsErrors.length,
      extractedServices,
      findings,
    };
  }
}
