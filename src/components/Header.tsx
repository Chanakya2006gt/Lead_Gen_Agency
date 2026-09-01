"use client";

import React from "react";
import { Download, Sparkles, Database, Layers, Radio, Activity, Target, Zap } from "lucide-react";

interface HeaderProps {
  totalScans: number;
  totalQualified: number;
  highPriorityCount: number;
  activeScanId?: string | null;
}

export function Header({
  totalScans,
  totalQualified,
  highPriorityCount,
  activeScanId,
}: HeaderProps) {
  const handleExportCsv = () => {
    const url = activeScanId
      ? `/api/leads/export?scanId=${activeScanId}`
      : `/api/leads/export`;
    window.open(url, "_blank");
  };

  return (
    <header className="border-b border-white/[0.08] bg-[#070A0F]/85 backdrop-blur-2xl sticky top-0 z-40 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand & Studio Status */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 text-indigo-400 shadow-inner">
            <Layers className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                LEAD ENGINE
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                <Radio className="w-3 h-3 text-indigo-400" /> LIVE INTELLIGENCE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>Private Client Acquisition &amp; Headless DOM Audit Workstation</span>
            </p>
          </div>
        </div>

        {/* Live Metrics Cards */}
        <div className="flex items-center gap-2.5">
          <div className="grid grid-cols-3 gap-2 bg-[#0B101A] p-1.5 rounded-xl border border-white/[0.08]">
            <div className="px-3 py-1 rounded-lg bg-[#111827]/70">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Scans</span>
              <span className="text-xs font-mono font-bold text-slate-200">{totalScans}</span>
            </div>
            <div className="px-3 py-1 rounded-lg bg-[#111827]/70">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Qualified</span>
              <span className="text-xs font-mono font-bold text-indigo-400">{totalQualified}</span>
            </div>
            <div className="px-3 py-1 rounded-lg bg-[#111827]/70">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">No-Website</span>
              <span className="text-xs font-mono font-bold text-amber-400">{highPriorityCount} 🔥</span>
            </div>
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 text-xs font-medium transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>
    </header>
  );
}
