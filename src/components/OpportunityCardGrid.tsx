"use client";

import React from "react";
import { Lead } from "@/core/db/schema";
import { ScoreGauge } from "./ScoreGauge";
import { OpportunityBadge } from "./OpportunityBadge";
import {
  ExternalLink,
  ChevronRight,
  Phone,
  MessageCircle,
  Star,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Sparkles,
  Unlink
} from "lucide-react";

interface OpportunityCardGridProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  selectedLeadId?: string | null;
}

export function OpportunityCardGrid({
  leads,
  onSelectLead,
  selectedLeadId,
}: OpportunityCardGridProps) {
  if (leads.length === 0) {
    return (
      <div className="py-12 px-6 text-center flex flex-col items-center justify-center card-surface">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-white/20 flex items-center justify-center text-indigo-300 mb-2.5 shadow-md">
          <Sparkles className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-white tracking-tight">No qualified opportunities found for this filter</p>
        <p className="text-xs text-slate-300 mt-1 max-w-md">
          Try adjusting your search filters or launch a discovery scan above to uncover high-intent businesses.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {leads.map((lead) => {
        const isSelected = selectedLeadId === lead.id;
        const telemetry = (lead.auditTelemetry as any) || null;
        const displayDomain = (lead.unlinkedWebsiteUrl || lead.websiteUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

        return (
          <div
            key={lead.id}
            tabIndex={0}
            role="button"
            aria-label={`Inspect ${lead.name}`}
            onClick={() => onSelectLead(lead)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectLead(lead);
              }
            }}
            className={`card-surface p-5 hover:-translate-y-1.5 hover:shadow-2xl hover:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all duration-300 flex flex-col justify-between cursor-pointer group relative ${
              isSelected ? "border-indigo-500 bg-[#0F1422]" : ""
            }`}
          >
            <div>
              {/* Card Top: Score + Opportunity Badge */}
              <div className="flex items-start justify-between gap-3 mb-3.5">
                <OpportunityBadge lead={lead} />
                <ScoreGauge score={lead.totalLeadScore ?? 0} size="sm" />
              </div>

              {/* Business Name & Niche */}
              <h3 className="font-bold text-slate-100 text-sm group-hover:text-indigo-300 transition line-clamp-1">
                {lead.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                {lead.category || "Business"} · {lead.formattedAddress || "Local"}
              </p>

              {/* Reputation Strip */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06] text-xs font-mono">
                {typeof lead.rating === "number" && lead.rating !== null && typeof lead.reviewCount === "number" && lead.reviewCount !== null ? (
                  <>
                    <span className="text-amber-400 font-bold flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-400" /> {lead.rating.toFixed(1)}
                    </span>
                    <span className="text-slate-400">({lead.reviewCount} reviews)</span>
                    {(lead.reviewCountDelta ?? 0) > 0 && (
                      <span className="text-[10px] text-emerald-400 font-semibold ml-auto">
                        +{lead.reviewCountDelta} gained
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-slate-800/60 border border-white/[0.08]">
                    Direct URL Audit (Unverified Google)
                  </span>
                )}
              </div>

              {/* Technical Presence / Audit Checklist Pills */}
              <div className="mt-3 space-y-1.5 text-xs">
                {lead.isGbpDisconnected && lead.unlinkedWebsiteUrl ? (
                  <div className="flex items-center gap-1.5 text-purple-300 font-mono text-[11px] truncate">
                    <Unlink className="w-3 h-3 shrink-0" />
                    <span className="truncate">{displayDomain}</span>
                    <span className="text-[10px] text-purple-400/80">(Unlinked)</span>
                  </div>
                ) : lead.hasWebsite && lead.websiteUrl ? (
                  <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px] truncate">
                    <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="truncate">{displayDomain}</span>
                  </div>
                ) : (
                  <div className="text-amber-400 text-xs font-medium">
                    ✕ Zero Website Online
                  </div>
                )}

                {/* Micro-Audit Badges */}
                {telemetry && (
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-mono pt-1">
                    {telemetry.hasSsl ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                        <ShieldCheck className="w-2.5 h-2.5" /> HTTPS
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 flex items-center gap-1">
                        <ShieldAlert className="w-2.5 h-2.5" /> No SSL
                      </span>
                    )}

                    {telemetry.viewportMetaPresent ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        Mobile Ready
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        Desktop Only
                      </span>
                    )}

                    {telemetry.hasWhatsAppDirectLink && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        WhatsApp
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Card Bottom: Triage Stage & CTA Button */}
            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                  lead.humanStatus === "READY_FOR_OUTREACH"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : lead.humanStatus === "REVIEWED"
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : lead.humanStatus === "ARCHIVED"
                    ? "bg-slate-800 text-slate-500"
                    : "bg-white/[0.04] text-slate-300 border border-white/[0.08]"
                }`}
              >
                {lead.humanStatus}
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLead(lead);
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.04] group-hover:bg-indigo-600 group-hover:text-white border border-white/[0.08] text-slate-300 text-xs font-medium transition cursor-pointer active:scale-[0.98]"
              >
                <span>Inspect Dossier</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
