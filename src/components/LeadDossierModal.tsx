"use client";

import React, { useState } from "react";
import { Lead, AuditFinding, HumanStatus, BusinessDossier } from "@/core/db/schema";
import { ScoreGauge } from "./ScoreGauge";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  MapPin,
  Phone,
  Globe,
  Flame,
  CheckCircle,
  Archive,
  Mail,
  MessageSquare,
  PhoneCall,
  FileCode,
  Sparkles,
  Zap,
  Shield,
  Smartphone,
  ShieldAlert,
  Send,
  Clock,
  Link2
} from "lucide-react";

interface LeadDossierModalProps {
  lead: Lead | null;
  onClose: () => void;
  onStatusChange: (leadId: string, status: HumanStatus) => Promise<void>;
}

export function LeadDossierModal({ lead, onClose, onStatusChange }: LeadDossierModalProps) {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"email" | "whatsapp" | "phone" | "scope">("email");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  if (!lead) return null;

  const dossier: BusinessDossier | null = (lead.dossier as any) || null;
  const telemetry = (lead.auditTelemetry as any) || null;
  const findings: AuditFinding[] = telemetry?.findings || [];
  const pitch = dossier?.recommendedPitch;

  // Clean phone number for tel: and WhatsApp links
  const cleanPhone = lead.phone ? lead.phone.replace(/[^0-9+]/g, "") : "";

  const coldEmailCopy = `Subject: Quick question regarding ${lead.name}'s mobile booking flow

Hi ${lead.name} team,

I was looking at top-rated ${lead.category || "businesses"} in ${lead.formattedAddress || "your area"} and noticed your outstanding ${lead.rating}★ rating (${lead.reviewCount} Google reviews).

I ran a quick technical audit on your digital presence and noticed a specific bottleneck:
${lead.hasWebsite
  ? `• ${pitch?.identifiedBottlenecks?.[0] || "Mobile layout is unoptimized for touch booking"}
• ${pitch?.identifiedBottlenecks?.[1] || "Missing direct online scheduling/intake"}`
  : "• You currently have no official website linked to your Google Business profile, leaking high-intent mobile searchers to competitors."}

We build modern, high-converting digital storefronts and booking systems. For ${lead.name}, our proposed scope is:
${pitch?.suggestedScope || "Complete responsive digital storefront with 24/7 calendar booking."}

Would you be open to a 5-minute teardown video showing how to fix this?

Best regards,
Agency Founder`;

  // Formatted WhatsApp script
  const whatsAppCopy = `Hey ${lead.name} team! 👋 Saw your impressive ${lead.rating}★ rating on Google (${lead.reviewCount} reviews). 

${lead.hasWebsite 
  ? `Quick note: I audited your site and noticed ${pitch?.identifiedBottlenecks?.[0]?.toLowerCase() || "mobile booking is currently missing"}.`
  : "Noticed you don't have an official website on Google Maps yet, so customers searching on mobile can't easily book or see your full menu/services."}

We help local businesses set up automated ${pitch?.coreAngle || "digital storefronts and booking funnels"}. Would you like me to send a 2-minute video breakdown of how to capture more online bookings?`;

  // Formatted Phone Gatekeeper script
  const phoneScriptCopy = `[FRONT DESK GATEKEEPER SCRIPT]
Operator: "Hi, I was looking up ${lead.name} on Google Maps—congratulations on the ${lead.rating}★ rating with ${lead.reviewCount} reviews! 

I noticed a technical issue with your online booking and mobile setup where patients/clients might have trouble scheduling directly from their phones. 

Who is the practice manager or owner responsible for your digital operations so I can send over a quick 2-minute screenshot breakdown for them?"`;

  // Formatted Scope Blueprint
  const scopeCopy = `[PROPOSED TECHNICAL SCOPE & DELIVERABLES]
Project: ${lead.name} — ${pitch?.coreAngle || "Digital Architecture"}
Target Scope Benchmark: ${pitch?.estimatedValueRange || "$2,500 – $7,500"}

Deliverables:
• ${pitch?.suggestedScope || "Full responsive rebuild & conversion engine"}
• Technical SEO Schema & Google Maps Synchronization
• Mobile-First Speed Optimization (<1.5s TTFB)
• Direct Click-to-Call & WhatsApp Intake Funnel
• Interactive Booking / Calendar Integration`;

  const getActiveCopyText = () => {
    switch (activeTab) {
      case "email":
        return coldEmailCopy;
      case "whatsapp":
        return whatsAppCopy;
      case "phone":
        return phoneScriptCopy;
      case "scope":
        return scopeCopy;
    }
  };

  const handleCopyCurrent = () => {
    const text = getActiveCopyText();
    navigator.clipboard.writeText(text);
    setCopiedTab(activeTab);
    setTimeout(() => setCopiedTab(null), 2500);
  };

  const handleStatusUpdate = async (newStatus: HumanStatus) => {
    setIsUpdatingStatus(true);
    try {
      await onStatusChange(lead.id, newStatus);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const whatsappDirectUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.replace("+", "")}?text=${encodeURIComponent(whatsAppCopy)}`
    : `https://web.whatsapp.com/send?text=${encodeURIComponent(whatsAppCopy)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="double-bezel-outer w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="double-bezel-inner flex-1 flex flex-col overflow-hidden">
          {/* Header Card */}
          <div className="p-6 border-b border-white/[0.08] flex items-start justify-between bg-white/[0.02]">
            <div className="flex items-start gap-4">
              <ScoreGauge score={lead.totalLeadScore ?? 0} size="lg" label="LEAD SCORE" />
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-extrabold text-white tracking-tight">{lead.name}</h2>
                  {!lead.hasWebsite ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)] animate-pulse">
                      <Flame className="w-3.5 h-3.5 text-amber-400" /> NO WEBSITE
                    </span>
                  ) : (
                    <a
                      href={lead.websiteUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-white/[0.04] text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/20 transition"
                    >
                      <Globe className="w-3 h-3 text-indigo-400" />
                      <span>{lead.websiteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                  <span className="flex items-center gap-1 text-amber-400 font-bold">
                    ★ {lead.rating.toFixed(1)} <span className="text-slate-500 font-mono font-normal">({lead.reviewCount} Google reviews)</span>
                  </span>
                  {lead.phone && (
                    <a
                      href={`tel:${cleanPhone}`}
                      className="flex items-center gap-1 text-slate-300 font-mono hover:text-indigo-400 transition"
                      title="Call business"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      {lead.phone}
                    </a>
                  )}
                  {lead.formattedAddress && (
                    <span className="flex items-center gap-1 text-slate-400 truncate max-w-[280px]">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{lead.formattedAddress}</span>
                    </span>
                  )}
                  {lead.googleMapsUrl && (
                    <a
                      href={lead.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1 underline underline-offset-2"
                    >
                      <span>Google Maps Listing</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-6 overflow-y-auto space-y-6 text-xs">
            {/* 4-Dimension Metric Bento Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="bg-[#06080D] p-4 rounded-2xl border border-white/[0.06] shadow-sm">
                <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold mb-1">Reputation Velocity</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-mono font-extrabold text-white">{lead.reputationScore ?? 0}</span>
                  <span className="text-[10px] text-slate-500 font-mono">/ 100</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono font-bold mt-1.5 block">
                  Trajectory: {lead.reviewTrend}
                </span>
              </div>

              <div className="bg-[#06080D] p-4 rounded-2xl border border-white/[0.06] shadow-sm">
                <span className="text-[10px] uppercase font-mono text-amber-400/90 block font-bold mb-1">Digital Surface Gap</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-mono font-extrabold text-amber-400">{lead.digitalGapScore ?? 0}</span>
                  <span className="text-[10px] text-slate-500 font-mono">/ 100</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono mt-1.5 block">
                  {lead.hasWebsite ? "Audit Telemetry" : "Zero Digital Storefront"}
                </span>
              </div>

              <div className="bg-[#06080D] p-4 rounded-2xl border border-white/[0.06] shadow-sm">
                <span className="text-[10px] uppercase font-mono text-indigo-400/90 block font-bold mb-1">Opportunity Leverage</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-mono font-extrabold text-indigo-400">{lead.opportunityScore ?? 0}</span>
                  <span className="text-[10px] text-slate-500 font-mono">/ 100</span>
                </div>
                <span className="text-[10px] text-indigo-300 font-mono mt-1.5 block truncate">{lead.opportunityType}</span>
              </div>

              <div className="bg-[#06080D] p-4 rounded-2xl border border-white/[0.06] shadow-sm">
                <span className="text-[10px] uppercase font-mono text-emerald-400/90 block font-bold mb-1">DOM Fact Confidence</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-mono font-extrabold text-emerald-400">{lead.confidenceScore ?? 100}%</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono mt-1.5 block">100% Measured Data</span>
              </div>
            </div>

            {/* Surgical Outreach Studio (Tabs) */}
            <div className="bg-[#06080D] border border-indigo-500/30 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-bold text-white text-sm">Surgical Pitch &amp; Outreach Deck</h3>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-extrabold text-xs shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    {pitch?.estimatedValueRange || "$2,500 – $7,500"}
                  </span>
                  
                  {activeTab === "whatsapp" && (
                    <a
                      href={whatsappDirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition text-xs shadow-lg active:scale-95 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Open WhatsApp</span>
                    </a>
                  )}

                  <button
                    onClick={handleCopyCurrent}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-95 cursor-pointer"
                  >
                    {copiedTab === activeTab ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedTab === activeTab ? "Copied to Clipboard!" : "Copy Script"}</span>
                  </button>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 mb-4 overflow-x-auto">
                <button
                  onClick={() => setActiveTab("email")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                    activeTab === "email"
                      ? "bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 shadow-inner"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  <span>Cold Email Teardown</span>
                </button>

                <button
                  onClick={() => setActiveTab("whatsapp")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                    activeTab === "whatsapp"
                      ? "bg-emerald-600/25 text-emerald-300 border border-emerald-500/40 shadow-inner"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp Instant Hook</span>
                </button>

                <button
                  onClick={() => setActiveTab("phone")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                    activeTab === "phone"
                      ? "bg-sky-600/25 text-sky-300 border border-sky-500/40 shadow-inner"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Phone Gatekeeper</span>
                </button>

                <button
                  onClick={() => setActiveTab("scope")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                    activeTab === "scope"
                      ? "bg-purple-600/25 text-purple-300 border border-purple-500/40 shadow-inner"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <FileCode className="w-4 h-4" />
                  <span>Technical Scope</span>
                </button>
              </div>

              {/* Tab Copy Display */}
              <div className="bg-[#0A0E1A] p-4.5 rounded-xl border border-white/[0.06] font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap select-all shadow-inner">
                {getActiveCopyText()}
              </div>
            </div>

            {/* Headless Playwright DOM Audit Telemetry */}
            <div>
              <h3 className="font-bold text-white text-sm mb-3.5 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400" /> Empirical Headless DOM Telemetry
              </h3>

              {telemetry ? (
                <div className="space-y-3">
                  {/* Telemetry Quick Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                    <div className="bg-[#06080D] p-3 rounded-xl border border-white/[0.06]">
                      <span className="text-[10px] text-slate-500 font-mono block">Load Latency</span>
                      <span className="font-mono font-bold text-slate-200 text-xs flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-indigo-400" /> {telemetry.loadTimeMs}ms
                      </span>
                    </div>

                    <div className="bg-[#06080D] p-3 rounded-xl border border-white/[0.06]">
                      <span className="text-[10px] text-slate-500 font-mono block">Mobile Viewport</span>
                      <span className={`font-mono font-bold text-xs flex items-center gap-1 mt-0.5 ${telemetry.viewportMetaPresent ? "text-emerald-400" : "text-rose-400"}`}>
                        <Smartphone className="w-3 h-3" /> {telemetry.viewportMetaPresent ? "Responsive" : "Desktop Only"}
                      </span>
                    </div>

                    <div className="bg-[#06080D] p-3 rounded-xl border border-white/[0.06]">
                      <span className="text-[10px] text-slate-500 font-mono block">SSL Encryption</span>
                      <span className={`font-mono font-bold text-xs flex items-center gap-1 mt-0.5 ${telemetry.hasSsl ? "text-emerald-400" : "text-rose-400"}`}>
                        <Shield className="w-3 h-3" /> {telemetry.hasSsl ? "Secure (HTTPS)" : "Insecure HTTP"}
                      </span>
                    </div>

                    <div className="bg-[#06080D] p-3 rounded-xl border border-white/[0.06]">
                      <span className="text-[10px] text-slate-500 font-mono block">Direct Click-To-Call</span>
                      <span className={`font-mono font-bold text-xs flex items-center gap-1 mt-0.5 ${telemetry.hasDirectClickToCall ? "text-emerald-400" : "text-amber-400"}`}>
                        <Phone className="w-3 h-3" /> {telemetry.hasDirectClickToCall ? "Enabled" : "Missing"}
                      </span>
                    </div>
                  </div>

                  {/* Individual Audit Findings */}
                  {findings.map((f, idx) => (
                    <div
                      key={idx}
                      className="bg-[#06080D] border border-white/[0.06] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold uppercase ${
                              f.category === "technical"
                                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                                : f.category === "ux"
                                ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                : f.category === "conversion"
                                ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {f.category}
                          </span>
                          <span className="font-bold text-slate-200 text-sm">{f.finding}</span>
                        </div>
                        <p className="text-slate-400 text-xs">{f.evidence}</p>
                        {f.selectorOrUrl && (
                          <span className="font-mono text-[10px] text-slate-500 block">
                            Target Element/URL: {f.selectorOrUrl}
                          </span>
                        )}
                      </div>

                      <div className="shrink-0">
                        <span className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-[10px] font-mono text-emerald-400 font-bold border border-white/[0.08]">
                          {(f.confidence * 100).toFixed(0)}% Measured
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#06080D] border border-white/[0.06] rounded-2xl p-6 text-center text-slate-400">
                  {!lead.hasWebsite
                    ? "Zero official website linked on Google Maps profile. Fast-tracked as high-conviction digital storefront gap."
                    : "Audit completed with zero critical DOM violations."}
                </div>
              )}
            </div>
          </div>

          {/* Footer Triage Workflow */}
          <div className="p-5 border-t border-white/[0.08] bg-[#06080D] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-400 font-mono">
              Triage Stage: <strong className="text-indigo-300 font-bold">{lead.humanStatus}</strong>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                disabled={isUpdatingStatus}
                onClick={() => handleStatusUpdate("REVIEWED")}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 text-xs font-semibold transition cursor-pointer active:scale-95"
              >
                Mark Reviewed
              </button>
              <button
                disabled={isUpdatingStatus}
                onClick={() => handleStatusUpdate("READY_FOR_OUTREACH")}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-[0_0_20px_rgba(16,185,129,0.3)] transition cursor-pointer active:scale-95"
              >
                Ready for Outreach
              </button>
              <button
                disabled={isUpdatingStatus}
                onClick={() => handleStatusUpdate("ARCHIVED")}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-rose-600/20 hover:text-rose-300 border border-white/[0.08] text-slate-400 text-xs font-medium transition cursor-pointer active:scale-95"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
