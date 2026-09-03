import { BusinessScale, EvidenceProvenance } from "./types";
import { AuditTelemetry } from "@/core/db/schema";

export interface BusinessScaleEvidenceItem {
  signal: string;
  weight: number; // Positive increases scale, negative keeps it lean
  provenance: EvidenceProvenance;
}

export interface BusinessScaleInferenceParams {
  name: string;
  category?: string | null;
  rating: number;
  reviewCount: number;
  formattedAddress?: string | null;
  auditTelemetry?: AuditTelemetry | null;
  websiteTextSnippet?: string | null;
}

export interface BusinessScaleResult {
  scale: BusinessScale;
  confidence: number;
  evidence: BusinessScaleEvidenceItem[];
}

export class BusinessScaleInferrer {
  public static infer(params: BusinessScaleInferenceParams): BusinessScaleResult {
    const evidence: BusinessScaleEvidenceItem[] = [];
    const nameLower = (params.name || "").toLowerCase();
    const categoryLower = (params.category || "").toLowerCase();
    const addressLower = (params.formattedAddress || "").toLowerCase();
    const textSnippetLower = (params.websiteTextSnippet || "").toLowerCase();

    let score = 0; // -10 to +10 scale baseline

    // 1. Enterprise / Multi-Location / Corporate Structure Signal
    const corporateKeywords = ["pvt ltd", "ltd", "corporation", "industries", "holdings", "group", "enterprises", "manufacturing", "solutions pvt"];
    const multiBranchKeywords = ["branches", "chain", "hospitals", "centers", "centres", "network", "multi-speciality", "multispeciality"];

    if (corporateKeywords.some((kw) => nameLower.includes(kw) || textSnippetLower.includes(kw))) {
      score += 4;
      evidence.push({
        signal: "Corporate entity indicator (Pvt Ltd/Industries/Holdings) observed in business naming or identity.",
        weight: 4,
        provenance: "OBSERVED",
      });
    }

    if (multiBranchKeywords.some((kw) => nameLower.includes(kw) || textSnippetLower.includes(kw))) {
      score += 3;
      evidence.push({
        signal: "Multi-branch or multi-speciality network indicator detected in title/content.",
        weight: 3,
        provenance: "OBSERVED",
      });
    }

    // 2. Category Prior Signal (Directional Prior, not absolute answer)
    const isMicroRetail = ["cafe", "café", "bakery", "salon", "barber", "plumber", "electrician", "tailor", "coffee shop", "tea stall", "food truck"].some(
      (cat) => categoryLower.includes(cat) || nameLower.includes(cat)
    );

    const isMidHealthcareOrContractor = ["dental", "clinic", "dentist", "physiotherapy", "dermatology", "architect", "contractor", "lawyer", "advocate", "chartered accountant", "auto repair"].some(
      (cat) => categoryLower.includes(cat) || nameLower.includes(cat)
    );

    const isLargeFacilityOrB2B = ["hospital", "medical college", "resort", "hotel", "manufacturer", "engineering", "steel", "export", "pharmaceutical", "solar energy"].some(
      (cat) => categoryLower.includes(cat) || nameLower.includes(cat)
    );

    if (isMicroRetail) {
      score -= 3;
      evidence.push({
        signal: "Category prior (Local Micro Retail / Service Provider) indicates lean local operation.",
        weight: -3,
        provenance: "INFERRED",
      });
    } else if (isLargeFacilityOrB2B) {
      score += 4;
      evidence.push({
        signal: "Category prior (Institutional Facility / B2B Industrial / Healthcare Center) indicates higher organizational complexity.",
        weight: 4,
        provenance: "INFERRED",
      });
    } else if (isMidHealthcareOrContractor) {
      score += 1;
      evidence.push({
        signal: "Category prior (Professional Practice / Licensed Clinic / Specialist) indicates standard professional practice scale.",
        weight: 1,
        provenance: "INFERRED",
      });
    }

    // 3. Review Volume & Velocity as an Activity/Maturity Signal (NOT direct scale proxy!)
    if (params.reviewCount > 800) {
      if (isMicroRetail) {
        // High reviews on a café/salon = popular micro-retail establishment, not a conglomerate!
        score += 0.5;
        evidence.push({
          signal: `High customer review volume (${params.reviewCount} reviews) on local retail confirms high walk-in traffic and strong local tenure.`,
          weight: 0.5,
          provenance: "OBSERVED",
        });
      } else {
        score += 2;
        evidence.push({
          signal: `Substantial review volume (${params.reviewCount} reviews) indicates sustained high-volume market presence.`,
          weight: 2,
          provenance: "OBSERVED",
        });
      }
    } else if (params.reviewCount < 30) {
      score -= 1;
      evidence.push({
        signal: `Low review volume (${params.reviewCount} reviews) indicates early-stage or niche specialist profile.`,
        weight: -1,
        provenance: "OBSERVED",
      });
    }

    // 4. Team / Staff Footprint Signals from Telemetry / Headings (if available)
    if (textSnippetLower.includes("our doctors") || textSnippetLower.includes("our team") || textSnippetLower.includes("specialists") || textSnippetLower.includes("faculty")) {
      score += 2;
      evidence.push({
        signal: "Multi-practitioner or team roster detected on website.",
        weight: 2,
        provenance: "OBSERVED",
      });
    }

    // 5. Compute Final Scale & Confidence
    let scale: BusinessScale = "UNKNOWN";
    let confidence = 0.65;

    if (evidence.length === 0) {
      return {
        scale: "UNKNOWN",
        confidence: 0.2,
        evidence: [
          {
            signal: "Insufficient business signals observed to establish business scale.",
            weight: 0,
            provenance: "UNKNOWN",
          },
        ],
      };
    }

    if (score >= 6) {
      scale = "LARGE";
      confidence = 0.85;
    } else if (score >= 4) {
      scale = "MEDIUM";
      confidence = 0.8;
    } else if (score >= 2) {
      scale = "SMALL_MEDIUM";
      confidence = 0.75;
    } else if (score >= 0) {
      scale = "SMALL";
      confidence = 0.75;
    } else {
      scale = "MICRO";
      confidence = 0.8;
    }

    return {
      scale,
      confidence,
      evidence,
    };
  }
}
