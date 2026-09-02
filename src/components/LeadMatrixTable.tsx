"use client";

import React, { useState, useMemo } from "react";
import { Lead, HumanStatus } from "@/core/db/schema";
import { ScoreGauge } from "./ScoreGauge";
import {
  ExternalLink,
  Globe,
  MapPin,
  Search,
  ChevronRight,
  ShieldAlert,
  Smartphone,
  MessageCircle,
  PhoneCall,
  Unlink
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

        if (websiteFilter === "NO_WEBSITE" && (lead.hasWebsite || lead.isGbpDisconnected)) return false;
        if (websiteFilter === "UNLINKED_SITE" && !lead.isGbpDisconnected) return false;
        if (websiteFilter === "HAS_WEBSITE" && !lead.hasWebsite) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "reviews") return b.reviewCount - a.reviewCount;
        if (sortBy === "rating") return b.rating - a.rating;
        return (b.totalLeadScore ?? 0) - (a.totalLeadScore ?? 0);
      });
  }, [leads, searchQuery, opportunityFilter, websiteFilter, sortBy]);

  const getOpportunityLabel = (type: string) => {
    switch (type) {
      case "DISCONNECTED_GBP_WEBSITE":
        return "Unlinked GBP Site";
      case "WEBSITE":
        return "Website Gap";
      case "WEBSITE_AUTOMATION":
        return "Website + Booking";
      case "CUSTOM_OPERATIONAL_SOFTWARE":
        return "Custom Ops Software";
      default:
        return "Qualified Gap";
    }
  };

  return (
    <div className="card-surface overflow-hidden">
      {/* Search & Filter Toolbar */}
      <div className="p-3.5 border-b border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-3 bg-[#0A0C11]">
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search business, location, or niche..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#07090E] border border-white/[0.08] text-slate-100 text-xs focus:outline-none focus:border-indigo-500 transition"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
          <select
            data-testid="filter-opportunity"
            value={opportunityFilter}
            onChange={(e) => setOpportunityFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-[#07090E] border border-white/[0.08] text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Opportunities</option>
            <option value="DISCONNECTED_GBP_WEBSITE">Unlinked GBP Site</option>
            <option value="WEBSITE">Website Gap</option>
            <option value="WEBSITE_AUTOMATION">Website + Booking</option>
            <option value="CUSTOM_OPERATIONAL_SOFTWARE">Custom Ops Software</option>
          </select>

          <select
            data-testid="filter-website"
            value={websiteFilter}
            onChange={(e) => setWebsiteFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-[#07090E] border border-white/[0.08] text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Websites</option>
            <option value="NO_WEBSITE">No Website (High Priority)</option>
            <option value="UNLINKED_SITE">Unlinked GBP Site</option>
            <option value="HAS_WEBSITE">Connected Website</option>
          </select>

          <select
            data-testid="select-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg bg-[#07090E] border border-white/[0.08] text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
          >
            <option value="score">Sort: Lead Score</option>
            <option value="reviews">Sort: Review Count</option>
            <option value="rating">Sort: Star Rating</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      {filteredLeads.length === 0 ? (
        <div className="py-20 text-center text-slate-400">
          <p className="text-sm font-medium text-slate-300">No qualified leads found for this view.</p>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your search query or run a discovery scan above.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] bg-[#0A0C11] text-slate-400 font-medium text-[11px]">
                <th className="py-3 px-4 text-center w-16">Score</th>
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-4">Reputation</th>
                <th className="py-3 px-4">Digital Presence</th>
                <th className="py-3 px-4">Opportunity</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredLeads.map((lead) => {
                const isSelected = selectedLeadId === lead.id;
                const isNoWebsite = !lead.hasWebsite && !lead.isGbpDisconnected;
                const isUnlinkedSite = lead.isGbpDisconnected;
                const telemetry = (lead.auditTelemetry as any) || null;

                return (
                  <tr
                    key={lead.id}
                    onClick={() => onSelectLead(lead)}
                    className={`hover:bg-white/[0.02] transition-colors cursor-pointer ${
                      isSelected ? "bg-indigo-950/20" : ""
                    }`}
                  >
                    {/* Score */}
                    <td className="py-3.5 px-4 text-center">
                      <ScoreGauge score={lead.totalLeadScore ?? 0} size="sm" />
                    </td>

                    {/* Business */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100 text-sm hover:text-indigo-300 transition">
                          {lead.name}
                        </span>
                        {isUnlinkedSite ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                            <Unlink className="w-2.5 h-2.5" /> Unlinked Site
                          </span>
                        ) : isNoWebsite ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            No Website
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 text-slate-400 text-xs mt-1">
                        {lead.category && <span>{lead.category}</span>}
                        {lead.category && lead.formattedAddress && <span className="text-slate-600">·</span>}
                        {lead.formattedAddress && (
                          <span className="truncate max-w-[240px] text-slate-500">
                            {lead.formattedAddress}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Reputation */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className="text-amber-400 font-bold">★ {lead.rating.toFixed(1)}</span>
                        <span className="text-slate-400 text-xs">({lead.reviewCount} reviews)</span>
                      </div>
                      {(lead.reviewCountDelta ?? 0) > 0 && (
                        <span className="text-[10px] text-emerald-400 font-medium block mt-0.5">
                          +{lead.reviewCountDelta} reviews gained
                        </span>
                      )}
                    </td>

                    {/* Digital Presence */}
                    <td className="py-3.5 px-4">
                      {lead.isGbpDisconnected && lead.unlinkedWebsiteUrl ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-purple-300">
                            <a
                              href={lead.unlinkedWebsiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-purple-200 underline underline-offset-2 truncate max-w-[160px] text-xs font-mono"
                              title="Unlinked site discovered via secondary entity proof"
                            >
                              {lead.unlinkedWebsiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                            </a>
                            <ExternalLink className="w-3 h-3 text-purple-400" />
                          </div>
                          <span className="text-[10px] text-purple-400/80 font-medium block">
                            ⚠ Missing on Google Maps
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
                              className="hover:text-indigo-400 underline underline-offset-2 truncate max-w-[160px] text-xs font-mono"
                            >
                              {lead.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                            </a>
                            <ExternalLink className="w-3 h-3 text-slate-500" />
                          </div>

                          {/* Quick Badges */}
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
                        <span className="text-amber-400 text-xs font-medium">
                          ✕ Zero Website
                        </span>
                      )}
                    </td>

                    {/* Opportunity */}
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-medium text-slate-300">
                        {getOpportunityLabel(lead.opportunityType)}
                      </span>
                    </td>

                    {/* Triage Status */}
                    <td className="py-3.5 px-4">
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

                    {/* Action CTA */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLead(lead);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.04] hover:bg-indigo-600 hover:text-white border border-white/[0.08] text-slate-300 text-xs font-medium transition cursor-pointer"
                      >
                        <span>View</span>
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
  );
}
