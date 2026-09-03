import { BusinessDossier, AuditTelemetry, ReviewTrend, SignalProvenance, GoogleEvidence, LeadDisposition } from "@/core/db/schema";
import { OpportunityClassifier } from "@/features/qualification/OpportunityClassifier";
import { ScoringEngine } from "@/features/qualification/ScoringEngine";
import { CommercialEconomicsEngine } from "@/features/commercial/CommercialEconomicsEngine";
import { BusinessModelClassifier } from "@/features/commercial/BusinessModelClassifier";
import { CustomerJourneyDetector } from "@/features/qualification/CustomerJourneyDetector";
import { OpportunityRelevanceEngine } from "@/features/qualification/OpportunityRelevanceEngine";
import { QualificationEngine } from "@/features/qualification/QualificationEngine";

export interface SynthesizerParams {
  name: string;
  category: string;
  rating?: number | null;
  reviewCount?: number | null;
  reviewTrend: ReviewTrend;
  reviewsLast30Days?: number | null;
  reviewsLast90Days?: number | null;
  hasWebsite: boolean;
  isGbpDisconnected?: boolean;
  unlinkedWebsiteUrl?: string | null;
  websiteUrl?: string | null;
  phone?: string | null;
  formattedAddress?: string | null;
  googleMapsUrl?: string | null;
  auditTelemetry?: AuditTelemetry | null;
  websiteTextSnippet?: string | null;
  googleEvidence?: GoogleEvidence;
  discoveryNiche?: string;
  discoveryQuery?: string;
  googlePrimaryType?: string;
  googlePrimaryTypeDisplayName?: string;
  categorySource?: "GOOGLE_VERIFIED" | "GOOGLE_MAPS_DOM" | "WEBSITE_META" | "USER_SPECIFIED" | "UNKNOWN";
  categoryConfidence?: number;
}

