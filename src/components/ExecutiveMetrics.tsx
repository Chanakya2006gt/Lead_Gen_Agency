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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
      {/* 1. Qualified Opportunities */}
      <div className="card-surface p-3 sm:p-4 hover:-translate-y-1 hover:border-indigo-500/30 hover:shadow-xl transition-all duration-300 group cursor-default">
        <div className="flex items-center justify-between text-slate-400 mb-1.5 sm:mb-2">
          <span className="text-[11px] sm:text-xs font-medium font-sans truncate">Qualified Opps</span>
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 group-hover:scale-110 transition-transform">
            <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
          <span className="text-xl sm:text-2xl font-bold text-white font-mono">{totalQualified}</span>
          <span className="text-[10px] sm:text-[11px] text-indigo-300 font-mono truncate flex items-center gap-0.5">
            <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 fill-amber-400 inline shrink-0" /> {avgRating} ({totalReviews.toLocaleString("en-IN")})
          </span>
        </div>
      </div>

      {/* 2. Unlinked GBP Assets */}
      <div className="card-surface p-3 sm:p-4 hover:-translate-y-1 hover:border-purple-500/30 hover:shadow-xl transition-all duration-300 group cursor-default">
        <div className="flex items-center justify-between text-slate-400 mb-1.5 sm:mb-2">
          <span className="text-[11px] sm:text-xs font-medium font-sans truncate">Unlinked GBP</span>
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-110 transition-transform">
            <Unlink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
          <span className="text-xl sm:text-2xl font-bold text-white font-mono">{unlinkedGbpCount}</span>
          <span className="text-[10px] sm:text-[11px] text-purple-300 font-mono truncate">
            ₹8k–₹15k Scope
          </span>
        </div>
      </div>

      {/* 3. Zero Website Gaps */}
      <div className="card-surface p-3 sm:p-4 hover:-translate-y-1 hover:border-amber-500/30 hover:shadow-xl transition-all duration-300 group cursor-default">
        <div className="flex items-center justify-between text-slate-400 mb-1.5 sm:mb-2">
          <span className="text-[11px] sm:text-xs font-medium font-sans truncate">Zero Website</span>
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-110 transition-transform">
            <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
          <span className="text-xl sm:text-2xl font-bold text-white font-mono">{noWebsiteCount}</span>
          <span className="text-[10px] sm:text-[11px] text-amber-300 font-mono truncate">
            ₹18k–₹35k Scope
          </span>
        </div>
      </div>

      {/* 4. High-Conviction Targets */}
      <div className="card-surface p-3 sm:p-4 hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-xl transition-all duration-300 group cursor-default">
        <div className="flex items-center justify-between text-slate-400 mb-1.5 sm:mb-2">
          <span className="text-[11px] sm:text-xs font-medium font-sans truncate">High Conviction</span>
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
          <span className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">{highConvictionCount}</span>
          <span className="text-[10px] sm:text-[11px] text-emerald-300/90 font-mono truncate flex items-center gap-0.5">
            Score ≥ 70
          </span>
        </div>
      </div>
    </div>
  );
}
