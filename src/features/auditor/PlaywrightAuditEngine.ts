import { chromium, Browser } from "playwright";
import { AuditTelemetry, AuditFinding } from "@/core/db/schema";
import { IAuditEngine } from "./types";
import dns from "dns/promises";
import net from "net";

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
   * SSRF Protection: Validates URL protocol, hostname, and resolves IP against private/metadata CIDRs.
   */
  public async validateUrlSecurity(targetUrl: string, allowLocalhostForTesting: boolean = false): Promise<string> {
    let parsed: URL;
    try {
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = "https://" + targetUrl;
      }
      parsed = new URL(targetUrl);
    } catch {
      throw new Error(`Invalid target URL format: ${targetUrl}`);
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Forbidden URL protocol: ${parsed.protocol}`);
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check string-based cloud metadata names
    if (
      hostname === "metadata.google.internal" ||
      hostname === "metadata.aws.internal" ||
      hostname.endsWith(".internal")
    ) {
      throw new Error(`Forbidden cloud metadata hostname: ${hostname}`);
    }

    // Resolve DNS to verify IP addresses
    let addresses: string[] = [];
    if (net.isIP(hostname)) {
      addresses = [hostname];
    } else {
      try {
        const resolved = await dns.lookup(hostname, { all: true });
        addresses = resolved.map((r) => r.address);
      } catch (dnsErr: any) {
        throw new Error(`DNS resolution failed for ${hostname}: ${dnsErr.message}`);
      }
    }

    for (const ip of addresses) {
      if (this.isPrivateOrRestrictedIp(ip)) {
        // Only allow 127.0.0.1 or localhost if explicitly testing locally
        if (allowLocalhostForTesting && (ip === "127.0.0.1" || ip === "::1" || hostname === "localhost")) {
          continue;
        }
        throw new Error(`Forbidden private or metadata IP target (SSRF prevention): ${ip} for hostname ${hostname}`);
      }
    }

    return parsed.toString();
  }

  private isPrivateOrRestrictedIp(ip: string): boolean {
    if (net.isIPv4(ip)) {
      const parts = ip.split(".").map(Number);
      if (parts[0] === 0) return true; // 0.0.0.0/8
      if (parts[0] === 127) return true; // 127.0.0.0/8 Loopback
      if (parts[0] === 10) return true; // 10.0.0.0/8 Private
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12 Private
      if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16 Private
      if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 Link-local / AWS / GCP Metadata
      if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // Carrier-grade NAT
      if (parts[0] >= 224) return true; // Multicast & reserved
      return false;
    }

    if (net.isIPv6(ip)) {
      const normalized = ip.toLowerCase();
      if (normalized === "::1" || normalized === "::") return true;
      if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // Unique local
      if (normalized.startsWith("fe80")) return true; // Link-local
      return false;
    }

    return true;
  }

  public async auditUrl(rawUrl: string, allowLocalhostForTesting: boolean = false): Promise<AuditTelemetry> {
    const targetUrl = await this.validateUrlSecurity(rawUrl, allowLocalhostForTesting);
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
        timeout: 4000,
      });
      await mobilePage.waitForTimeout(300);
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

    // Check Broken Links Sample with SSRF validation on every target link
    for (const href of conversionSignals.sampleLinks) {
      if (!href) continue;
      try {
        const resolvedUrl = new URL(href, targetUrl).toString();
        // Validate target link before making HEAD request (prevent 2nd SSRF hop)
        await this.validateUrlSecurity(resolvedUrl, allowLocalhostForTesting);

        const res = await mobileContext.request.head(resolvedUrl, { timeout: 3000 }).catch(() => null);
        if (res && res.status() >= 400) {
          brokenLinksCount++;
          findings.push({
            category: "technical",
            finding: `Broken Link (HTTP ${res.status()})`,
            evidence: `Link returned HTTP error status ${res.status()}`,
            selectorOrUrl: href,
            confidence: 0.9,
          });
          break;
        }
      } catch {
        // Skip unresolvable or blocked private IP links
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
