import { BusinessDossier, AuditTelemetry, ReviewTrend } from "@/core/db/schema";
import { OpportunityClassifier } from "@/features/qualification/OpportunityClassifier";
import { ScoringEngine } from "@/features/qualification/ScoringEngine";

export interface SynthesizerParams {
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  reviewTrend: ReviewTrend;
  reviewsLast30Days?: number | null;
  reviewsLast90Days?: number | null;
  hasWebsite: boolean;
  websiteUrl?: string | null;
  phone?: string | null;
  formattedAddress?: string | null;
  auditTelemetry?: AuditTelemetry | null;
}

export class DossierSynthesizer {
  public static async synthesize(
    params: SynthesizerParams,
    apiKey?: string
  ): Promise<BusinessDossier> {
    const opportunityType = OpportunityClassifier.classify({
      hasWebsite: params.hasWebsite,
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
      hasWebsite: params.hasWebsite,
      auditTelemetry: params.auditTelemetry,
      opportunityType,
    });

    // 1. Grounded Deterministic Rules Engine
    const identifiedStrengths = [
      `Established market reputation with ${params.rating}★ rating across ${params.reviewCount} verified Google reviews.`,
    ];

    if (params.reviewTrend !== "UNKNOWN") {
      identifiedStrengths.push(
        `Measured customer review velocity: ${params.reviewTrend}.`
      );
    }

    const identifiedBottlenecks: string[] = [];

    if (!params.hasWebsite) {
      identifiedBottlenecks.push(
        "Zero official website presence on Google Business Profile, forfeiting high-intent mobile searchers to competitors."
      );
      identifiedBottlenecks.push(
        "Lacks direct digital intake, forcing all potential customers to call during office hours only."
      );
    } else if (params.auditTelemetry) {
      const { findings, hasSsl, viewportMetaPresent, hasHorizontalOverflow, hasDirectClickToCall, hasInteractiveBookingForm } =
        params.auditTelemetry;

      if (!hasSsl) identifiedBottlenecks.push("Security Warning: Insecure HTTP protocol without SSL certificate.");
      if (!viewportMetaPresent) identifiedBottlenecks.push("Mobile Friction: Missing responsive viewport meta tag.");
      if (hasHorizontalOverflow) identifiedBottlenecks.push("UX Breakdown: Horizontal page layout overflow on mobile screens.");
      if (!hasDirectClickToCall) identifiedBottlenecks.push("Conversion Leak: No direct 'tel:' click-to-call link for phone visitors.");
      if (!hasInteractiveBookingForm) identifiedBottlenecks.push("Operational Gap: No 24/7 interactive online booking or calendar funnel.");

      if (identifiedBottlenecks.length === 0 && findings.length > 0) {
        identifiedBottlenecks.push(findings[0].evidence);
      }
    }

    let coreAngle = "";
    let suggestedScope = "";
    let estimatedValueRange = "";

    if (opportunityType === "CUSTOM_OPERATIONAL_SOFTWARE") {
      coreAngle = `Automating client scheduling, WhatsApp intake, and internal service management for ${params.name}.`;
      suggestedScope = `Custom automated intake portal, 24/7 calendar booking sync, multi-staff calendar management, and SMS/WhatsApp appointment reminders.`;
      estimatedValueRange = "$6,500 – $14,000 (Target Scope Benchmark)";
    } else if (opportunityType === "WEBSITE_AUTOMATION") {
      coreAngle = `Upgrading ${params.name}'s mobile conversion speed and adding instant interactive booking.`;
      suggestedScope = `Mobile-first speed optimization (<1.5s LCP), direct click-to-call conversion bar, and embedded scheduling widget.`;
      estimatedValueRange = "$3,500 – $7,500 (Target Scope Benchmark)";
    } else {
      coreAngle = `Launching a high-converting digital storefront for ${params.name} to capture Google Maps traffic.`;
      suggestedScope = `Complete responsive website build, Google Maps schema integration, mobile call-to-action anchors, and lead capture form.`;
      estimatedValueRange = "$2,500 – $5,000 (Target Scope Benchmark)";
    }

    let executiveSummary = `${params.name} is a high-reputation ${params.category || "local business"} (${params.rating}★, ${params.reviewCount} reviews) with high customer trust but a substantial ${opportunityType.replace(/_/g, " ")} gap. Resolving these bottlenecks directly increases captured mobile bookings.`;

    // 2. Optional OpenAI LLM Enhancement (if OPENAI_API_KEY is configured)
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
                  "You are an elite B2B sales strategist for digital agencies. Generate concise, punchy executive pitch copy for a local business lead.",
              },
              {
                role: "user",
                content: `Business: ${params.name}
Category: ${params.category}
Rating: ${params.rating}★ (${params.reviewCount} reviews)
Has Website: ${params.hasWebsite}
Audit Bottlenecks: ${identifiedBottlenecks.join("; ")}
Opportunity Tier: ${opportunityType}

Output a 2-sentence executive summary highlighting their exact commercial bottleneck and how fixing it unlocks revenue.`,
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
      identifiedStrengths,
      identifiedBottlenecks,
      recommendedPitch: {
        coreAngle,
        suggestedScope,
        identifiedBottlenecks,
        estimatedValueRange,
      },
      executiveSummary,
    };
  }
}
