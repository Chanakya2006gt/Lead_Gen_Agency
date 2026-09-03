import { BusinessDossier, AuditTelemetry, ReviewTrend, SignalProvenance } from "@/core/db/schema";
import { OpportunityClassifier } from "@/features/qualification/OpportunityClassifier";
import { ScoringEngine } from "@/features/qualification/ScoringEngine";
import { CommercialEconomicsEngine } from "@/features/commercial/CommercialEconomicsEngine";

export interface SynthesizerParams {
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
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
    const opportunityType = OpportunityClassifier.classify({
      hasWebsite: params.hasWebsite,
      isGbpDisconnected: params.isGbpDisconnected,
      reviewCount: params.reviewCount,
      rating: params.rating,
      auditTelemetry: params.auditTelemetry,
      category: params.category,
    });

    const scores = ScoringEngine.computeScores({
      rating: params.rating,
      reviewCount: params.reviewCount,
      reviewTrend: params.reviewTrend,
      reviewsLast30Days: params.reviewsLast30Days,
      reviewsLast90Days: params.reviewsLast90Days,
      hasWebsite: params.hasWebsite || Boolean(params.isGbpDisconnected),
      auditTelemetry: params.auditTelemetry,
      opportunityType,
    });

    // 1. Run Market-Aware Commercial Economics Engine
    const commercialProfile = CommercialEconomicsEngine.analyze({
      name: params.name,
      category: params.category,
      rating: params.rating,
      reviewCount: params.reviewCount,
      formattedAddress: params.formattedAddress,
      hasWebsite: params.hasWebsite,
      isGbpDisconnected: params.isGbpDisconnected,
      auditTelemetry: params.auditTelemetry,
      websiteTextSnippet: params.websiteTextSnippet,
      serviceType: opportunityType,
    });

    // 2. Signal Provenance & Confidence Ledger
    const provenance: SignalProvenance = {
      ratingConfidence: "high",
      reviewVelocityConfidence: params.reviewTrend !== "UNKNOWN" ? "observed" : "unknown",
      identityConfidence: params.googleMapsUrl ? "google_verified" : "deterministic",
      auditConfidence: params.auditTelemetry ? "empirical" : "pending",
    };

    // 3. Grounded Deterministic Rules Engine
    const identifiedStrengths = [
      `Established market reputation with ${params.rating}★ rating across ${params.reviewCount} verified Google reviews.`,
    ];

    if (params.reviewTrend !== "UNKNOWN") {
      identifiedStrengths.push(
        `Measured customer review velocity: ${params.reviewTrend}.`
      );
    }

    const identifiedBottlenecks: string[] = [];

