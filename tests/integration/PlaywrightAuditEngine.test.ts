import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PlaywrightAuditEngine } from "@/services/auditor/PlaywrightAuditEngine";
import { MockSiteServer } from "@/services/auditor/simulation/mockServer";

describe("PlaywrightAuditEngine Integration Test", () => {
  let mockServer: MockSiteServer;
  let auditEngine: PlaywrightAuditEngine;
  let serverUrl: string;

  beforeAll(async () => {
    mockServer = new MockSiteServer(3099);
    serverUrl = await mockServer.start();
    auditEngine = new PlaywrightAuditEngine();
  }, 30000);

  afterAll(async () => {
    if (auditEngine) {
      await auditEngine.close();
    }
    if (mockServer) {
      await mockServer.stop();
    }
  });

  it("Accurately audits broken legacy site: missing viewport, layout overflow, missing CTA, broken links", async () => {
    const telemetry = await auditEngine.auditUrl(`${serverUrl}/sites/broken-legacy`);

    expect(telemetry.hasMobileViewport).toBe(false);
    expect(telemetry.hasHorizontalScroll).toBe(true);
    expect(telemetry.hasPhoneCta).toBe(false);
    expect(telemetry.hasEnquiryOrBookingForm).toBe(false);
    expect(telemetry.brokenLinksCount).toBeGreaterThanOrEqual(1);
    expect(telemetry.jsErrorsCount).toBeGreaterThanOrEqual(1);

    const viewportFinding = telemetry.findings.find((f) => f.finding.includes("Viewport"));
    expect(viewportFinding).toBeDefined();
    expect(viewportFinding?.confidence).toBe(1.0);
  }, 25000);

  it("Detects WhatsApp inquiry trigger on custom works site", async () => {
    const telemetry = await auditEngine.auditUrl(`${serverUrl}/sites/whatsapp-heavy`);

    expect(telemetry.hasMobileViewport).toBe(true);
    expect(telemetry.hasWhatsAppCta).toBe(true);
    expect(telemetry.hasEnquiryOrBookingForm).toBe(true);

    const waFinding = telemetry.findings.find((f) => f.finding.includes("WhatsApp"));
    expect(waFinding).toBeDefined();
  }, 25000);

  it("Blocks private SSRF attempts", async () => {
    await expect(auditEngine.auditUrl("http://169.254.169.254/metadata")).rejects.toThrow(
      /SSRF defense/i
    );
  });
});
