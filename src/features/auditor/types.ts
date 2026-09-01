import { AuditTelemetry } from "@/core/db/schema";

export interface IAuditEngine {
  auditUrl(targetUrl: string): Promise<AuditTelemetry>;
}