    if (params.isGbpDisconnected) {
      const domainDisplay = params.unlinkedWebsiteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "official domain";
      identifiedBottlenecks.push(
        `Disconnected Google Business Profile: Official website (${domainDisplay}) exists but is missing from Google Maps profile.`
      );
      identifiedBottlenecks.push(
        "Local Search Ranking Penalty: Missing website link suppresses Google Maps 3-pack local search visibility."
      );
    } else if (!params.hasWebsite) {
      identifiedBottlenecks.push(
        "Zero official website presence on Google Business Profile, forfeiting high-intent mobile searchers to competitors."
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

      if (!hasInteractiveBookingForm) {
        identifiedBottlenecks.push("Operational Gap: No 24/7 interactive online booking or calendar funnel.");
      }

      if (!hasDirectClickToCall && !hasWhatsAppDirectLink) {
        identifiedBottlenecks.push("Conversion Leak: No direct 1-tap call or WhatsApp consultation link for phone visitors.");
      }

      if (initialLoadLatencyMs > 2500) {
        identifiedBottlenecks.push(`Performance Bottleneck: Slow initial load latency (${initialLoadLatencyMs}ms) hurts search rankings.`);
      }

      if (identifiedBottlenecks.length === 0 && findings.length > 0) {
        identifiedBottlenecks.push(findings[0].evidence);
      }
    }

    let coreAngle = "";
    if (opportunityType === "DISCONNECTED_GBP_WEBSITE") {
      const domainDisplay = params.unlinkedWebsiteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "official domain";
      coreAngle = `Reconnecting your active website (${domainDisplay}) to your Google Maps profile to capture patients and recover local 3-pack search ranking.`;
    } else if (opportunityType === "CUSTOM_OPERATIONAL_SOFTWARE") {
      coreAngle = `Automating client scheduling, WhatsApp intake, and internal service management for ${params.name}.`;
    } else if (opportunityType === "WEBSITE_AUTOMATION") {
      coreAngle = `Upgrading ${params.name}'s mobile speed, fixing desktop pinch-to-zoom layout, and adding 1-tap WhatsApp consultation booking.`;
    } else {
      coreAngle = `Launching a high-converting mobile digital storefront for ${params.name} to capture Google Maps traffic and direct WhatsApp leads.`;
    }

    // Dynamic suggested scope from CommercialProfile
    const suggestedScope = commercialProfile.downscopedScopeDescription || (
      opportunityType === "DISCONNECTED_GBP_WEBSITE"
        ? "1. Google Business Profile Synchronization: Reconnect verified website to Maps. 2. Local Schema Integration: Embed LocalBusiness JSON-LD markup. 3. 1-Tap WhatsApp Conversion: Connect mobile consultation trigger."
        : opportunityType === "WEBSITE_AUTOMATION"
        ? "1. Mobile Viewport & Touch Layout Re-engineering. 2. 24/7 WhatsApp & Online Booking Funnel. 3. SSL Hardening & Speed Acceleration (<1.5s)."
        : opportunityType === "CUSTOM_OPERATIONAL_SOFTWARE"
        ? "1. Multi-Staff Calendar & WhatsApp Intake Engine. 2. Automated Patient Reminders & Service Records Portal. 3. Mobile Staff Dashboard."
        : "1. Mobile-First Storefront Architecture. 2. Doctor/Service Menus & Reviews Embed. 3. 1-Tap WhatsApp Consultation Bar & Google Maps Schema."
    );

    // Format Structured Value Range from CommercialProfile
    const buildOffer = commercialProfile.recommendedBuildOffer;
    const careOffer = commercialProfile.recommendedMonthlyCare;
    const isINR = buildOffer.currency === "INR";
    const curSym = isINR ? "₹" : "$";
    
    const estimatedValueRange = `${curSym}${buildOffer.min.toLocaleString(isINR ? "en-IN" : "en-US")} – ${curSym}${buildOffer.max.toLocaleString(isINR ? "en-IN" : "en-US")} Build + ${curSym}${careOffer.min.toLocaleString(isINR ? "en-IN" : "en-US")}–${curSym}${careOffer.max.toLocaleString(isINR ? "en-IN" : "en-US")}/mo (${commercialProfile.feasibleOfferWindow.status === "DOWN_SCOPED" ? "Lean MVP" : "Market Fit"})`;

    let executiveSummary = `${params.name} is an established ${params.category || "local business"} (${params.rating}★, ${params.reviewCount} reviews) with ${commercialProfile.businessScale} business scale. Commercial assessment recommends a ${commercialProfile.pursuitAssessment.decision} approach with ${curSym}${buildOffer.min.toLocaleString(isINR ? "en-IN" : "en-US")}–${curSym}${buildOffer.max.toLocaleString(isINR ? "en-IN" : "en-US")} build package.`;

    // 4. Optional OpenAI LLM Enhancement (Strictly Narrative Synthesis, NO price invention)
    if (apiKey && apiKey.trim().length > 0) {
      try {
        const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content:
                  "You are an elite B2B sales strategist for digital agencies. Generate concise, punchy executive pitch copy for a local business lead based on the provided commercial profile and audit facts. DO NOT invent or modify price numbers.",
              },
              {
                role: "user",
                content: `Business: ${params.name}
Category: ${params.category}
Rating: ${params.rating}★ (${params.reviewCount} reviews)
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
      hasWebsite: params.hasWebsite,
      hasGbpWebsiteLink: !params.isGbpDisconnected && params.hasWebsite,
      isGbpDisconnected: params.isGbpDisconnected,
      unlinkedWebsiteUrl: params.unlinkedWebsiteUrl,
      websiteUrl: params.websiteUrl,
      identifiedStrengths,
      identifiedBottlenecks,
      provenance,
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
      },
      executiveSummary,
      commercialProfile,
    };
  }
}
