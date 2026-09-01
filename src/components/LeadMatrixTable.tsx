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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> GROWING 🚀
          </span>
        );
      case "STABLE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" /> STABLE
          </span>
        );
      case "DECLINING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> DECLINING
          </span>
        );
      case "STALE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
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
          <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1">
            <Globe className="w-3 h-3" /> WEBSITE GAP
          </span>
        );
      case "WEBSITE_AUTOMATION":
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
            <Zap className="w-3 h-3" /> WEB + AUTOMATION
          </span>
        );
      case "CUSTOM_OPERATIONAL_SOFTWARE":
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <Lock className="w-3 h-3" /> CUSTOM OPS SOFTWARE
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
    <div className="bg-[#0D131F]/90 border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
      {/* Search & Filter Toolbar */}
      <div className="p-4 border-b border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-3 bg-white/[0.02]">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search business, niche, or address..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#070A0F] border border-white/[0.08] text-slate-100 text-xs focus:outline-none focus:border-indigo-500 transition font-medium"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
          {/* Opportunity Filter */}
          <select
            data-testid="filter-opportunity"
            value={opportunityFilter}
            onChange={(e) => setOpportunityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#070A0F] border border-white/[0.08] text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
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
            className="px-3 py-2 rounded-xl bg-[#070A0F] border border-white/[0.08] text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
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
            className="px-3 py-2 rounded-xl bg-[#070A0F] border border-white/[0.08] text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
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
            className="px-3 py-2 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-xs font-semibold focus:outline-none cursor-pointer"
          >
            <option value="score">Sort: Lead Score (High to Low)</option>
            <option value="reviews">Sort: Review Volume</option>
            <option value="rating">Sort: Star Rating</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      {filteredLeads.length === 0 ? (
        <div className="py-20 text-center text-slate-400">
          <p className="text-sm font-medium">No qualified leads found matching your active filters.</p>
          <p className="text-xs text-slate-500 mt-1">
            Try launching a new scan or clearing your filter selection.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] bg-[#070A0F]/60 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                <th className="py-3.5 px-5 text-center w-20">Score</th>
                <th className="py-3.5 px-5">Target Business &amp; Location</th>
                <th className="py-3.5 px-5">Reputation &amp; Recency</th>
                <th className="py-3.5 px-5">Digital Surface</th>
                <th className="py-3.5 px-5">Opportunity Tier</th>
                <th className="py-3.5 px-5 text-center">Triage Stage</th>
                <th className="py-3.5 px-5 text-right">Dossier</th>
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
                    className={`hover:bg-white/[0.03] transition-colors duration-150 cursor-pointer ${
                      isSelected ? "bg-indigo-950/30 border-l-4 border-l-indigo-500" : ""
                    }`}
                  >
                    {/* Score Gauge */}
                    <td className="py-4 px-5 text-center">
                      <ScoreGauge score={lead.totalLeadScore ?? 0} size="sm" />
                    </td>

                    {/* Business Name & Address */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm hover:text-indigo-300 transition">
                          {lead.name}
                        </span>
                        {isNoWebsite && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                            <Flame className="w-3 h-3 text-amber-400" /> NO WEBSITE
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-slate-400 text-[11px] mt-1">
                        <span className="flex items-center gap-1">
                          <span className="text-amber-400 font-bold">★ {lead.rating.toFixed(1)}</span>
                          <span className="text-slate-500 font-mono">({lead.reviewCount} reviews)</span>
                        </span>
                        {lead.formattedAddress && (
                          <span className="flex items-center gap-1 truncate max-w-[220px] text-slate-500">
                            <MapPin className="w-3 h-3 shrink-0 text-slate-600" />
                            <span className="truncate">{lead.formattedAddress}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Reputation & Momentum */}
                    <td className="py-4 px-5">
                      <div className="flex flex-col gap-1.5">
                        <div>{renderVelocityBadge(lead.reviewTrend)}</div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2.5">
                          <span>30d: <strong className="text-slate-200">{lead.reviewsLast30Days ?? 0}</strong></span>
                          <span className="text-slate-600">|</span>
                          <span>90d: <strong className="text-slate-200">{lead.reviewsLast90Days ?? 0}</strong></span>
                        </div>
                      </div>
                    </td>

                    {/* Digital Surface */}
                    <td className="py-4 px-5">
                      {lead.hasWebsite && lead.websiteUrl ? (
                        <div className="flex items-center gap-1.5 text-slate-300">
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
                        <span className="text-amber-400 font-mono text-[11px] font-semibold flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5" /> High-Priority Digital Storefront
                        </span>
                      )}
                    </td>

                    {/* Opportunity Tier */}
                    <td className="py-4 px-5">
                      {renderOpportunityBadge(lead.opportunityType)}
                    </td>

                    {/* Triage Status */}
                    <td className="py-4 px-5 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-mono font-bold ${
                          lead.humanStatus === "READY_FOR_OUTREACH"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : lead.humanStatus === "REVIEWED"
                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                            : lead.humanStatus === "ARCHIVED"
                            ? "bg-slate-800 text-slate-500"
                            : "bg-slate-800/80 text-slate-300 border border-slate-700"
                        }`}
                      >
                        {lead.humanStatus}
                      </span>
                    </td>

                    {/* Inspect Button */}
                    <td className="py-4 px-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLead(lead);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-indigo-600 hover:text-white text-slate-300 text-xs font-medium transition-all shadow-sm active:scale-95 cursor-pointer"
                      >
                        <span>Inspect</span>
                        <ChevronRight className="w-3 h-3" />
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
  );
}
