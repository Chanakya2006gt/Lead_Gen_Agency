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
  Mail,
  MessageSquare,
  PhoneCall,
  FileCode,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle
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

  const founderName = process.env.NEXT_PUBLIC_AGENCY_FOUNDER_NAME || "Chanakya";
  const agencyName = process.env.NEXT_PUBLIC_AGENCY_NAME || "Agency Operations";

  const cleanPhone = lead.phone ? lead.phone.replace(/[^0-9+]/g, "") : "";

  // Dynamic Synthesis for "WHY THIS LEAD"
  const whyPoints: string[] = [];
  if (!lead.hasWebsite) {
    whyPoints.push("Zero official website linked on Google Maps—leaking high-intent mobile searchers to competitors.");
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
  if (lead.reviewTrend === "GROWING" || (lead.reviewCountDelta ?? 0) > 0) {
    whyPoints.push(`Active customer momentum (+${lead.reviewCountDelta ?? 0} reviews recently)—business is actively growing.`);
  }

  // Cold Email Copy
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
${founderName}
${agencyName}`;

  // WhatsApp Hook
  const whatsAppCopy = `Hey ${lead.name} team! 👋 Saw your impressive ${lead.rating}★ rating on Google (${lead.reviewCount} reviews). 

${lead.hasWebsite 
  ? `Quick note: I audited your site and noticed ${pitch?.identifiedBottlenecks?.[0]?.toLowerCase() || "mobile booking is currently missing"}.`
  : "Noticed you don't have an official website on Google Maps yet, so customers searching on mobile can't easily book or see your full menu/services."}

We help local businesses set up automated ${pitch?.coreAngle || "digital storefronts and booking funnels"}. Would you like me to send a 2-minute video breakdown of how to capture more online bookings?

— ${founderName} (${agencyName})`;

  // Phone Gatekeeper Script
  const phoneScriptCopy = `[FRONT DESK GATEKEEPER SCRIPT]
Operator: "Hi, I was looking up ${lead.name} on Google Maps—congratulations on the ${lead.rating}★ rating with ${lead.reviewCount} reviews! 

I noticed a technical issue with your online booking and mobile setup where patients/clients might have trouble scheduling directly from their phones. 

Who is the practice manager or owner responsible for your digital operations so I can send over a quick 2-minute screenshot breakdown for them?"`;

  // Technical Scope
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
    setTimeout(() => setCopiedTab(null), 2000);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="card-surface w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-white/[0.1]">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-start justify-between bg-[#0B0D13]">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold text-white tracking-tight">{lead.name}</h2>
              {!lead.hasWebsite ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  No Website
                </span>
              ) : (
                <a
                  href={lead.websiteUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-indigo-300 hover:text-indigo-200 border border-white/[0.08] bg-white/[0.03]"
                >
                  <Globe className="w-3 h-3" />
                  <span>{lead.websiteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2">
              <span className="text-amber-400 font-semibold">
                ★ {lead.rating.toFixed(1)} <span className="text-slate-400 font-normal">({lead.reviewCount} Google reviews)</span>
              </span>
              {lead.phone && (
                <span className="flex items-center gap-1 text-slate-300">
                  <Phone className="w-3 h-3 text-slate-500" />
                  {lead.phone}
                </span>
              )}
              {lead.formattedAddress && (
                <span className="flex items-center gap-1 text-slate-400 truncate max-w-[260px]">
                  <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">{lead.formattedAddress}</span>
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs bg-[#0F1219]">
          {/* 1. WHY THIS LEAD */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Why This Lead
            </h3>
            <div className="p-3.5 rounded-lg bg-[#0A0C11] border border-white/[0.06] space-y-2 text-slate-300 leading-relaxed">
              {whyPoints.map((pt, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-indigo-400 font-bold mt-0.5">•</span>
                  <span>{pt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. WHAT WE FOUND (Audit Checklist) */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              What We Found
            </h3>

            <div className="rounded-lg border border-white/[0.06] overflow-hidden bg-[#0A0C11] divide-y divide-white/[0.04]">
              {/* Row: Website */}
              <div className="p-3 flex items-center justify-between">
                <span className="font-medium text-slate-300">Website Presence</span>
                {lead.hasWebsite ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active Website Linked
                  </span>
                ) : (
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Zero Website on Google Maps
                  </span>
                )}
              </div>

              {/* Row: Mobile UX */}
              <div className="p-3 flex items-center justify-between">
                <span className="font-medium text-slate-300">Mobile Experience</span>
                {telemetry ? (
                  telemetry.viewportMetaPresent ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Responsive Viewport
                    </span>
                  ) : (
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Desktop Only (Needs Mobile Rebuild)
                    </span>
                  )
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>

              {/* Row: SSL */}
              <div className="p-3 flex items-center justify-between">
                <span className="font-medium text-slate-300">SSL Security</span>
                {telemetry ? (
                  telemetry.hasSsl ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Secure (HTTPS)
                    </span>
                  ) : (
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Insecure HTTP
                    </span>
                  )
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>

              {/* Row: Online Booking */}
              <div className="p-3 flex items-center justify-between">
                <span className="font-medium text-slate-300">Online Intake / Booking</span>
                {telemetry ? (
                  telemetry.hasInteractiveBookingForm ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Present
                    </span>
                  ) : (
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Missing
                    </span>
                  )
                ) : (
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Missing
                  </span>
                )}
              </div>

              {/* Row: Direct CTA */}
              <div className="p-3 flex items-center justify-between">
                <span className="font-medium text-slate-300">1-Tap Phone / WhatsApp CTA</span>
                {telemetry ? (
                  telemetry.hasDirectClickToCall || telemetry.hasWhatsAppDirectLink ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Enabled
                    </span>
                  ) : (
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Missing Direct Link
                    </span>
                  )
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>

              {/* Row: Latency */}
              {telemetry && telemetry.initialLoadLatencyMs > 0 && (
                <div className="p-3 flex items-center justify-between">
                  <span className="font-medium text-slate-300">Load Latency</span>
                  <span className="text-slate-300 font-mono font-medium">
                    {telemetry.initialLoadLatencyMs} ms
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 3. RECOMMENDED APPROACH & VALUE */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Recommended Approach &amp; Scope
              </h3>
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Est. Value: {pitch?.estimatedValueRange || "$2,500 – $7,500"}
              </span>
            </div>

            <p className="text-slate-300 leading-relaxed mb-3">
              {pitch?.suggestedScope || "Build a responsive digital storefront with 24/7 calendar booking and direct WhatsApp customer intake."}
            </p>

            {/* Outreach Script Tabs */}
            <div className="rounded-lg border border-white/[0.08] bg-[#0A0C11] overflow-hidden">
              <div className="p-2 border-b border-white/[0.06] flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab("email")}
                    className={`px-3 py-1 rounded text-xs font-medium transition cursor-pointer ${
                      activeTab === "email" ? "bg-white/[0.1] text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Cold Email
                  </button>
                  <button
                    onClick={() => setActiveTab("whatsapp")}
                    className={`px-3 py-1 rounded text-xs font-medium transition cursor-pointer ${
                      activeTab === "whatsapp" ? "bg-white/[0.1] text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    WhatsApp Hook
                  </button>
                  <button
                    onClick={() => setActiveTab("phone")}
                    className={`px-3 py-1 rounded text-xs font-medium transition cursor-pointer ${
                      activeTab === "phone" ? "bg-white/[0.1] text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Phone Script
                  </button>
                  <button
                    onClick={() => setActiveTab("scope")}
                    className={`px-3 py-1 rounded text-xs font-medium transition cursor-pointer ${
                      activeTab === "scope" ? "bg-white/[0.1] text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Technical Scope
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {activeTab === "whatsapp" && (
                    <a
                      href={whatsappDirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition cursor-pointer flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      <span>Open WhatsApp</span>
                    </a>
                  )}

                  <button
                    onClick={handleCopyCurrent}
                    className="px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 font-medium text-xs transition cursor-pointer flex items-center gap-1"
                  >
                    {copiedTab === activeTab ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedTab === activeTab ? "Copied" : "Copy Script"}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-all bg-[#07090E]">
                {getActiveCopyText()}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Triage Workflow */}
        <div className="p-4 border-t border-white/[0.08] bg-[#0B0D13] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Triage Status: <strong className="text-slate-200 font-semibold">{lead.humanStatus}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={isUpdatingStatus}
              onClick={() => handleStatusUpdate("REVIEWED")}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              Mark Reviewed
            </button>
            <button
              disabled={isUpdatingStatus}
              onClick={() => handleStatusUpdate("READY_FOR_OUTREACH")}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
            >
              Ready for Outreach
            </button>
            <button
              disabled={isUpdatingStatus}
              onClick={() => handleStatusUpdate("ARCHIVED")}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-rose-600/20 hover:text-rose-300 text-slate-400 text-xs font-medium transition cursor-pointer"
            >
              Archive
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
