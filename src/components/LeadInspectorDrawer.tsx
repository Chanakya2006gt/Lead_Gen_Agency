"use client";

import React, { useState, useEffect } from "react";
import { Lead, HumanStatus, BusinessDossier } from "@/core/db/schema";
import { ScoreGauge } from "./ScoreGauge";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  MapPin,
  Phone,
  Globe,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Unlink,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

interface LeadInspectorDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  onStatusChange: (leadId: string, status: HumanStatus) => Promise<void>;
}

export function LeadInspectorDrawer({ lead, onClose, onStatusChange }: LeadInspectorDrawerProps) {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"email" | "whatsapp" | "phone" | "scope">("email");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!lead) return null;

  const dossier: BusinessDossier | null = (lead.dossier as any) || null;
  const telemetry = (lead.auditTelemetry as any) || null;
  const pitch = dossier?.recommendedPitch;
  const commercial = dossier?.commercialProfile;

  const founderName = process.env.NEXT_PUBLIC_AGENCY_FOUNDER_NAME || "Chanakya";
  const agencyName = process.env.NEXT_PUBLIC_AGENCY_NAME || "Agency Operations";

  const cleanPhone = lead.phone ? lead.phone.replace(/[^0-9+]/g, "") : "";
  const displayDomain = (lead.unlinkedWebsiteUrl || lead.websiteUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

  // Clean estimated value string (strips legacy USD/Int'l tags if present in cached DB records)
  const displayEstimatedValue = (pitch?.estimatedValueRange || "₹18,000 – ₹35,000 (Market Fit)")
    .replace(/\s*\/\s*\$[\d,–\s]+(?:\s*Int'l)?/gi, "")
    .replace(/\s*\(Target Scope Benchmark\)/gi, "")
    .trim();

  // Dynamic Synthesis for "WHY THIS LEAD"
  const whyPoints: string[] = [];
  if (lead.isGbpDisconnected && lead.unlinkedWebsiteUrl) {
    whyPoints.push(`Official website (${displayDomain}) exists online but is disconnected from Google Maps profile, suppressing 3-pack local search rankings.`);
    whyPoints.push("High-intent mobile searchers looking up your Google Maps profile cannot access treatments or book online.");
  } else if (!lead.hasWebsite) {
    whyPoints.push("Zero official website linked on Google Maps—leaking high-intent mobile searchers to competitors.");
    whyPoints.push("Lacks direct digital intake, forcing all potential clients to call during business hours only.");
  } else {
    if (telemetry && !telemetry.viewportMetaPresent) {
      whyPoints.push("Mobile layout is desktop-only and unoptimized for touch smartphone users.");
    }
    if (telemetry && !telemetry.hasDirectClickToCall && !telemetry.hasWhatsAppDirectLink) {
      whyPoints.push("Missing direct 1-tap call or WhatsApp conversion trigger for mobile traffic.");
    }
    if (telemetry && telemetry.initialLoadLatencyMs > 2500) {
      whyPoints.push(`Slow initial load latency (${telemetry.initialLoadLatencyMs}ms)—hurting Google search rankings.`);
    }
  }

  whyPoints.push(`Strong established reputation: ${lead.rating.toFixed(1)}★ rating across ${lead.reviewCount} verified reviews demonstrates high customer demand and purchasing power.`);

  // WhatsApp Hook Copy
  const whatsappCopy = `Hi team ${lead.name}, I was reviewing your Google Maps listing (${lead.rating}★, ${lead.reviewCount} reviews) and noticed ${
    lead.isGbpDisconnected
      ? `your official website (${displayDomain}) isn't connected to your Maps profile, dropping your 3-pack patient rank.`
      : !lead.hasWebsite
      ? "you don't have a direct website/WhatsApp booking link on Maps for mobile visitors."
      : "your mobile site has horizontal layout overflow that makes booking from phones difficult."
  }

I put together a 2-minute video breakdown of how fixing this captures 15-25 more client inquiries a month. Can I share it here?

Best,
${founderName}`;

  // Cold Email Copy
  const coldEmailCopy = `Subject: Question regarding ${lead.name}'s Google Maps listing

Hi ${lead.name} Team,

I came across ${lead.name} while researching top-rated ${lead.category || "service providers"} in ${lead.formattedAddress || "your city"}—congratulations on maintaining a ${lead.rating}★ rating across ${lead.reviewCount} reviews.

While analyzing your local digital footprint, I spotted a significant commercial bottleneck:

${whyPoints.map((p) => `• ${p}`).join("\n")}

We specialize in fixing these exact conversion leaks for established ${lead.category || "businesses"} without disrupting ongoing operations.

Would you be open to a brief 5-minute Loom walkthrough showing exactly how we can resolve this for ${lead.name}?

Best regards,

${founderName}
${agencyName}`;

  // Phone Gatekeeper Script
  let phoneScript = `Front-Desk Script for ${lead.name}:
Operator: "Hi, I was looking up ${lead.name} on Google Maps—congratulations on the ${lead.rating}★ rating with ${lead.reviewCount} reviews! 

I noticed a technical issue with your online booking and mobile setup where patients/clients might have trouble scheduling directly from their phones. 

Who is the practice manager or owner responsible for your digital operations so I can send over a quick 2-minute screenshot breakdown for them?"`;

  // Technical Scope
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
        return whatsappCopy;
      case "email":
        return coldEmailCopy;
      case "phone":
        return phoneScript;
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
              <span className="text-amber-400 font-semibold">
                ★ {lead.rating.toFixed(1)} <span className="text-slate-400 font-normal">({lead.reviewCount} Google reviews)</span>
              </span>
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
              {whyPoints.map((pt, idx) => (
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
                  {commercial.pursuitAssessment.decision.replace(/_/g, " ")}
                </span>
              </div>

              {/* Metric Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded bg-black/40 border border-white/[0.06]">
                  <span className="text-slate-400 block text-[10px]">Business Scale</span>
                  <span className="text-white font-bold">{commercial.businessScale}</span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-white/[0.06]">
                  <span className="text-slate-400 block text-[10px]">Commercial Ceiling</span>
                  <span className="text-indigo-300 font-bold">
                    ₹{commercial.clientCommercialCeiling.max.toLocaleString("en-IN")} Max
                  </span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-white/[0.06]">
                  <span className="text-slate-400 block text-[10px]">Agency Delivery Floor</span>
                  <span className="text-slate-200 font-bold">
                    ₹{commercial.agencyDeliveryEconomics.minimumViableDeliveryPrice.min.toLocaleString("en-IN")} Floor
                  </span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-white/[0.06]">
                  <span className="text-slate-400 block text-[10px]">Feasible Window</span>
                  <span
                    className={`font-bold ${
                      commercial.feasibleOfferWindow.status === "HEALTHY"
                        ? "text-emerald-400"
                        : "text-amber-400"
                    }`}
                  >
                    {commercial.feasibleOfferWindow.status}
                  </span>
                </div>
              </div>

              {/* Offer Breakdown */}
              <div className="p-2.5 rounded bg-black/40 border border-white/[0.06] text-xs">
                <div className="flex items-center justify-between text-slate-200">
                  <span>Recommended Build Package:</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    ₹{commercial.recommendedBuildOffer.min.toLocaleString("en-IN")} – ₹{commercial.recommendedBuildOffer.max.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-200 mt-1">
                  <span>Monthly Growth &amp; Care Retainer:</span>
                  <span className="text-indigo-300 font-bold font-mono">
                    ₹{commercial.recommendedMonthlyCare.min.toLocaleString("en-IN")} – ₹{commercial.recommendedMonthlyCare.max.toLocaleString("en-IN")}/mo
                  </span>
                </div>
              </div>

              <p className="text-slate-300 text-[11px] leading-relaxed font-sans italic">
                💡 {commercial.commercialRationale}
              </p>
            </div>
          )}

          {/* 3. WHAT WE FOUND (Technical Audit Checklist) */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 font-mono">
              What We Found (Technical Audit)
            </h3>

            <div className="rounded-lg border border-white/[0.06] overflow-hidden bg-[#0A0D14] divide-y divide-white/[0.04]">
              {/* Row: Website */}
              <div className="p-3 flex items-center justify-between">
                <span className="font-medium text-slate-300 font-sans">Website Presence</span>
                {lead.isGbpDisconnected ? (
                  <span className="text-purple-300 font-medium font-mono flex items-center gap-1">
                    <Unlink className="w-3.5 h-3.5 text-purple-400" /> Disconnected Asset ({displayDomain})
                  </span>
                ) : lead.hasWebsite ? (
                  <span className="text-emerald-400 font-medium font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active Website Linked on Maps
                  </span>
                ) : (
                  <span className="text-amber-400 font-semibold font-mono flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Zero Website on Google Maps
                  </span>
                )}
              </div>

              {/* Row: SSL */}
              <div className="p-3 flex items-center justify-between">
                <span className="font-medium text-slate-300 font-sans">SSL Certificate</span>
                {telemetry ? (
                  telemetry.hasSsl ? (
                    <span className="text-emerald-400 font-mono flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Valid HTTPS
                    </span>
                  ) : (
                    <span className="text-rose-400 font-mono flex items-center gap-1 font-semibold">
                      <ShieldAlert className="w-3.5 h-3.5" /> Insecure HTTP
                    </span>
                  )
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>

              {/* Row: Viewport / Responsive */}
              <div className="p-3 flex items-center justify-between">
                <span className="font-medium text-slate-300 font-sans">Mobile Viewport</span>
                {telemetry ? (
                  telemetry.viewportMetaPresent && !telemetry.hasHorizontalOverflow ? (
                    <span className="text-emerald-400 font-mono flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5" /> Responsive Touch
                    </span>
                  ) : (
                    <span className="text-amber-400 font-mono flex items-center gap-1 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" /> Desktop / Overflow Issue
                    </span>
                  )
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>

              {/* Row: WhatsApp */}
              <div className="p-3 flex items-center justify-between">
                <span className="font-medium text-slate-300 font-sans">Direct WhatsApp Link</span>
                {telemetry ? (
                  telemetry.hasWhatsAppDirectLink ? (
                    <span className="text-emerald-400 font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 1-Tap Trigger Active
                    </span>
                  ) : (
                    <span className="text-slate-400 font-mono flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5 text-slate-500" /> Missing Direct Link
                    </span>
                  )
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>

              {/* Row: Booking Funnel */}
              <div className="p-3 flex items-center justify-between">
                <span className="font-medium text-slate-300 font-sans">24/7 Calendar Intake</span>
                {telemetry ? (
                  telemetry.hasInteractiveBookingForm ? (
                    <span className="text-emerald-400 font-mono flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Online Booking Present
                    </span>
                  ) : (
                    <span className="text-amber-400 font-mono flex items-center gap-1 font-semibold">
                      <XCircle className="w-3.5 h-3.5" /> No Online Scheduling
                    </span>
                  )
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>

              {/* Row: Latency */}
              {telemetry && telemetry.initialLoadLatencyMs > 0 && (
                <div className="p-3 flex items-center justify-between">
                  <span className="font-medium text-slate-300 font-sans">Load Latency</span>
                  <span className="text-slate-300 font-mono font-medium">
                    {telemetry.initialLoadLatencyMs} ms
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 4. RECOMMENDED APPROACH & VALUE */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Recommended Approach &amp; Scope
              </h3>
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Est. Value: {displayEstimatedValue}
              </span>
            </div>

            <p className="text-slate-300 leading-relaxed mb-3 font-sans">
              {pitch?.suggestedScope || "Synchronize Google Business Profile, implement Local Business Schema markup, and connect mobile booking funnel."}
            </p>

            {/* Outreach Script Tabs */}
            <div className="rounded-lg border border-white/[0.08] bg-[#0A0D14] overflow-hidden">
              <div className="p-2 border-b border-white/[0.06] flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab("email")}
                    className={`px-3 py-1 rounded text-xs font-medium font-mono transition cursor-pointer ${
                      activeTab === "email" ? "bg-white/[0.1] text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Cold Email
                  </button>
                  <button
                    onClick={() => setActiveTab("whatsapp")}
                    className={`px-3 py-1 rounded text-xs font-medium font-mono transition cursor-pointer ${
                      activeTab === "whatsapp" ? "bg-white/[0.1] text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    WhatsApp Hook
                  </button>
                  <button
                    onClick={() => setActiveTab("phone")}
                    className={`px-3 py-1 rounded text-xs font-medium font-mono transition cursor-pointer ${
                      activeTab === "phone" ? "bg-white/[0.1] text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Phone Script
                  </button>
                  <button
                    onClick={() => setActiveTab("scope")}
                    className={`px-3 py-1 rounded text-xs font-medium font-mono transition cursor-pointer ${
                      activeTab === "scope" ? "bg-white/[0.1] text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Technical Scope
                  </button>
                </div>

                <button
                  onClick={() => handleCopy(getActiveCopyText(), activeTab)}
                  className="px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-medium transition flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copiedTab === activeTab ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Script</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 bg-black/40">
                <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed select-text">
                  {getActiveCopyText()}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t border-white/[0.08] bg-[#0A0D14] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono">Status:</span>
            <select
              value={lead.humanStatus}
              disabled={isUpdatingStatus}
              onChange={(e) => onStatusChange(lead.id, e.target.value as HumanStatus)}
              className="px-2.5 py-1 rounded bg-slate-900 border border-white/[0.12] text-slate-200 text-xs font-mono focus:outline-none focus:border-indigo-400 cursor-pointer"
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
                href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappCopy)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-medium font-mono transition flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>Open WhatsApp</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
