import { ProblemValueAssessment, ProblemSeverity, EvidenceProvenance, PriceRange } from "./types";
import { AuditTelemetry } from "@/core/db/schema";
import { MarketContextResult } from "./MarketContext";

export interface ProblemValueParams {
  hasWebsite: boolean;
  isGbpDisconnected?: boolean;
  auditTelemetry?: AuditTelemetry | null;
  marketContext: MarketContextResult;
  businessName: string;
}

export class ProblemValueEvaluator {
  public static evaluate(params: ProblemValueParams): ProblemValueAssessment {
    const evidence: { statement: string; provenance: EvidenceProvenance }[] = [];
    const currency = params.marketContext.currency;

    // 1. Missing GBP Website Link (Direct local 3-pack discoverability drop)
    if (params.isGbpDisconnected) {
      evidence.push({
        statement: "Official verified website exists but is missing from Google Business Profile listing.",
        provenance: "OBSERVED",
      });
      evidence.push({
        statement: "High-intent mobile searchers looking up the business on Google Maps cannot access full service details or booking funnel directly.",
        provenance: "INFERRED",
      });
      evidence.push({
        statement: "Exact volume of lost patient appointments or customer enquiries due to Google Maps link disconnection.",
        provenance: "UNKNOWN",
      });

      return {
        severity: "HIGH",
        revenueProximity: "HIGH",
        revenueImpactEvidence: "INFERRED",
        operationalImpact: "MEDIUM",
        frequency: "DAILY",
        problemValueBand: {
          min: currency === "INR" ? 15000 : 1500,
          max: currency === "INR" ? 35000 : 3500,
          currency,
          confidence: 0.85,
          basis: "BOTTOM_UP_WBS",
        },
        confidence: 0.85,
        evidence,
      };
    }

    // 2. Zero Website on Google Maps (Total Digital Blackout)
    if (!params.hasWebsite) {
      evidence.push({
        statement: "Zero official website presence on Google Business Profile.",
        provenance: "OBSERVED",
      });
      evidence.push({
        statement: "Forces 100% of high-intent searchers into office-hours phone calls or forfeits them to competitors with online intake.",
        provenance: "INFERRED",
      });

      return {
        severity: "HIGH",
        revenueProximity: "HIGH",
        revenueImpactEvidence: "INFERRED",
        operationalImpact: "HIGH",
        frequency: "DAILY",
        problemValueBand: {
          min: currency === "INR" ? 25000 : 2500,
          max: currency === "INR" ? 60000 : 6000,
          currency,
          confidence: 0.85,
          basis: "BOTTOM_UP_WBS",
        },
        confidence: 0.85,
        evidence,
      };
    }

    // 3. Evaluated Telemetry Defects
    let severityScore = 0;
    let revenueProximity: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    let operationalImpact: "LOW" | "MEDIUM" | "HIGH" = "LOW";

    if (params.auditTelemetry) {
      const {
        hasSsl,
        viewportMetaPresent,
        hasHorizontalOverflow,
        hasDirectClickToCall,
        hasWhatsAppDirectLink,
        hasInteractiveBookingForm,
        initialLoadLatencyMs,
        brokenLinksCount,
      } = params.auditTelemetry;

      if (!hasSsl) {
        severityScore += 2;
        evidence.push({
          statement: "Missing SSL encryption: Browsers flag site with 'Not Secure' warning, deterring visitors.",
          provenance: "OBSERVED",
        });
      }

      if (!viewportMetaPresent || hasHorizontalOverflow) {
        severityScore += 3;
        revenueProximity = "HIGH";
        evidence.push({
          statement: "Mobile layout fails viewport standards or has horizontal scrolling overflow.",
          provenance: "OBSERVED",
        });
        evidence.push({
          statement: "Smartphone users experience tap frustration and high bounce rates on service pages.",
          provenance: "INFERRED",
        });
      }

      if (!hasInteractiveBookingForm) {
        severityScore += 2;
        operationalImpact = "HIGH";
        evidence.push({
          statement: "No interactive 24/7 online scheduling or calendar funnel detected.",
          provenance: "OBSERVED",
        });
      }

      if (!hasDirectClickToCall && !hasWhatsAppDirectLink) {
        severityScore += 2;
        revenueProximity = "HIGH";
        evidence.push({
          statement: "No direct 1-tap phone call or WhatsApp consultation triggers found on mobile.",
          provenance: "OBSERVED",
        });
      }

      if (initialLoadLatencyMs > 2500) {
        severityScore += 1.5;
        evidence.push({
          statement: `Initial server load latency (${initialLoadLatencyMs}ms) exceeds the 2.5s Core Web Vitals threshold.`,
          provenance: "OBSERVED",
        });
      }

      if ((brokenLinksCount ?? 0) > 0) {
        severityScore += 1;
        evidence.push({
          statement: `${brokenLinksCount} broken internal navigation links detected.`,
          provenance: "OBSERVED",
        });
      }
    }

    let severity: ProblemSeverity = "LOW";
    let minVal = currency === "INR" ? 5000 : 500;
    let maxVal = currency === "INR" ? 15000 : 1500;

    if (severityScore >= 6) {
      severity = "CRITICAL";
      revenueProximity = "HIGH";
      operationalImpact = "HIGH";
      minVal = currency === "INR" ? 30000 : 3000;
      maxVal = currency === "INR" ? 65000 : 6500;
    } else if (severityScore >= 4) {
      severity = "HIGH";
      revenueProximity = revenueProximity === "HIGH" ? "HIGH" : "MEDIUM";
      minVal = currency === "INR" ? 20000 : 2000;
      maxVal = currency === "INR" ? 45000 : 4500;
    } else if (severityScore >= 2) {
      severity = "MEDIUM";
      minVal = currency === "INR" ? 10000 : 1000;
      maxVal = currency === "INR" ? 25000 : 2500;
    } else {
      severity = "LOW";
      evidence.push({
        statement: "Website is functional with minor or cosmetic maintenance opportunities only.",
        provenance: "OBSERVED",
      });
    }

    return {
      severity,
      revenueProximity,
      revenueImpactEvidence: evidence.some((e) => e.provenance === "OBSERVED" && e.statement.includes("WhatsApp")) ? "OBSERVED" : "INFERRED",
      operationalImpact,
      frequency: "DAILY",
      problemValueBand: {
        min: minVal,
        max: maxVal,
        currency,
        confidence: 0.8,
        basis: "BOTTOM_UP_WBS",
      },
      confidence: 0.8,
      evidence,
    };
  }
}
