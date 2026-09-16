import { ProblemValueAssessment, ProblemSeverity, EvidenceProvenance, BusinessScale } from "./types";
import { AuditTelemetry } from "@/core/db/schema";
import { MarketContextResult } from "./MarketContext";
import { BusinessModelClassifier } from "./BusinessModelClassifier";

export interface ProblemValueParams {
  hasWebsite: boolean;
  isGbpDisconnected?: boolean;
  category?: string | null;
  businessScale?: BusinessScale;
  auditTelemetry?: AuditTelemetry | null;
  marketContext: MarketContextResult;
  businessName: string;
  websiteTextSnippet?: string | null;
}

export class ProblemValueEvaluator {
  public static evaluate(params: ProblemValueParams): ProblemValueAssessment {
    const evidence: { statement: string; provenance: EvidenceProvenance }[] = [];
    const currency = params.marketContext.currency;

    const scale = params.businessScale || "UNKNOWN";
    let scaleMultiplier = 1.0;
    switch (scale) {
      case "ENTERPRISE":
        scaleMultiplier = 5.0;
        break;
      case "LARGE":
        scaleMultiplier = 3.0;
        break;
      case "MEDIUM":
        scaleMultiplier = 2.0;
        break;
      case "SMALL_MEDIUM":
        scaleMultiplier = 1.4;
        break;
      case "SMALL":
        scaleMultiplier = 1.1;
        break;
      case "MICRO":
      case "UNKNOWN":
      default:
        scaleMultiplier = 1.0;
        break;
    }

    // 1. Establish Business Model Context
    const classification = BusinessModelClassifier.classify({
      name: params.businessName,
      category: params.category,
      findings: params.auditTelemetry?.findings || [],
      websiteTextSnippet: params.websiteTextSnippet,
    });

    const { model, relevantWorkflows } = classification;

    // 2. Disconnected Google Business Profile (Only relevant if business model relies on local discovery)
    if (params.isGbpDisconnected) {
      if (relevantWorkflows.localGbpSync) {
        evidence.push({
          statement: "Official verified website exists but is missing from Google Business Profile listing.",
          provenance: "OBSERVED",
        });
        evidence.push({
          statement: "High-intent local mobile searchers looking up the business on Google Maps cannot access full service details or booking funnel directly.",
          provenance: "INFERRED",
        });

        return {
          severity: "HIGH",
          revenueProximity: "HIGH",
          revenueImpactEvidence: "INFERRED",
          operationalImpact: "MEDIUM",
          frequency: "DAILY",
          problemValueBand: {
            min: Math.round(((currency === "INR" ? 15000 : 1500) * scaleMultiplier) / 1000) * 1000,
            max: Math.round(((currency === "INR" ? 35000 : 3500) * scaleMultiplier) / 1000) * 1000,
            currency,
            confidence: 0.85,
            basis: "BOTTOM_UP_WBS",
          },
          confidence: 0.85,
          evidence,
        };
      }
    }

    // 3. Zero Website on Google Maps
    if (!params.hasWebsite) {
      evidence.push({
        statement: "Zero official website presence detected.",
        provenance: "OBSERVED",
      });
      evidence.push({
        statement: "Forces potential customers into office-hours phone calls or forfeits them to competitors with online intake.",
        provenance: "INFERRED",
      });

      return {
        severity: "HIGH",
        revenueProximity: "HIGH",
        revenueImpactEvidence: "INFERRED",
        operationalImpact: "HIGH",
        frequency: "DAILY",
        problemValueBand: {
          min: Math.round(((currency === "INR" ? 25000 : 2500) * scaleMultiplier) / 1000) * 1000,
          max: Math.round(((currency === "INR" ? 60000 : 6000) * scaleMultiplier) / 1000) * 1000,
          currency,
          confidence: 0.85,
          basis: "BOTTOM_UP_WBS",
        },
        confidence: 0.85,
        evidence,
      };
    }

    // 4. Evaluated Telemetry Defects with Business Model Relevance Filtering
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

      // Universal Technical Requirement: SSL
      if (!hasSsl) {
        severityScore += 2;
        evidence.push({
          statement: "Missing SSL encryption: Browsers flag site with 'Not Secure' warning, deterring visitors.",
          provenance: "OBSERVED",
        });
      }

      // Universal Technical Requirement: Responsive Viewport
      if (!viewportMetaPresent || hasHorizontalOverflow) {
        severityScore += 3;
        revenueProximity = "HIGH";
        evidence.push({
          statement: "Mobile layout fails viewport standards or has horizontal scrolling overflow.",
          provenance: "OBSERVED",
        });
        evidence.push({
          statement: "Smartphone users experience layout disruption and high bounce rates on key pages.",
          provenance: "INFERRED",
        });
      }

      // Model-Specific: Interactive Booking Calendar (Only relevant for appointment services & high-trust practices)
      if (relevantWorkflows.appointmentBooking) {
        if (!hasInteractiveBookingForm) {
          severityScore += 2;
          operationalImpact = "HIGH";
          evidence.push({
            statement: "No interactive 24/7 online scheduling or appointment booking funnel detected.",
            provenance: "OBSERVED",
          });
        }
      }

      // Model-Specific: 1-Tap Mobile Phone Call / WhatsApp (Only relevant for local appointment services / dining)
      if (relevantWorkflows.whatsAppIntake) {
        if (!hasDirectClickToCall && !hasWhatsAppDirectLink) {
          severityScore += 2;
          revenueProximity = "HIGH";
          evidence.push({
            statement: "No direct 1-tap phone call or WhatsApp consultation trigger found for mobile visitors.",
            provenance: "OBSERVED",
          });
        }
      }

      // Universal Technical Requirement: Speed / TTFB
      if (initialLoadLatencyMs > 2500) {
        severityScore += 1.5;
        evidence.push({
          statement: `Initial server load latency (${initialLoadLatencyMs}ms) exceeds performance benchmark.`,
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
    let minVal = Math.round(((currency === "INR" ? 5000 : 500) * scaleMultiplier) / 1000) * 1000;
    let maxVal = Math.round(((currency === "INR" ? 15000 : 1500) * scaleMultiplier) / 1000) * 1000;

    if (severityScore >= 6) {
      severity = "CRITICAL";
      revenueProximity = "HIGH";
      operationalImpact = "HIGH";
      minVal = Math.round(((currency === "INR" ? 30000 : 3000) * scaleMultiplier) / 1000) * 1000;
      maxVal = Math.round(((currency === "INR" ? 65000 : 6500) * scaleMultiplier) / 1000) * 1000;
    } else if (severityScore >= 4) {
      severity = "HIGH";
      revenueProximity = revenueProximity === "HIGH" ? "HIGH" : "MEDIUM";
      minVal = Math.round(((currency === "INR" ? 20000 : 2000) * scaleMultiplier) / 1000) * 1000;
      maxVal = Math.round(((currency === "INR" ? 45000 : 4500) * scaleMultiplier) / 1000) * 1000;
    } else if (severityScore >= 2) {
      severity = "MEDIUM";
      minVal = Math.round(((currency === "INR" ? 10000 : 1000) * scaleMultiplier) / 1000) * 1000;
      maxVal = Math.round(((currency === "INR" ? 25000 : 2500) * scaleMultiplier) / 1000) * 1000;
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
