"use client";

import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Phone,
  MapPin,
  Globe,
  Star,
  Zap,
  TrendingUp,
  FileCode,
  Sparkles,
  Unlink,
  ShieldCheck,
} from "lucide-react";
import { Lead } from "@/core/db/schema";
import { ScoreGauge } from "./ScoreGauge";
import { OutreachClaimValidator } from "@/features/synthesis/OutreachClaimValidator";
import { BusinessModelClassifier } from "@/features/commercial/BusinessModelClassifier";

interface LeadInspectorDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  onStatusChange?: (leadId: string, status: any) => Promise<void>;
  onUpdateStatus?: (leadId: string, status: string) => Promise<void>;
}

export function LeadInspectorDrawer({
  lead,
  onClose,
  onStatusChange,
  onUpdateStatus,
}: LeadInspectorDrawerProps) {
  const [activeTab, setActiveTab] = useState<"whatsapp" | "email" | "phone" | "scope">("whatsapp");
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  if (!lead) return null;

  const dossier = (lead.dossier as any) || {};
  const pitch = dossier.recommendedPitch || {};
  const commercial = dossier.commercialProfile;
  const telemetry = lead.auditTelemetry;

  const founderName = process.env.NEXT_PUBLIC_AGENCY_FOUNDER_NAME || "Chanakya";
  const agencyName = process.env.NEXT_PUBLIC_AGENCY_NAME || "Agency Growth Partners";
  const cleanPhone = (lead.phone || "").replace(/[^0-9+]/g, "");

  const displayDomain = lead.unlinkedWebsiteUrl
    ? lead.unlinkedWebsiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : lead.websiteUrl
    ? lead.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : "No Website";

  // Dynamic INR / USD Formatting
  const buildOffer = commercial?.recommendedBuildOffer;
  const careOffer = commercial?.recommendedMonthlyCare;
  const isINR = buildOffer?.currency === "INR";
  const curSym = isINR ? "₹" : "$";

  const displayEstimatedValue = buildOffer && careOffer
    ? `${curSym}${buildOffer.min.toLocaleString(isINR ? "en-IN" : "en-US")} – ${curSym}${buildOffer.max.toLocaleString(isINR ? "en-IN" : "en-US")} Build + ${curSym}${careOffer.min.toLocaleString(isINR ? "en-IN" : "en-US")}–${curSym}${careOffer.max.toLocaleString(isINR ? "en-IN" : "en-US")}/mo (${commercial.feasibleOfferWindow.status === "DOWN_SCOPED" ? "Lean MVP" : "Market Fit"})`
    : pitch?.estimatedValueRange || `${curSym}18,000 – ${curSym}35,000`;

  // Establish Typed Google Evidence Status
  const isGoogleVerified =
    typeof lead.rating === "number" &&
    lead.rating !== null &&
    typeof lead.reviewCount === "number" &&
    lead.reviewCount !== null;

  const googleEvidence = dossier.googleEvidence || (
    isGoogleVerified
      ? {
          status: "VERIFIED" as const,
          placeId: lead.placeId,
          googleMapsUrl: lead.googleMapsUrl || "",
          rating: lead.rating,
          reviewCount: lead.reviewCount,
          source: "GOOGLE_PLACES" as const,
          retrievedAt: lead.createdAt,
        }
      : {
          status: "NOT_VERIFIED" as const,
          placeId: null,
          googleMapsUrl: null,
          rating: null,
          reviewCount: null,
          source: "NONE" as const,
        }
  );

  // Establish Business Model Context & Workflow Relevance
  const classification = BusinessModelClassifier.classify({
    name: lead.name,
    category: lead.category,
    domain: displayDomain,
    findings: telemetry?.findings || [],
  });
  const { model, relevantWorkflows } = classification;

  // 1. Evidence-Backed Why Points (Strictly Filtered by Business Model Workflow Relevance)
  const rawWhyPoints: string[] = [];
  if (lead.isGbpDisconnected && lead.unlinkedWebsiteUrl && relevantWorkflows.localGbpSync) {
    rawWhyPoints.push(`Official website (${displayDomain}) exists online but is disconnected from Google Maps profile, suppressing 3-pack local search rankings.`);
    rawWhyPoints.push("High-intent mobile searchers looking up your Google Maps profile cannot access treatments or book online.");
  } else if (!lead.hasWebsite) {
    rawWhyPoints.push("Zero official website linked on Google Maps—leaking high-intent mobile searchers to competitors.");
    rawWhyPoints.push("Lacks direct digital intake, forcing all potential clients to call during business hours only.");
  } else {
    if (telemetry && !telemetry.viewportMetaPresent) {
      rawWhyPoints.push("Mobile layout is desktop-only and unoptimized for touch smartphone users.");
    }
    if (telemetry && telemetry.hasHorizontalOverflow) {
      rawWhyPoints.push("Horizontal layout overflow disrupts mobile navigation on smartphone screens.");
    }
    // Only push WhatsApp if relevant to the business model (e.g. Clinics, Salons, Restaurants)
    if (relevantWorkflows.whatsAppIntake && telemetry && !telemetry.hasDirectClickToCall && !telemetry.hasWhatsAppDirectLink) {
      rawWhyPoints.push("Missing direct 1-tap call or WhatsApp conversion trigger for mobile traffic.");
    }
    // Only push Booking Form if relevant to the business model (e.g. Clinics, Spas, Law practices)
    if (relevantWorkflows.appointmentBooking && telemetry && !telemetry.hasInteractiveBookingForm) {
      rawWhyPoints.push("Missing automated online calendar booking or scheduling intake funnel.");
    }
    if (telemetry && !telemetry.hasSsl) {
      rawWhyPoints.push("Security Warning: Insecure HTTP protocol without SSL certificate.");
    }
    if (telemetry && telemetry.initialLoadLatencyMs > 2500) {
      rawWhyPoints.push(`Slow initial load latency (${telemetry.initialLoadLatencyMs}ms)—hurting search rankings.`);
    }
    if (rawWhyPoints.length === 0 && telemetry?.findings && telemetry.findings.length > 0) {
      rawWhyPoints.push(telemetry.findings[0].evidence);
    }
  }

  if (isGoogleVerified) {
    rawWhyPoints.push(`Strong established reputation: ${lead.rating!.toFixed(1)}★ rating across ${lead.reviewCount} verified reviews demonstrates customer demand.`);
  } else {
    rawWhyPoints.push(`Direct web infrastructure audit: Comprehensive empirical UX & speed audit completed.`);
  }

  // 2. Draft Outreach Copy (Model & Workflow Aware)
  const draftWhatsapp = isGoogleVerified && relevantWorkflows.whatsAppIntake
    ? `Hi team ${lead.name}, I was reviewing your Google Maps listing (${lead.rating!.toFixed(1)}★, ${lead.reviewCount} reviews) and noticed ${
        lead.isGbpDisconnected
          ? `your official website (${displayDomain}) isn't connected to your Maps profile, dropping your 3-pack patient rank.`
          : !lead.hasWebsite
          ? "you don't have a direct website/WhatsApp booking link on Maps for mobile visitors."
          : "your mobile site has horizontal layout overflow that makes booking from phones difficult."
      }\n\nI put together a 2-minute video breakdown of how fixing this captures 15-25 more client inquiries a month. Can I share it here?\n\nBest,\n${founderName}`
    : model === "B2B_SAAS_TECH"
    ? `Hi team ${lead.name}, I was analyzing ${displayDomain} and noticed opportunities to streamline your mobile onboarding and product conversion funnel.\n\nI put together a 2-minute video walkthrough showing how fixing this improves sign-up velocity. Can I share it here?\n\nBest,\n${founderName}`
    : model === "B2B_INDUSTRIAL_MANUFACTURING"
    ? `Hi team ${lead.name}, I was reviewing ${displayDomain} and noticed opportunities to modernize your digital product catalog and Request-for-Quote (RFQ) pipeline.\n\nI put together a 2-minute video breakdown showing how this captures more buyer inquiries. Can I share it here?\n\nBest,\n${founderName}`
    : model === "ECOMMERCE_D2C"
    ? `Hi team ${lead.name}, I was reviewing ${displayDomain} and noticed opportunities to accelerate mobile checkout and storefront navigation.\n\nI put together a 2-minute video breakdown showing how this boosts conversion rates. Can I share it here?\n\nBest,\n${founderName}`
    : `Hi team ${lead.name}, I was reviewing ${displayDomain} and noticed ${
        telemetry && !telemetry.viewportMetaPresent
          ? "your mobile site has desktop layout overflow that makes navigation difficult from phones."
          : telemetry && !telemetry.hasSsl
          ? "your domain lacks an active SSL security certificate, triggering browser trust warnings."
          : "opportunities to optimize your mobile responsive layout and page load performance."
      }\n\nI put together a 2-minute video breakdown of how resolving this improves visitor conversion. Can I share it here?\n\nBest,\n${founderName}`;

  const draftEmail = isGoogleVerified && relevantWorkflows.localGbpSync
    ? `Subject: Question regarding ${lead.name}'s Google Maps listing\n\nHi ${lead.name} Team,\n\nI came across ${lead.name} while researching top-rated ${lead.category || "service providers"} in ${lead.formattedAddress || "your city"}—congratulations on maintaining a ${lead.rating!.toFixed(1)}★ rating across ${lead.reviewCount} reviews.\n\nWhile analyzing your local digital footprint, I spotted a significant commercial bottleneck:\n\n${rawWhyPoints.map((p) => `• ${p}`).join("\n")}\n\nWe specialize in fixing these exact conversion leaks for established ${lead.category || "businesses"} without disrupting ongoing operations.\n\nWould you be open to a brief 5-minute Loom walkthrough showing exactly how we can resolve this for ${lead.name}?\n\nBest regards,\n\n${founderName}\n${agencyName}`
    : `Subject: Technical observation regarding ${displayDomain}\n\nHi ${lead.name} Team,\n\nI was analyzing ${displayDomain} and spotted a significant commercial bottleneck affecting mobile visitor conversions:\n\n${rawWhyPoints.map((p) => `• ${p}`).join("\n")}\n\nWe specialize in fixing these exact conversion leaks without disrupting ongoing operations.\n\nWould you be open to a brief 5-minute Loom walkthrough showing exactly how we can resolve this for ${lead.name}?\n\nBest regards,\n\n${founderName}\n${agencyName}`;

  const draftPhone = isGoogleVerified && relevantWorkflows.localGbpSync
    ? `Front-Desk Script for ${lead.name}:\nOperator: "Hi, I was looking up ${lead.name} on Google Maps—congratulations on the ${lead.rating!.toFixed(1)}★ rating with ${lead.reviewCount} reviews! \n\nI noticed a technical issue with your online booking and mobile setup where patients/clients might have trouble scheduling directly from their phones. \n\nWho is the practice manager or owner responsible for your digital operations so I can send over a quick 2-minute screenshot breakdown for them?"`
    : `Front-Desk Script for ${lead.name}:\nOperator: "Hi, I was reviewing ${displayDomain} and noticed a technical issue with your mobile layout where visitors have trouble navigating from their phones. \n\nWho is the manager or owner responsible for your website operations so I can send over a quick 2-minute screenshot breakdown for them?"`;

  // 3. Domain-Level Outreach Claim Validation
  const validatedOutreach = OutreachClaimValidator.validate({
    name: lead.name,
    category: lead.category,
    domain: displayDomain,
    googleEvidence,
    coreAngle: pitch?.coreAngle || "Digital Infrastructure",
    whatsappCopy: draftWhatsapp,
    coldEmailCopy: draftEmail,
    phoneScript: draftPhone,
    whyPoints: rawWhyPoints,
  });

  const scopeCopy = `[PROPOSED TECHNICAL SCOPE & DELIVERABLES]
Project: ${lead.name} — ${pitch?.coreAngle || "Digital Architecture"}
Target Scope Benchmark: ${displayEstimatedValue}

Deliverables:
• ${pitch?.suggestedScope || "Full responsive rebuild & conversion engine"}
• Technical Local Business Schema & Google Maps Synchronization
• Mobile-First Speed Optimization (<1.5s TTFB)
• Direct Click-to-Call & WhatsApp Intake Funnel
• Interactive Booking / Calendar Integration`;

  const getActiveCopyText = () => {
    switch (activeTab) {
      case "whatsapp":
        return validatedOutreach.whatsappCopy;
      case "email":
        return validatedOutreach.coldEmailCopy;
      case "phone":
        return validatedOutreach.phoneScript;
      case "scope":
        return scopeCopy;
    }
  };

  const handleCopy = (text: string, tabName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#0D111A] border-l border-white/[0.08] flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-250">
        {/* Drawer Header */}
        <div className="p-6 border-b border-white/[0.08] flex items-start justify-between gap-4 bg-[#0A0D14]">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-base font-bold text-white font-sans">{lead.name}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {lead.category || "Operating Business"}
              </span>
              {dossier?.disposition && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    dossier.disposition === "PURSUE"
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      : dossier.disposition === "NOT_A_FIT"
                      ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                      : dossier.disposition === "INSUFFICIENT_EVIDENCE"
                      ? "bg-slate-500/10 text-slate-300 border-slate-500/30"
                      : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                  }`}
                >
                  {dossier.disposition.replace(/_/g, " ")}
                </span>
              )}
              {dossier?.categorySource && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium border ${
                    dossier.categorySource === "GOOGLE_VERIFIED"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : dossier.categorySource === "GOOGLE_MAPS_DOM"
                      ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                      : dossier.categorySource === "WEBSITE_META"
                      ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                      : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                  }`}
                >
                  {dossier.categorySource === "GOOGLE_VERIFIED"
                    ? "Google Verified"
                    : dossier.categorySource === "GOOGLE_MAPS_DOM"
                    ? "Maps DOM"
                    : dossier.categorySource === "WEBSITE_META"
                    ? "Website Detected"
                    : "User Specified"}
                </span>
              )}
              {lead.isGbpDisconnected ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                  <Unlink className="w-2.5 h-2.5" /> Disconnected GBP
                </span>
              ) : !lead.hasWebsite ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Zero Website
                </span>
              ) : (
                <a
                  href={lead.websiteUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-mono text-indigo-300 hover:text-indigo-200 border border-white/[0.08] bg-white/[0.03]"
                >
                  <Globe className="w-3 h-3" />
                  <span>{displayDomain}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>

            {/* Discovery Query & Provenance Context */}
            {dossier?.discoveryNiche && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1 font-mono">
                <span className="text-slate-500">Discovery Intent:</span>
                <span className="text-slate-300">"{dossier.discoveryNiche}"</span>
                {dossier.discoveryQuery && dossier.discoveryQuery !== dossier.discoveryNiche && (
                  <span className="text-slate-500 text-[10px]">({dossier.discoveryQuery})</span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2 font-mono">
              {isGoogleVerified ? (
                <span className="text-amber-400 font-semibold">
                  ★ {lead.rating!.toFixed(1)} <span className="text-slate-400 font-normal">({lead.reviewCount} Google reviews)</span>
                </span>
              ) : (
                <span className="text-slate-400 font-mono text-[11px] bg-slate-800/60 px-2 py-0.5 rounded border border-white/[0.08]">
                  Direct URL Audit (Unlinked Google Place)
                </span>
              )}
              {lead.phone && (
                <a
                  href={`tel:${cleanPhone}`}
                  className="flex items-center gap-1 text-slate-300 hover:text-white transition"
                >
                  <Phone className="w-3 h-3 text-slate-500" />
                  {lead.phone}
                </a>
              )}
              {lead.formattedAddress && (
                <span className="flex items-center gap-1 text-slate-400 truncate max-w-[240px] font-sans">
                  <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">{lead.formattedAddress}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ScoreGauge score={lead.totalLeadScore ?? 0} size="sm" />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs bg-[#0D111A] flex-1">
          {/* 1. WHY THIS LEAD (Commercial Thesis) */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 font-mono">
              Why This Lead (Commercial Thesis)
            </h3>
            <div className="p-3.5 rounded-lg bg-[#0A0D14] border border-white/[0.06] space-y-2 text-slate-300 leading-relaxed font-sans">
              {validatedOutreach.whyPoints.map((pt, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-indigo-400 font-bold mt-0.5">•</span>
                  <span>{pt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. COMMERCIAL ECONOMICS & FEASIBLE OFFER MATRIX */}
          {commercial && (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300 font-mono flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Commercial Economics &amp; Reality Scoping</span>
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                    commercial.pursuitAssessment.decision === "PURSUE"
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      : commercial.pursuitAssessment.decision === "PURSUE_LOW_TOUCH"
                      ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      : "bg-slate-500/10 text-slate-300 border-slate-500/30"
                  }`}
                >
                  {commercial.pursuitAssessment.decision}
                </span>
              </div>

              {/* Economic Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06]">
                  <div className="text-[10px] text-slate-500 uppercase">Est. Business Scale</div>
                  <div className="text-xs font-bold text-slate-200 mt-0.5">{commercial.businessScale}</div>
                </div>

                <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06]">
                  <div className="text-[10px] text-slate-500 uppercase">Commercial Ceiling</div>
                  <div className="text-xs font-bold text-indigo-300 mt-0.5">
                    {curSym}{commercial.clientCommercialCeiling.max.toLocaleString(isINR ? "en-IN" : "en-US")}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06]">
                  <div className="text-[10px] text-slate-500 uppercase">Recommended Build</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">
                    {curSym}{buildOffer?.min.toLocaleString(isINR ? "en-IN" : "en-US")} – {curSym}{buildOffer?.max.toLocaleString(isINR ? "en-IN" : "en-US")}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06]">
                  <div className="text-[10px] text-slate-500 uppercase">Monthly Care</div>
                  <div className="text-xs font-bold text-teal-400 mt-0.5">
                    {curSym}{careOffer?.min.toLocaleString(isINR ? "en-IN" : "en-US")}–{curSym}{careOffer?.max.toLocaleString(isINR ? "en-IN" : "en-US")}/mo
                  </div>
                </div>
              </div>

              {/* Rationale & Evidence Footnote */}
              <div className="text-[11px] text-slate-400 leading-relaxed bg-black/20 p-2.5 rounded-lg border border-white/[0.04]">
                <span className="text-slate-300 font-semibold">Strategic Rationale: </span>
                {commercial.commercialRationale}
              </div>
            </div>
          )}

          {/* 3. TECHNICAL AUDIT BREAKDOWN */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 font-mono">
              Audit Telemetry &amp; Observations
            </h3>

            {telemetry ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                  <div className="p-2.5 rounded-lg bg-[#0A0D14] border border-white/[0.06]">
                    <div className="text-[10px] text-slate-500">SSL Security</div>
                    <div className={`text-xs font-semibold mt-0.5 ${telemetry.hasSsl ? "text-emerald-400" : "text-rose-400"}`}>
                      {telemetry.hasSsl ? "Active (HTTPS)" : "Insecure (HTTP)"}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#0A0D14] border border-white/[0.06]">
                    <div className="text-[10px] text-slate-500">Mobile Viewport</div>
                    <div className={`text-xs font-semibold mt-0.5 ${telemetry.viewportMetaPresent && !telemetry.hasHorizontalOverflow ? "text-emerald-400" : "text-rose-400"}`}>
                      {!telemetry.viewportMetaPresent ? "Missing Viewport" : telemetry.hasHorizontalOverflow ? "Layout Overflow" : "Responsive Pass"}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#0A0D14] border border-white/[0.06]">
                    <div className="text-[10px] text-slate-500">1-Tap Intake CTA</div>
                    <div className={`text-xs font-semibold mt-0.5 ${telemetry.hasDirectClickToCall || telemetry.hasWhatsAppDirectLink ? "text-emerald-400" : "text-amber-400"}`}>
                      {telemetry.hasWhatsAppDirectLink ? "WhatsApp Active" : telemetry.hasDirectClickToCall ? "Click-to-Call" : "No Direct CTA"}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#0A0D14] border border-white/[0.06]">
                    <div className="text-[10px] text-slate-500">Load Latency</div>
                    <div className={`text-xs font-semibold mt-0.5 ${telemetry.initialLoadLatencyMs < 1500 ? "text-emerald-400" : telemetry.initialLoadLatencyMs < 3000 ? "text-amber-400" : "text-rose-400"}`}>
                      {telemetry.initialLoadLatencyMs}ms
                    </div>
                  </div>
                </div>

                {/* Findings List */}
                {telemetry.findings && telemetry.findings.length > 0 && (
                  <div className="p-3.5 rounded-lg bg-[#0A0D14] border border-white/[0.06] space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                      Observed Gaps ({telemetry.findings.length})
                    </div>
                    <div className="space-y-1.5">
                      {telemetry.findings.map((f, i) => (
                        <div key={i} className="text-slate-300 text-xs flex items-start gap-2">
                          <span className="text-amber-400 font-bold">•</span>
                          <span>{f.evidence}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-[#0A0D14] border border-white/[0.06] text-slate-400 text-xs text-center font-mono">
                No active website detected on Google Maps profile.
              </div>
            )}
          </div>

          {/* 4. HIGH-CONVICTION OUTREACH DECKS */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>High-Conviction Sales Copy &amp; Scripts</span>
              </h3>

              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/40 border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setActiveTab("whatsapp")}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition cursor-pointer ${
                    activeTab === "whatsapp" ? "bg-emerald-600 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("email")}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition cursor-pointer ${
                    activeTab === "email" ? "bg-indigo-600 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Cold Email
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("phone")}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition cursor-pointer ${
                    activeTab === "phone" ? "bg-purple-600 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Phone Script
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("scope")}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition cursor-pointer ${
                    activeTab === "scope" ? "bg-slate-700 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Scope
                </button>
              </div>
            </div>

            {pitch?.outreachAllowed === false ? (
              <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-slate-300 font-mono text-xs space-y-2">
                <div className="font-bold text-rose-300 flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-rose-400" />
                  <span>OUTREACH GATED — {dossier?.disposition?.replace(/_/g, " ") || "NOT A FIT"}</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                  {pitch?.dispositionReason || "Observed website telemetry does not establish a commercially relevant agency problem."}
                </p>
                <div className="text-[10px] text-slate-500 font-mono">
                  Engine Integrity Gate: The system does not manufacture outreach scripts for leads where an agency intervention is not commercially evidenced.
                </div>
              </div>
            ) : (
              <div className="relative">
                <pre className="p-4 rounded-lg bg-[#0A0D14] border border-white/[0.08] text-slate-200 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all overflow-x-auto max-h-64">
                  {getActiveCopyText()}
                </pre>

                <button
                  type="button"
                  onClick={() => handleCopy(getActiveCopyText(), activeTab)}
                  className="absolute top-2.5 right-2.5 px-2.5 py-1.5 rounded bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer backdrop-blur-md border border-white/[0.08]"
                >
                  {copiedTab === activeTab ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy {activeTab}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Drawer Bottom Triage Action Bar */}
        <div className="p-4 border-t border-white/[0.08] bg-[#0A0D14] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono">Triage Status:</span>
            <select
              value={lead.humanStatus}
              disabled={isUpdatingStatus}
              onChange={async (e) => {
                const handler = onStatusChange || onUpdateStatus;
                if (handler) {
                  setIsUpdatingStatus(true);
                  try {
                    await handler(lead.id, e.target.value);
                  } finally {
                    setIsUpdatingStatus(false);
                  }
                }
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/[0.12] text-slate-200 text-xs font-mono font-medium focus:outline-none focus:border-indigo-400 cursor-pointer"
            >
              <option value="NEW">NEW</option>
              <option value="REVIEWED">REVIEWED</option>
              <option value="READY_FOR_OUTREACH">READY FOR OUTREACH</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {lead.phone && (
              <a
                href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(validatedOutreach.whatsappCopy)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Open WhatsApp</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-xs transition cursor-pointer border border-white/[0.08]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
