import { AuditTelemetry, AuditFinding } from "@/db/schema";

export interface IAuditEngine {
  auditUrl(targetUrl: string): Promise<AuditTelemetry>;
}
