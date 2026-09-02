import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PlaywrightAuditEngine } from "@/features/auditor/PlaywrightAuditEngine";
import { MockSiteServer } from "@/features/auditor/mockServer";

describe("PlaywrightAuditEngine Integration Test", () => {
  let mockServer: MockSiteServer;
  let auditEngine: PlaywrightAuditEngine;

  beforeAll(async () => {
    mockServer = new MockSiteServer(3099);
    await mockServer.start();
    auditEngine = new PlaywrightAuditEngine();
  });

  afterAll(async () => {
    if (auditEngine) {
      await auditEngine.close();
    }
    if (mockServer) {
      await mockServer.stop();
    }
  });

  it("Accurately audits broken legacy site: missing viewport, layout overflow, missing CTA, broken links", async () => {
    const telemetry = await auditEngine.auditUrl("http://localhost:3099/sites/broken-legacy", true);

    expect(telemetry.viewportMetaPresent).toBe(false);
    expect(telemetry.hasHorizontalOverflow).toBe(true);
    expect(telemetry.hasDirectClickToCall).toBe(false);
    expect(telemetry.hasInteractiveBookingForm).toBe(false);
    expect(telemetry.brokenLinksCount).toBeGreaterThanOrEqual(1);

    const categories = telemetry.findings.map((f) => f.category);
    expect(categories).toContain("ux");
    expect(categories).toContain("technical");
    expect(categories).toContain("conversion");
  });

  it("Detects WhatsApp integration and mobile viewport on WhatsApp site", async () => {
    const telemetry = await auditEngine.auditUrl("http://localhost:3099/sites/whatsapp-heavy", true);

    expect(telemetry.viewportMetaPresent).toBe(true);
    expect(telemetry.hasHorizontalOverflow).toBe(false);
    expect(telemetry.hasWhatsAppDirectLink).toBe(true);
    expect(telemetry.hasDirectClickToCall).toBe(true);
    expect(telemetry.hasInteractiveBookingForm).toBe(false);
  });

  it("Enforces strict SSRF validation against cloud metadata endpoints", async () => {
    await expect(auditEngine.auditUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(
      /Forbidden.*(private|metadata)/i
    );
  });

  it("Enforces strict SSRF validation against RFC1918 private IP ranges", async () => {
    await expect(auditEngine.auditUrl("http://192.168.1.1/admin")).rejects.toThrow(
      /Forbidden private or metadata IP target/
    );
    await expect(auditEngine.auditUrl("http://10.0.0.1/status")).rejects.toThrow(
      /Forbidden private or metadata IP target/
    );
  });
});