export class DossierSynthesizer {
  public static async synthesize(
    params: SynthesizerParams,
    apiKey?: string
  ): Promise<BusinessDossier> {
    // 1. Establish Business Model Classification
    const classification = BusinessModelClassifier.classify({
      name: params.name,
      category: params.category,
      domain: params.websiteUrl || params.unlinkedWebsiteUrl,
      findings: params.auditTelemetry?.findings || [],
      websiteTextSnippet: params.websiteTextSnippet,
    });
    const { model, relevantWorkflows } = classification;

    // 2. Establish Customer Acquisition Journey
    const customerJourney = CustomerJourneyDetector.detect({
      name: params.name,
      category: params.category,
      domain: params.websiteUrl || params.unlinkedWebsiteUrl,
      websiteTextSnippet: params.websiteTextSnippet,
      hasInteractiveBooking: params.auditTelemetry?.hasInteractiveBookingForm,
      hasWhatsApp: params.auditTelemetry?.hasWhatsAppDirectLink,
      hasClickToCall: params.auditTelemetry?.hasDirectClickToCall,
    });

    // 3. Establish Typed Google Evidence Boundary
    const isExplicitlyUnverified =
      params.googleEvidence?.status === "NOT_VERIFIED" ||
      params.rating === null ||
      params.reviewCount === null;

    const googleEvidence: GoogleEvidence = params.googleEvidence || (
      !isExplicitlyUnverified &&
      typeof params.rating === "number" &&
      typeof params.reviewCount === "number"
        ? {
            status: "VERIFIED",
            placeId: params.googleMapsUrl || "verified_place",
            googleMapsUrl: params.googleMapsUrl || "",
            rating: params.rating,
            reviewCount: params.reviewCount,
            primaryType: params.googlePrimaryType,
            primaryTypeDisplayName: params.googlePrimaryTypeDisplayName,
            source: "GOOGLE_PLACES",
            retrievedAt: new Date().toISOString(),
          }
        : {
            status: "NOT_VERIFIED",
            placeId: null,
            googleMapsUrl: params.googleMapsUrl || null,
            rating: null,
            reviewCount: null,
            primaryType: params.googlePrimaryType || null,
            primaryTypeDisplayName: params.googlePrimaryTypeDisplayName || null,
            source: "NONE",
            retrievedAt: new Date().toISOString(),
          }
    );

    const isGoogleVerified =
      googleEvidence.status === "VERIFIED" &&
      typeof googleEvidence.rating === "number" &&
      googleEvidence.rating !== null &&
      typeof googleEvidence.reviewCount === "number" &&
      googleEvidence.reviewCount !== null;

    // 4. Run Opportunity Relevance Engine
    const opportunityAssessment = OpportunityRelevanceEngine.evaluate({
      name: params.name,
      category: params.category,
      businessModel: classification,
      hasWebsite: params.hasWebsite,
      isGbpDisconnected: params.isGbpDisconnected,
      unlinkedWebsiteUrl: params.unlinkedWebsiteUrl,
      websiteUrl: params.websiteUrl,
      auditTelemetry: params.auditTelemetry,
      googleEvidence,
    });

    const opportunityType = opportunityAssessment.opportunityType;

    const scores = ScoringEngine.computeScores({
      rating: isGoogleVerified ? googleEvidence.rating : null,
      reviewCount: isGoogleVerified ? googleEvidence.reviewCount : null,
      reviewTrend: params.reviewTrend,
      reviewsLast30Days: params.reviewsLast30Days,
      reviewsLast90Days: params.reviewsLast90Days,
      hasWebsite: params.hasWebsite || Boolean(params.isGbpDisconnected),
      auditTelemetry: params.auditTelemetry,
      opportunityType,
    });

    // 5. Run Market-Aware Commercial Economics Engine
    const commercialProfile = CommercialEconomicsEngine.analyze({
      name: params.name,
      category: params.category,
      rating: isGoogleVerified ? googleEvidence.rating : null,
      reviewCount: isGoogleVerified ? googleEvidence.reviewCount : null,
      formattedAddress: params.formattedAddress,
      hasWebsite: params.hasWebsite,
      isGbpDisconnected: params.isGbpDisconnected,
      auditTelemetry: params.auditTelemetry,
      websiteTextSnippet: params.websiteTextSnippet,
      serviceType: opportunityType,
    });

    // 6. Run First-Class Qualification Engine ("Not Your Client" Detection)
    const qualification = QualificationEngine.evaluate({
      name: params.name,
      category: params.category,
      businessModel: classification,
      customerJourney,
      auditTelemetry: params.auditTelemetry,
      googleEvidence,
      opportunityAssessment,
      commercialProfile,
    });

    // 7. Signal Provenance & Confidence Ledger
    const provenance: SignalProvenance = {
      ratingConfidence: isGoogleVerified ? "high" : "none",
      reviewVelocityConfidence: isGoogleVerified && params.reviewTrend !== "UNKNOWN" ? "observed" : "unknown",
      identityConfidence: isGoogleVerified ? "google_verified" : "direct_audit",
      auditConfidence: params.auditTelemetry ? "empirical" : "pending",
    };

    // 8. Grounded Deterministic Rules Engine (Zero Unverified Claim Generation)
    const identifiedStrengths: string[] = [];
    if (isGoogleVerified) {
      identifiedStrengths.push(
        `Established market reputation with ${googleEvidence.rating}★ rating across ${googleEvidence.reviewCount} verified Google reviews.`
      );
      if (params.reviewTrend !== "UNKNOWN") {
        identifiedStrengths.push(
          `Measured customer review velocity: ${params.reviewTrend}.`
        );
      }
    } else {
      identifiedStrengths.push(
        `Direct digital domain analysis completed: Active web infrastructure inspected.`
      );
    }

    const identifiedBottlenecks: string[] = [];

    if (params.isGbpDisconnected && relevantWorkflows.localGbpSync) {
      const domainDisplay = params.unlinkedWebsiteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "official domain";
      identifiedBottlenecks.push(
        `Disconnected Google Business Profile: Official website (${domainDisplay}) exists but is missing from Google Maps profile.`
      );
      identifiedBottlenecks.push(
        "Local Search Ranking Penalty: Missing website link suppresses Google Maps 3-pack local search visibility."
      );
    } else if (!params.hasWebsite) {
      identifiedBottlenecks.push(
        "Zero official website presence detected, forfeiting high-intent digital searchers to competitors."
      );
      identifiedBottlenecks.push(
        "Lacks direct digital intake, forcing all potential customers to call during office hours only."
      );
    } else if (params.auditTelemetry) {
      const {
        findings,
        hasSsl,
        viewportMetaPresent,
        hasHorizontalOverflow,
        hasDirectClickToCall,
        hasWhatsAppDirectLink,
        hasInteractiveBookingForm,
        initialLoadLatencyMs,
      } = params.auditTelemetry;

      if (!hasSsl) {
        identifiedBottlenecks.push("Security Warning: Insecure HTTP protocol without SSL certificate.");
      }

      if (!viewportMetaPresent || hasHorizontalOverflow) {
        identifiedBottlenecks.push("Mobile Friction: Missing responsive viewport meta tag or horizontal layout overflow.");
      }

      // Workflow-filtered: Appointment Booking
      if (relevantWorkflows.appointmentBooking && !hasInteractiveBookingForm) {
        identifiedBottlenecks.push("Operational Gap: No 24/7 interactive online booking or calendar funnel.");
      }

      // Workflow-filtered: 1-Tap Call / WhatsApp
      if (relevantWorkflows.whatsAppIntake && !hasDirectClickToCall && !hasWhatsAppDirectLink) {
        identifiedBottlenecks.push("Conversion Leak: No direct 1-tap call or WhatsApp consultation link for phone visitors.");
      }

      if (initialLoadLatencyMs > 2500) {
        identifiedBottlenecks.push(`Performance Bottleneck: Slow initial load latency (${initialLoadLatencyMs}ms) hurts user experience and SEO.`);
      }

      if (identifiedBottlenecks.length === 0 && findings.length > 0) {
        identifiedBottlenecks.push(findings[0].evidence);
      }
    }

    // 9. Core Angle and Suggested Scope
    const coreAngle = opportunityAssessment.coreAngle;
    const suggestedScope = opportunityAssessment.suggestedScope;

    // Format Structured Value Range from CommercialProfile
    const buildOffer = commercialProfile.recommendedBuildOffer;
    const careOffer = commercialProfile.recommendedMonthlyCare;
    const isINR = buildOffer.currency === "INR";
    const curSym = isINR ? "₹" : "$";
    
    const estimatedValueRange = `${curSym}${buildOffer.min.toLocaleString(isINR ? "en-IN" : "en-US")} – ${curSym}${buildOffer.max.toLocaleString(isINR ? "en-IN" : "en-US")} Build + ${curSym}${careOffer.min.toLocaleString(isINR ? "en-IN" : "en-US")}–${curSym}${careOffer.max.toLocaleString(isINR ? "en-IN" : "en-US")}/mo (${commercialProfile.feasibleOfferWindow.status === "DOWN_SCOPED" ? "Lean MVP" : "Market Fit"})`;

    let executiveSummary = "";
    if (qualification.disposition === "NOT_A_FIT") {
      executiveSummary = `${params.name} is an established ${params.category || "business"} (${model.replace(/_/g, " ")}). Qualification assessment: NOT A FIT — ${qualification.dispositionReason} Do not pursue based on current evidence.`;
    } else if (qualification.disposition === "INSUFFICIENT_EVIDENCE") {
      executiveSummary = `${params.name} is an operating entity. Qualification assessment: INSUFFICIENT EVIDENCE — ${qualification.dispositionReason} Do not generate outreach without further context.`;
    } else if (isGoogleVerified) {
      executiveSummary = `${params.name} is an established ${params.category || "local business"} (${googleEvidence.rating}★, ${googleEvidence.reviewCount} reviews) with ${commercialProfile.businessScale} business scale. Commercial assessment recommends a ${commercialProfile.pursuitAssessment.decision} approach with ${curSym}${buildOffer.min.toLocaleString(isINR ? "en-IN" : "en-US")}–${curSym}${buildOffer.max.toLocaleString(isINR ? "en-IN" : "en-US")} build package.`;
    } else {
      executiveSummary = `${params.name} is an operating ${params.category || "business"} (${model.replace(/_/g, " ")}) with digital web infrastructure audited. Commercial assessment recommends a ${commercialProfile.pursuitAssessment.decision} approach with ${curSym}${buildOffer.min.toLocaleString(isINR ? "en-IN" : "en-US")}–${curSym}${buildOffer.max.toLocaleString(isINR ? "en-IN" : "en-US")} build package.`;
    }

    // 10. Optional OpenAI LLM Enhancement (Strictly Evidence-Constrained & Gated by Qualification)
    if (apiKey && apiKey.trim().length > 0 && qualification.outreachAllowed) {
      try {
        const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              {
                role: "system",
                content:
                  "You are an elite B2B sales strategist for digital agencies. Generate concise, punchy executive pitch copy for a business lead based ONLY on verified facts and business model provided. If Google review data is not verified, DO NOT mention reviews, stars, or customer volume. DO NOT invent prices.",
              },
              {
                role: "user",
                content: `Business: ${params.name}
Category: ${params.category}
Business Model: ${model}
${isGoogleVerified ? `Google Verified Reputation: ${googleEvidence.rating}★ (${googleEvidence.reviewCount} reviews)` : "Google Reviews: UNVERIFIED / Direct Website Audit (DO NOT invent rating/reviews)"}
Business Scale: ${commercialProfile.businessScale}
Commercial Ceiling: ${curSym}${commercialProfile.clientCommercialCeiling.max}
Feasible Window: ${commercialProfile.feasibleOfferWindow.status}
Recommended Build: ${curSym}${buildOffer.min} – ${curSym}${buildOffer.max}
Monthly Care: ${curSym}${careOffer.min} – ${curSym}${careOffer.max}/mo
Audit Bottlenecks: ${identifiedBottlenecks.join("; ")}

Output a 2-sentence executive summary highlighting their exact commercial bottleneck and how fixing it unlocks revenue within their realistic budget.`,
              },
            ],
            temperature: 0.3,
            max_tokens: 150,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const aiSummary = json.choices?.[0]?.message?.content?.trim();
          if (aiSummary) {
            executiveSummary = aiSummary;
          }
        }
      } catch (llmErr) {
        console.warn("OpenAI synthesis call skipped, using deterministic summary:", llmErr);
      }
    }

    return {
      reputationScore: scores.reputationScore,
      digitalGapScore: scores.digitalGapScore,
      opportunityScore: scores.opportunityScore,
      confidenceScore: scores.confidenceScore,
      overallLeadScore: scores.overallLeadScore,
      opportunityType,
      disposition: qualification.disposition,
      hasWebsite: params.hasWebsite,
      hasGbpWebsiteLink: !params.isGbpDisconnected && params.hasWebsite,
      isGbpDisconnected: params.isGbpDisconnected,
      unlinkedWebsiteUrl: params.unlinkedWebsiteUrl,
      websiteUrl: params.websiteUrl,
      identifiedStrengths,
      identifiedBottlenecks,
      provenance,
      googleEvidence,
      discoveryNiche: params.discoveryNiche,
      discoveryQuery: params.discoveryQuery,
      googlePrimaryType: params.googlePrimaryType,
      googlePrimaryTypeDisplayName: params.googlePrimaryTypeDisplayName,
      categorySource: params.categorySource,
      categoryConfidence: params.categoryConfidence,
      recommendedPitch: {
        coreAngle,
        suggestedScope,
        identifiedBottlenecks,
        estimatedValueRange,
        outreachAllowed: qualification.outreachAllowed,
        dispositionReason: qualification.dispositionReason,
      },
      executiveSummary,
      commercialProfile,
      qualification,
    };
  }
}
