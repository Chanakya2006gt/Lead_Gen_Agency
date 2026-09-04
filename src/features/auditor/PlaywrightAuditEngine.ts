import { chromium, Browser } from "playwright";
import { AuditTelemetry, AuditFinding } from "@/core/db/schema";
import { IAuditEngine } from "./types";
import dns from "dns/promises";
import net from "net";

export class PlaywrightAuditEngine implements IAuditEngine {
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      const launchArgs = [
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ];
      if (process.env.PLAYWRIGHT_NO_SANDBOX === "1") {
        launchArgs.push("--no-sandbox");
      }
      this.browser = await chromium.launch({
        headless: true,
        args: launchArgs,
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
   * Enterprise SSRF Defense:
   * 1. Protocol allowlisting (http/https only)
   * 2. Hostname/IP normalization & anti-obfuscation (blocks decimal, hex, octal IP tricks)
   * 3. Cloud metadata endpoint defense (AWS, GCP, Azure, DigitalOcean)
   * 4. Multi-IP DNS lookup & comprehensive private IPv4/IPv6 CIDR filtering
   */
  public static async validateUrlSecurity(targetUrl: string, allowLocalhostForTesting: boolean = false): Promise<string> {
    let parsed: URL;
    try {
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = "https://" + targetUrl;
      }
      parsed = new URL(targetUrl);
    } catch {
      throw new Error(`Invalid target URL format: ${targetUrl}`);
    }

    // 1. Strict Protocol Allowlist
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Forbidden URL protocol (SSRF Defense): ${parsed.protocol}`);
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. Anti-Obfuscation: Block decimal/octal/hex integer IP representations (e.g. 2130706433 or 0x7f000001)
    if (/^0x[0-9a-f]+$/i.test(hostname) || /^\d+$/.test(hostname)) {
      throw new Error(`Forbidden numeric/hex IP encoding: ${hostname}`);
    }

    // 3. Known Cloud Metadata Hostnames & Internal Domains
    const restrictedHostnames = [
      "metadata.google.internal",
      "metadata.aws.internal",
      "instance-data",
      "169.254.169.254",
      "metadata.azure.internal",
    ];
    if (
      restrictedHostnames.includes(hostname) ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".onion")
    ) {
      throw new Error(`Forbidden internal/cloud metadata hostname: ${hostname}`);
    }

    // 4. DNS Resolution & Multi-Address IP Verification
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
      if (PlaywrightAuditEngine.isPrivateOrRestrictedIp(ip)) {
        // Only allow 127.0.0.1 or localhost if explicitly testing in test environment
        if (allowLocalhostForTesting && (ip === "127.0.0.1" || ip === "::1" || hostname === "localhost")) {
          continue;
        }
        throw new Error(`Forbidden private or metadata IP target (SSRF prevention): ${ip} for hostname ${hostname}`);
      }
    }

    return parsed.toString();
  }

  public static isPrivateOrRestrictedIp(ip: string): boolean {
    // Handle IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1 or ::ffff:10.0.0.1)
    if (ip.startsWith("::ffff:")) {
      const ipv4Part = ip.replace("::ffff:", "");
      return PlaywrightAuditEngine.isPrivateOrRestrictedIp(ipv4Part);
    }

    if (net.isIPv4(ip)) {
      const parts = ip.split(".").map(Number);
      if (parts[0] === 0) return true; // 0.0.0.0/8 Current network
      if (parts[0] === 127) return true; // 127.0.0.0/8 Loopback
      if (parts[0] === 10) return true; // 10.0.0.0/8 Private
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12 Private
      if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16 Private
      if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 Link-local / AWS & GCP Metadata
      if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // Carrier-grade NAT (100.64.0.0/10)
      if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true; // Benchmark testing (198.18.0.0/15)
      if (parts[0] >= 224) return true; // 224.0.0.0/4 Multicast & reserved
      return false;
    }

    if (net.isIPv6(ip)) {
      const normalized = ip.toLowerCase();
      if (normalized === "::1" || normalized === "::") return true; // Loopback & unspecified
      if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // Unique local (fc00::/7)
      if (normalized.startsWith("fe80") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true; // Link-local (fe80::/10)
      if (normalized.startsWith("ff")) return true; // Multicast (ff00::/8)
      return false;
    }

    return true;
  }

  /**
   * Dual-Viewport Headless Audit:
   * Phase 1: Mobile Viewport (375x812, touch, responsive tag, overflow, tel/WhatsApp anchors)
   * Phase 2: Desktop Viewport (1440x900, layout stability, console crashes, booking funnels, broken links)
   */
  public async auditUrl(rawUrl: string, allowLocalhostForTesting: boolean = false): Promise<AuditTelemetry> {
    const targetUrl = await PlaywrightAuditEngine.validateUrlSecurity(rawUrl, allowLocalhostForTesting);
    const browser = await this.getBrowser();

    const findings: AuditFinding[] = [];
    const hasSsl = targetUrl.startsWith("https://");
    let brokenLinksCount = 0;
    let jsConsoleErrorsCount = 0;
    let initialLoadLatencyMs = 0;

    if (!hasSsl) {
      findings.push({
        category: "technical",
        finding: "Insecure HTTP Protocol",
        evidence: "Website is served over plain HTTP without TLS encryption (HTTPS). Modern browsers mark this site as 'Not Secure'.",
        selectorOrUrl: targetUrl,
        confidence: 1.0,
      });
    }

    // =========================================================================
    // PHASE 1: Mobile Viewport Audit (375px × 812px iPhone Emulation)
    // =========================================================================
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });

    const mobilePage = await mobileContext.newPage();
    const startTime = Date.now();

    try {
      await mobilePage.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 8000,
      });
      // Post-Navigation SSRF Revalidation: verify destination redirect URL
      const finalMobileUrl = mobilePage.url();
      if (finalMobileUrl && finalMobileUrl !== "about:blank") {
        await PlaywrightAuditEngine.validateUrlSecurity(finalMobileUrl, allowLocalhostForTesting);
      }
      await mobilePage.waitForTimeout(300);
      initialLoadLatencyMs = Date.now() - startTime;
    } catch (err: any) {
      if (err.message?.includes("Forbidden") || err.message?.includes("SSRF")) {
        await mobileContext.close();
        throw err;
      }
      initialLoadLatencyMs = Date.now() - startTime;
      findings.push({
        category: "technical",
        finding: "Connection Timeout or Failure",
        evidence: `Initial mobile page load failed or timed out (${initialLoadLatencyMs}ms): ${err.message}`,
        selectorOrUrl: targetUrl,
        confidence: 0.95,
      });
    }

    // 1. Inspect Viewport Meta on Mobile
    let viewportMetaPresent = false;
    try {
      viewportMetaPresent = await mobilePage.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta !== null;
      });
    } catch {
      viewportMetaPresent = false;
    }

    if (!viewportMetaPresent) {
      findings.push({
        category: "ux",
        finding: "Missing Responsive Viewport Meta Tag",
        evidence: "<meta name='viewport'> tag is absent. Mobile devices render desktop-scaled layout, causing extreme pinch-to-zoom friction.",
        selectorOrUrl: "head > meta[name='viewport']",
        confidence: 1.0,
      });
    }

    // 2. Inspect Horizontal Layout Overflow on Mobile
    let hasHorizontalOverflow = false;
    try {
      hasHorizontalOverflow = await mobilePage.evaluate(() => {
        const docWidth = document.documentElement.offsetWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        return scrollWidth > docWidth + 5;
      });
    } catch {
      hasHorizontalOverflow = false;
    }

    if (hasHorizontalOverflow) {
      findings.push({
        category: "ux",
        finding: "Horizontal Mobile Scroll Overflow",
        evidence: "Document content exceeds mobile screen width (scrollWidth > offsetWidth). Elements are leaking off-screen horizontally.",
        selectorOrUrl: "html, body",
        confidence: 0.95,
      });
    }

    // 3. Inspect Mobile Conversion Anchors (Direct Call, WhatsApp)
    let mobileSignals = {
      hasDirectClickToCall: false,
      hasWhatsAppDirectLink: false,
    };
    try {
      mobileSignals = await mobilePage.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a"));
        const hasDirectClickToCall = links.some((a) => (a.href || "").toLowerCase().startsWith("tel:"));
        const hasWhatsAppDirectLink = links.some(
          (a) =>
            (a.href || "").toLowerCase().includes("wa.me") ||
            (a.href || "").toLowerCase().includes("api.whatsapp.com")
        );
        return { hasDirectClickToCall, hasWhatsAppDirectLink };
      });
    } catch {
      // Fallback
    }

    if (!mobileSignals.hasDirectClickToCall) {
      findings.push({
        category: "conversion",
        finding: "Missing Direct Click-to-Call Link",
        evidence: "No 'tel:' protocol anchors found on mobile view. Mobile visitors cannot tap to call directly from their phone dialer.",
        confidence: 0.9,
      });
    }

    await mobileContext.close();

    // =========================================================================
    // PHASE 2: Desktop Viewport Audit (1440px × 900px Desktop Simulation)
    // =========================================================================
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    });

    const desktopPage = await desktopContext.newPage();

    // Track JavaScript console crashes
    desktopPage.on("console", (msg) => {
      if (msg.type() === "error") {
        jsConsoleErrorsCount++;
      }
    });

    try {
      await desktopPage.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 8000,
      });
      // Post-Navigation SSRF Revalidation
      const finalDesktopUrl = desktopPage.url();
      if (finalDesktopUrl && finalDesktopUrl !== "about:blank") {
        await PlaywrightAuditEngine.validateUrlSecurity(finalDesktopUrl, allowLocalhostForTesting);
      }
      await desktopPage.waitForTimeout(300);
    } catch (err: any) {
      if (err.message?.includes("Forbidden") || err.message?.includes("SSRF")) {
        await desktopContext.close();
        throw err;
      }
      // Ignore desktop secondary timeout
    }

    // 4. Inspect Interactive Scheduling & Booking Funnels (Desktop/Global DOM)
    let desktopSignals = {
      hasInteractiveBookingForm: false,
      sampleLinks: [] as string[],
    };
    try {
      desktopSignals = await desktopPage.evaluate(() => {
        const bookingWidgets = document.querySelectorAll(
          'input[type="date"], input[type="time"], iframe[src*="calendly"], iframe[src*="acuity"], iframe[src*="setmore"], iframe[src*="cal.com"], a[href*="calendly"], a[href*="cal.com"]'
        );
        const bookingForms = Array.from(document.querySelectorAll("form")).filter((f) => {
          const formText = (f.textContent || "").toLowerCase();
          const formAttr = `${f.getAttribute("action") || ""} ${f.getAttribute("id") || ""} ${f.className || ""}`.toLowerCase();
          return /appointment|book|schedule|consultation|reserve/.test(`${formText} ${formAttr}`);
        });
        const hasInteractiveBookingForm = bookingWidgets.length > 0 || bookingForms.length > 0;

        const links = Array.from(document.querySelectorAll("a"));
        const sampleLinks = links
          .map((a) => a.getAttribute("href"))
          .filter((h): h is string => Boolean(h && !h.startsWith("#") && !h.startsWith("javascript:")));

        return {
          hasInteractiveBookingForm,
          sampleLinks: sampleLinks.slice(0, 15),
        };
      });
    } catch {
      // Fallback
    }

    if (!desktopSignals.hasInteractiveBookingForm) {
      findings.push({
        category: "conversion",
        finding: "Missing Interactive Scheduling / Intake Funnel",
        evidence: "No interactive date picker, scheduling form, or calendar embed detected across mobile/desktop views.",
        confidence: 0.85,
      });
    }

    // 5. Broken Links Verification with Per-Link SSRF Shielding
    for (const href of desktopSignals.sampleLinks) {
      if (!href) continue;
      try {
        const resolvedUrl = new URL(href, targetUrl).toString();
        // Validate target link before making HEAD request (prevent 2nd-hop SSRF)
        await PlaywrightAuditEngine.validateUrlSecurity(resolvedUrl, allowLocalhostForTesting);

        const res = await desktopContext.request.head(resolvedUrl, { timeout: 3000 }).catch(() => null);
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

    await desktopContext.close();

    return {
      viewportMetaPresent,
      hasHorizontalOverflow,
      hasSsl,
      brokenLinksCount,
      jsConsoleErrorsCount,
      initialLoadLatencyMs,
      hasDirectClickToCall: mobileSignals.hasDirectClickToCall,
      hasWhatsAppDirectLink: mobileSignals.hasWhatsAppDirectLink,
      hasInteractiveBookingForm: desktopSignals.hasInteractiveBookingForm,
      findings,
    };
  }
}
