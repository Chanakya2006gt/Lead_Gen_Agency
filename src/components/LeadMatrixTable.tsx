"use client";

import React, { useState, useMemo } from "react";
import { Lead, OpportunityType, ReviewTrend, HumanStatus } from "@/core/db/schema";
import { ScoreGauge } from "./ScoreGauge";
import {
  ExternalLink,
  Flame,
  Globe,
  Phone,
  MapPin,
  TrendingUp,
  Clock,
  ChevronRight,
  Filter,
  Search,
  CheckCircle2,
  Lock,
  Zap,
  Sparkles,
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
  const [velocityFilter, setVelocityFilter] = useState<string>("ALL");
  const [websiteFilter, setWebsiteFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"score" | "reviews" | "rating">("score");

  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesName = lead.name.toLowerCase().includes(q);
          const matchesAddress = (lead.formattedAddress || "").toLowerCase().includes(q);
          if (!matchesName && !matchesAddress) return false;
        }

        if (opportunityFilter !== "ALL" && lead.opportunityType !== opportunityFilter) {
          return false;
        }

        if (velocityFilter !== "ALL" && lead.reviewTrend !== velocityFilter) {
          return false;
        }

        if (websiteFilter === "NO_WEBSITE" && lead.hasWebsite) return false;
        if (websiteFilter === "HAS_WEBSITE" && !lead.hasWebsite) return false;

        if (statusFilter !== "ALL" && lead.humanStatus !== statusFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "reviews") return b.reviewCount - a.reviewCount;
        if (sortBy === "rating") return b.rating - a.rating;
        return (b.totalLeadScore ?? 0) - (a.totalLeadScore ?? 0);
      });
  }, [leads, searchQuery, opportunityFilter, velocityFilter, websiteFilter, statusFilter, sortBy]);

  const renderVelocityBadge = (trend: string) => {
    switch (trend) {
      case "GROWING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> GROWING 🚀
          </span>
        );
      case "STABLE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" /> STABLE
          </span>
        );
      case "DECLINING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> DECLINING
          </span>
        );
      case "STALE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> STALE ⚠️
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700">
            UNKNOWN
          </span>
        );
    }
  };

  const renderOpportunityBadge = (type: string) => {
    switch (type) {
      case "WEBSITE":
        return (
          <span className="px-3 py-1 rounded-lg text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1.5 shadow-sm">
            <Globe className="w-3.5 h-3.5" /> WEBSITE GAP
          </span>
        );
      case "WEBSITE_AUTOMATION":
        return (
          <span className="px-3 py-1 rounded-lg text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 shadow-sm">
            <Zap className="w-3.5 h-3.5" /> WEB + AUTOMATION
          </span>
        );
      case "CUSTOM_OPERATIONAL_SOFTWARE":
        return (
          <span className="px-3 py-1 rounded-lg text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
            <Lock className="w-3.5 h-3.5" /> CUSTOM OPS SOFTWARE
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-800">
            PENDING AUDIT
          </span>
        );
    }
  };

  return (
    <div className="double-bezel-outer">
      <div className="double-bezel-inner overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-3 bg-white/[0.01]">
          {/* Search Bar */}
          <div className="relative w-full md:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter leads, niche, or address..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#06080D] border border-white/[0.08] text-slate-100 text-xs focus:outline-none focus:border-indigo-500 transition font-medium shadow-inner"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
            {/* Opportunity Filter */}
            <select
              data-testid="filter-opportunity"
              value={opportunityFilter}
              onChange={(e) => setOpportunityFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#06080D] border border-white/[0.08] text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
            >
              <option value="ALL">All Opportunities</option>
              <option value="WEBSITE">Website Gap</option>
              <option value="WEBSITE_AUTOMATION">Web + Automation</option>
              <option value="CUSTOM_OPERATIONAL_SOFTWARE">Custom Ops Software</option>
            </select>

            {/* Velocity Filter */}
            <select
              data-testid="filter-velocity"
              value={velocityFilter}
              onChange={(e) => setVelocityFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#06080D] border border-white/[0.08] text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
            >
              <option value="ALL">All Velocity</option>
              <option value="GROWING">Growing 🚀</option>
              <option value="STABLE">Stable</option>
              <option value="STALE">Stale ⚠️</option>
            </select>

            {/* Website Filter */}
            <select
              data-testid="filter-website"
              value={websiteFilter}
              onChange={(e) => setWebsiteFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#06080D] border border-white/[0.08] text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
            >
              <option value="ALL">All Websites</option>
              <option value="NO_WEBSITE">No Website 🔥</option>
              <option value="HAS_WEBSITE">Has Website</option>
            </select>

            {/* Sort By */}
            <select
              data-testid="select-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3.5 py-2 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-indigo-300 text-xs font-bold focus:outline-none cursor-pointer shadow-sm"
            >
              <option value="score">Sort: Lead Score (High to Low)</option>
              <option value="reviews">Sort: Review Volume</option>
              <option value="rating">Sort: Star Rating</option>
            </select>
          </div>
        </div>

        {/* Leads Master Matrix */}
        {filteredLeads.length === 0 ? (
          <div className="py-24 text-center text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mx-auto mb-3 text-slate-500">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-300">No qualified leads found matching active criteria.</p>
            <p className="text-xs text-slate-500 mt-1">
              Launch a new market discovery scan or adjust your active filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] bg-[#06080D]/70 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-4 px-6 text-center w-24">Lead Score</th>
                  <th className="py-4 px-6">Target Operating Business</th>
                  <th className="py-4 px-6">Reputation &amp; Recency</th>
                  <th className="py-4 px-6">Digital Surface</th>
                  <th className="py-4 px-6">Opportunity Tier</th>
                  <th className="py-4 px-6 text-center">Triage Stage</th>
                  <th className="py-4 px-6 text-right">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredLeads.map((lead) => {
                  const isSelected = selectedLeadId === lead.id;
                  const isNoWebsite = !lead.hasWebsite;

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => onSelectLead(lead)}
                      className={`hover:bg-white/[0.03] transition-all duration-200 cursor-pointer ${
                        isSelected ? "bg-indigo-950/30 border-l-4 border-l-indigo-500" : ""
                      }`}
                    >
                      {/* Radial Score Gauge */}
                      <td className="py-4 px-6 text-center">
                        <ScoreGauge score={lead.totalLeadScore ?? 0} size="sm" />
                      </td>

                      {/* Business Name & Address */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-slate-100 text-sm hover:text-indigo-300 transition">
                            {lead.name}
                          </span>
                          {isNoWebsite && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] animate-pulse">
                              <Flame className="w-3 h-3 text-amber-400" /> NO WEBSITE
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3.5 text-slate-400 text-[11px] mt-1.5">
                          <span className="flex items-center gap-1">
                            <span className="text-amber-400 font-bold">★ {lead.rating.toFixed(1)}</span>
                            <span className="text-slate-500 font-mono">({lead.reviewCount} reviews)</span>
                          </span>
                          {lead.formattedAddress && (
                            <span className="flex items-center gap-1 truncate max-w-[220px] text-slate-500">
                              <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-600" />
                              <span className="truncate">{lead.formattedAddress}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Reputation & Momentum */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1.5">
                          <div>{renderVelocityBadge(lead.reviewTrend)}</div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                            <span>30d: <strong className="text-slate-200">{lead.reviewsLast30Days !== null ? lead.reviewsLast30Days : "—"}</strong></span>
                            <span className="text-slate-600">|</span>
                            <span>90d: <strong className="text-slate-200">{lead.reviewsLast90Days !== null ? lead.reviewsLast90Days : "—"}</strong></span>
                          </div>
                        </div>
                      </td>

                      {/* Digital Surface */}
                      <td className="py-4 px-6">
                        {lead.hasWebsite && lead.websiteUrl ? (
                          <div className="flex items-center gap-2 text-slate-300">
                            <Globe className="w-3.5 h-3.5 text-slate-500" />
                            <a
                              href={lead.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-indigo-400 underline underline-offset-2 truncate max-w-[160px] text-xs font-mono"
                            >
                              {lead.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                            </a>
                            <ExternalLink className="w-3 h-3 text-slate-500 hover:text-slate-300" />
                          </div>
                        ) : (
                          <span className="text-amber-400 font-mono text-[11px] font-bold flex items-center gap-1.5">
                            <Flame className="w-3.5 h-3.5 text-amber-400" /> High-Ticket Gap
                          </span>
                        )}
                      </td>

                      {/* Opportunity Tier */}
                      <td className="py-4 px-6">
                        {renderOpportunityBadge(lead.opportunityType)}
                      </td>

                      {/* Triage Status */}
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-lg text-[10px] font-mono font-bold ${
                            lead.humanStatus === "READY_FOR_OUTREACH"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                              : lead.humanStatus === "REVIEWED"
                              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                              : lead.humanStatus === "ARCHIVED"
                              ? "bg-slate-800 text-slate-500"
                              : "bg-[#06080D] text-slate-300 border border-white/[0.08]"
                          }`}
                        >
                          {lead.humanStatus}
                        </span>
                      </td>

                      {/* Button-in-Button Inspect CTA */}
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectLead(lead);
                          }}
                          className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-indigo-600 hover:text-white border border-white/[0.08] hover:border-indigo-500 text-slate-300 text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
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
    </div>
  );
}
