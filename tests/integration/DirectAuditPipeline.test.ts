import { describe, it, expect } from "vitest";
import { DirectAuditService } from "@/features/auditor/DirectAuditService";

describe("Direct Audit Pipeline & SSRF Security Suite", () => {
  it("Invariant 1: SSRF Pre-flight rejects localhost loopback attempts", async () => {
    await expect(
      DirectAuditService.validateUrlSecurity("http://localhost:3000/admin")
    ).rejects.toThrow(/forbidden|loopback/i);

    await expect(
      DirectAuditService.validateUrlSecurity("http://127.0.0.1:8080")
    ).rejects.toThrow(/forbidden|loopback/i);
  });

  it("Invariant 2: SSRF Pre-flight rejects cloud metadata endpoint (169.254.169.254)", async () => {
    await expect(
      DirectAuditService.validateUrlSecurity("http://169.254.169.254/latest/meta-data/")
    ).rejects.toThrow(/Forbidden|restricted private IP|blocked/i);
  });

  it("Invariant 3: SSRF Pre-flight permits valid public domain URLs", async () => {
    const validUrl = await DirectAuditService.validateUrlSecurity("https://example.com");
    expect(validUrl).toBe("https://example.com/");
  });
});
