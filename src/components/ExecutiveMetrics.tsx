"use client";

import React from "react";
import { Lead } from "@/core/db/schema";
import { TrendingUp, Unlink, Globe, IndianRupee, Star, Activity } from "lucide-react";

interface ExecutiveMetricsProps {
  leads: Lead[];
}

export function ExecutiveMetrics({ leads }: ExecutiveMetricsProps) {
  const totalQualified = leads.length;
  const unlinkedGbpCount = leads.filter((l) => l.isGbpDisconnected).length;
  const noWebsiteCount = leads.filter((l) => !l.hasWebsite && !l.isGbpDisconnected).length;

  const verifiedLeads = leads.filter((l) => typeof l.rating === "number" && l.rating !== null);
  const avgRating = verifiedLeads.length > 0
    ? (verifiedLeads.reduce((sum, l) => sum + (l.rating || 0), 0) / verifiedLeads.length).toFixed(1)
    : "—";

  const totalReviews = verifiedLeads.reduce((sum, l) => sum + (l.reviewCount || 0), 0);

  const highConvictionCount = leads.filter(
    (l) => (l.opportunityScore ?? 0) >= 70 || (l.totalLeadScore ?? 0) >= 70
  ).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
      {/* 1. Qualified Opportunities */}
      <div className="card-surface p-3.5 sm:p-4 hover:border-white/[0.15] transition-all group cursor-default">
        <div className="flex items-center justify-between text-slate-300 mb-1.5 sm:mb-2">
          <span className="text-xs font-medium font-sans truncate">Qualified Opps</span>
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-indigo-400 shrink-0">
            <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
          <span className="text-xl sm:text-2xl font-bold text-white font-mono">{totalQualified}</span>
          <span className="text-[11px] text-slate-300 font-mono truncate flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400 inline shrink-0" /> {avgRating} <span className="text-slate-400">({totalReviews.toLocaleString("en-IN")})</span>
          </span>
        </div>
      </div>

      {/* 2. Unlinked GBP Assets */}
      <div className="card-surface p-3.5 sm:p-4 hover:border-white/[0.15] transition-all group cursor-default">
        <div className="flex items-center justify-between text-slate-300 mb-1.5 sm:mb-2">
          <span className="text-xs font-medium font-sans truncate">Unlinked GBP</span>
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-purple-400 shrink-0">
            <Unlink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
          <span className="text-xl sm:text-2xl font-bold text-white font-mono">{unlinkedGbpCount}</span>
          <span className="text-[11px] text-slate-300 font-mono truncate">
            ₹8k–₹15k Scope
          </span>
        </div>
      </div>

      {/* 3. Zero Website Gaps */}
      <div className="card-surface p-3.5 sm:p-4 hover:border-white/[0.15] transition-all group cursor-default">
        <div className="flex items-center justify-between text-slate-300 mb-1.5 sm:mb-2">
          <span className="text-xs font-medium font-sans truncate">Zero Website</span>
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-amber-400 shrink-0">
            <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
          <span className="text-xl sm:text-2xl font-bold text-white font-mono">{noWebsiteCount}</span>
          <span className="text-[11px] text-slate-300 font-mono truncate">
            ₹18k–₹35k Scope
          </span>
        </div>
      </div>

      {/* 4. High-Conviction Targets (Primary Conversion Focus) */}
      <div className="card-surface p-3.5 sm:p-4 border-indigo-500/30 bg-indigo-950/20 hover:border-indigo-500/50 transition-all group cursor-default">
        <div className="flex items-center justify-between text-indigo-200 mb-1.5 sm:mb-2">
          <span className="text-xs font-bold font-sans truncate flex items-center gap-1.5">
            <span>High Conviction</span>
          </span>
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
          <span className="text-xl sm:text-2xl font-bold text-white font-mono">{highConvictionCount}</span>
          <span className="text-[11px] text-indigo-300 font-mono font-medium truncate flex items-center gap-1">
            Score ≥ 70
          </span>
        </div>
      </div>
    </div>
  );
}
