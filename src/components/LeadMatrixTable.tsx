"use client";

import React, { useState, useMemo } from "react";
import { Lead, HumanStatus } from "@/core/db/schema";
import { ScoreGauge } from "./ScoreGauge";
import { OpportunityCardGrid } from "./OpportunityCardGrid";
import {
  ExternalLink,
  Search,
  ChevronRight,
  Unlink,
  Smartphone,
  XCircle,
  Sparkles,
  LayoutGrid,
  ListFilter,
  ShieldCheck,
  ShieldAlert,
  ArrowUpDown
} from "lucide-react";

interface LeadMatrixTableProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  selectedLeadId?: string | null;
  onStatusChange?: (leadId: string, status: HumanStatus) => void;
}

export function LeadMatrixTable({
  leads,
  onSelectLead,
  selectedLeadId,
  onStatusChange,
}: LeadMatrixTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [opportunityFilter, setOpportunityFilter] = useState<string>("ALL");
  const [websiteFilter, setWebsiteFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"score" | "reviews" | "rating">("score");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Counts for Segmented Filter Pills
  const counts = useMemo(() => {
    return {
      all: leads.length,
      unlinked: leads.filter((l) => l.isGbpDisconnected).length,
      noWebsite: leads.filter((l) => !l.hasWebsite && !l.isGbpDisconnected).length,
      mobileGap: leads.filter((l) => {
        const t = (l.auditTelemetry as any) || null;
        return l.hasWebsite && t && (!t.viewportMetaPresent || t.hasHorizontalOverflow);
      }).length,
      customOps: leads.filter((l) => l.opportunityType === "CUSTOM_OPERATIONAL_SOFTWARE").length,
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesName = lead.name.toLowerCase().includes(q);
          const matchesAddress = (lead.formattedAddress || "").toLowerCase().includes(q);
          const matchesCategory = (lead.category || "").toLowerCase().includes(q);
          if (!matchesName && !matchesAddress && !matchesCategory) return false;
        }

        if (opportunityFilter === "DISCONNECTED_GBP_WEBSITE" && !lead.isGbpDisconnected) return false;
        if (opportunityFilter === "WEBSITE" && (lead.hasWebsite || lead.isGbpDisconnected)) return false;
        if (opportunityFilter === "MOBILE_GAP") {
          const t = (lead.auditTelemetry as any) || null;
          if (!lead.hasWebsite || !t || (t.viewportMetaPresent && !t.hasHorizontalOverflow)) return false;
        }
        if (opportunityFilter === "CUSTOM_OPERATIONAL_SOFTWARE" && lead.opportunityType !== "CUSTOM_OPERATIONAL_SOFTWARE") return false;

        if (websiteFilter === "NO_WEBSITE" && (lead.hasWebsite || lead.isGbpDisconnected)) return false;
        if (websiteFilter === "UNLINKED_SITE" && !lead.isGbpDisconnected) return false;
        if (websiteFilter === "HAS_WEBSITE" && !lead.hasWebsite) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "reviews") return (b.reviewCount ?? -1) - (a.reviewCount ?? -1);
        if (sortBy === "rating") return (b.rating ?? -1) - (a.rating ?? -1);
        return (b.totalLeadScore ?? 0) - (a.totalLeadScore ?? 0);
      });
  }, [leads, searchQuery, opportunityFilter, websiteFilter, sortBy]);

  const renderOpportunityBadge = (lead: Lead) => {
    if (lead.isGbpDisconnected) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
          <Unlink className="w-3 h-3 text-purple-400" />
          <span>Unlinked GBP Asset</span>
        </span>
      );
    }
    if (!lead.hasWebsite) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <XCircle className="w-3 h-3 text-amber-400" />
          <span>No Website Gap</span>
        </span>
      );
    }
    if (lead.opportunityType === "CUSTOM_OPERATIONAL_SOFTWARE") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          <span>Custom Ops Software</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
        <Smartphone className="w-3 h-3 text-blue-400" />
        <span>Mobile / Booking Gap</span>
      </span>
    );
  };

  return (
    <div className="space-y-3.5">
      {/* Search, Filter Pills & View Switcher Bar */}
      <div className="card-surface p-3.5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Left: Search Input & Segmented Pills */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search opportunity, business..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900/60 backdrop-blur-md border border-white/[0.12] text-slate-100 text-xs focus:outline-none focus:border-indigo-400 transition font-sans"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          {/* Interactive Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => setOpportunityFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                opportunityFilter === "ALL"
                  ? "bg-indigo-600 text-white font-bold shadow-sm"
                  : "bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08]"
              }`}
            >
              <span>All</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px]">{counts.all}</span>
            </button>

            <button
              type="button"
              onClick={() => setOpportunityFilter("DISCONNECTED_GBP_WEBSITE")}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                opportunityFilter === "DISCONNECTED_GBP_WEBSITE"
                  ? "bg-purple-600 text-white font-bold shadow-sm"
                  : "bg-white/[0.04] hover:bg-white/[0.08] text-purple-300 border border-purple-500/30"
              }`}
            >
              <Unlink className="w-3 h-3" />
              <span>Unlinked GBP</span>
              <span className="px-1.5 py-0.2 rounded-full bg-purple-500/20 text-[10px]">{counts.unlinked}</span>
            </button>

            <button
              type="button"
              onClick={() => setOpportunityFilter("WEBSITE")}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                opportunityFilter === "WEBSITE"
                  ? "bg-amber-600 text-white font-bold shadow-sm"
                  : "bg-white/[0.04] hover:bg-white/[0.08] text-amber-300 border border-amber-500/30"
              }`}
            >
              <XCircle className="w-3 h-3" />
              <span>No Website</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-[10px]">{counts.noWebsite}</span>
            </button>

            {counts.mobileGap > 0 && (
              <button
                type="button"
                onClick={() => setOpportunityFilter("MOBILE_GAP")}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  opportunityFilter === "MOBILE_GAP"
                    ? "bg-blue-600 text-white font-bold shadow-sm"
                    : "bg-white/[0.04] hover:bg-white/[0.08] text-blue-300 border border-blue-500/30"
                }`}
              >
                <Smartphone className="w-3 h-3" />
                <span>Mobile Gap</span>
                <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-[10px]">{counts.mobileGap}</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Sort & View Toggle Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Website Filter Select (Retained for Test & Automation Compatibility) */}
          <select
            data-testid="filter-website"
            value={websiteFilter}
            onChange={(e) => setWebsiteFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900/60 backdrop-blur-md border border-white/[0.12] text-slate-200 text-xs focus:outline-none focus:border-indigo-400 cursor-pointer font-mono"
          >
            <option value="ALL">All Web States</option>
            <option value="NO_WEBSITE">No Website</option>
            <option value="UNLINKED_SITE">Unlinked GBP Site</option>
            <option value="HAS_WEBSITE">Connected Website</option>
          </select>

          {/* Sort Select */}
          <select
            data-testid="select-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900/60 backdrop-blur-md border border-white/[0.12] text-slate-200 text-xs focus:outline-none focus:border-indigo-400 cursor-pointer font-mono font-medium"
          >
            <option value="score">Sort: Lead Score</option>
            <option value="reviews">Sort: Review Count</option>
            <option value="rating">Sort: Star Rating</option>
          </select>

          {/* View Switcher (Table Matrix vs Grid Cards) */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900/60 backdrop-blur-md border border-white/[0.12]">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === "table" ? "bg-white/[0.1] text-white" : "text-slate-500 hover:text-slate-300"
              }`}
              title="Table View"
            >
              <ListFilter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewMode === "grid" ? "bg-white/[0.1] text-white" : "text-slate-500 hover:text-slate-300"
              }`}
              title="Opportunity Grid Cards"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main View Content (Table or Grid) */}
      {viewMode === "grid" ? (
        <OpportunityCardGrid
          leads={filteredLeads}
          onSelectLead={onSelectLead}
          selectedLeadId={selectedLeadId}
        />
      ) : (
        <div className="card-surface overflow-hidden">
          {filteredLeads.length === 0 ? (
            <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-white/20 flex items-center justify-center text-indigo-300 mb-2.5 shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-white tracking-tight">No qualified opportunities found for this filter</p>
              <p className="text-xs text-slate-300 mt-1 max-w-md">
                Try adjusting your search filters or launch a discovery scan above to uncover high-intent businesses.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-[#0A0D14] text-slate-400 font-mono text-[11px]">
                    <th className="py-3 px-4 text-center w-16">Score</th>
                    <th className="py-3 px-4">Opportunity Angle</th>
                    <th className="py-3 px-4">Business Entity</th>
                    <th className="py-3 px-4">Reputation &amp; Demand</th>
                    <th className="py-3 px-4">Technical Evidence</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredLeads.map((lead) => {
                    const isSelected = selectedLeadId === lead.id;
                    const telemetry = (lead.auditTelemetry as any) || null;
                    const displayDomain = (lead.unlinkedWebsiteUrl || lead.websiteUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => onSelectLead(lead)}
                        className={`hover:bg-white/[0.03] transition-all duration-200 cursor-pointer ${
                          isSelected ? "bg-indigo-950/30 border-l-2 border-indigo-500" : ""
                        }`}
                      >
                        {/* 1. Quantitative Lead Score */}
                        <td className="py-3.5 px-4 text-center">
                          <ScoreGauge score={lead.totalLeadScore ?? 0} size="sm" />
                        </td>

                        {/* 2. Primary Opportunity Angle */}
                        <td className="py-3.5 px-4">
                          {renderOpportunityBadge(lead)}
                          <span className="text-[11px] text-slate-400 block mt-1 line-clamp-1">
                            {lead.dossier?.recommendedPitch?.coreAngle || "Digital infrastructure upgrade"}
                          </span>
                        </td>

                        {/* 3. Business Entity & Location */}
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-100 text-sm hover:text-indigo-300 transition block">
                            {lead.name}
                          </span>
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-0.5">
                            {lead.category && <span>{lead.category}</span>}
                            {lead.category && lead.formattedAddress && <span className="text-slate-600">·</span>}
                            {lead.formattedAddress && (
                              <span className="truncate max-w-[200px] text-slate-500">
                                {lead.formattedAddress}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Reputation & Longitudinal Demand */}
                        <td className="py-3.5 px-4 font-mono">
                          {typeof lead.rating === "number" && lead.rating !== null && typeof lead.reviewCount === "number" && lead.reviewCount !== null ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="text-amber-400 font-bold">★ {lead.rating.toFixed(1)}</span>
                                <span className="text-slate-400 text-xs">({lead.reviewCount} reviews)</span>
                              </div>
                              {(lead.reviewCountDelta ?? 0) > 0 ? (
                                <span className="text-[10px] text-emerald-400 font-medium block mt-0.5">
                                  +{lead.reviewCountDelta} gained
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500 block mt-0.5">
                                  Velocity: {lead.reviewTrend}
                                </span>
                              )}
                            </>
                          ) : (
                            <div className="text-[11px] font-mono">
                              <span className="px-2 py-0.5 rounded bg-slate-800/70 border border-white/[0.08] text-slate-400 text-[10px]">
                                Unverified Google
                              </span>
                              <span className="text-[10px] text-slate-500 block mt-1">Direct Web Audit</span>
                            </div>
                          )}
                        </td>

                        {/* 5. Technical Evidence */}
                        <td className="py-3.5 px-4 font-mono">
                          {lead.isGbpDisconnected && lead.unlinkedWebsiteUrl ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-purple-300">
                                <a
                                  href={lead.unlinkedWebsiteUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="hover:text-purple-200 underline underline-offset-2 truncate max-w-[140px] text-xs font-mono"
                                >
                                  {displayDomain}
                                </a>
                                <ExternalLink className="w-3 h-3 text-purple-400" />
                              </div>
                              <span className="text-[10px] text-purple-400 block font-sans">
                                ⚠ Disconnected from Maps
                              </span>
                            </div>
                          ) : lead.hasWebsite && lead.websiteUrl ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-slate-300">
                                <a
                                  href={lead.websiteUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="hover:text-indigo-400 underline underline-offset-2 truncate max-w-[140px] text-xs font-mono"
                                >
                                  {displayDomain}
                                </a>
                                <ExternalLink className="w-3 h-3 text-slate-500" />
                              </div>

                              {/* Quick Audit Badges */}
                              {telemetry && (
                                <div className="flex flex-wrap gap-1 text-[10px]">
                                  {!telemetry.viewportMetaPresent && (
                                    <span className="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                      Desktop Only
                                    </span>
                                  )}
                                  {!telemetry.hasSsl && (
                                    <span className="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                      No SSL
                                    </span>
                                  )}
                                  {telemetry.hasWhatsAppDirectLink && (
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                      WhatsApp
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-amber-400 text-xs font-medium font-sans">
                              ✕ No Website
                            </span>
                          )}
                        </td>

                        {/* 6. Triage Stage */}
                        <td className="py-3.5 px-4 font-mono">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold ${
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
                        </td>

                        {/* 7. Action CTA */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectLead(lead);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.04] hover:bg-indigo-600 hover:text-white border border-white/[0.08] text-slate-300 text-xs font-medium transition cursor-pointer active:scale-[0.98]"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
