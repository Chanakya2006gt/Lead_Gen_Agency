"use client";

import React from "react";
import { Download, Sparkles, Database, Layers, Radio, Activity, Target, Zap, ArrowUpRight } from "lucide-react";

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
    <header className="sticky top-0 z-40 px-6 py-3.5 glass-island border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand & Studio Status */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600/30 to-purple-600/20 border border-indigo-500/40 text-indigo-300 shadow-[0_0_25px_rgba(99,102,241,0.2)]">
            <Layers className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 ring-2 ring-[#06080D]" />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2 font-mono">
                LEAD ENGINE
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                <Radio className="w-3 h-3 text-emerald-400" /> LIVE INTELLIGENCE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>Autonomous B2B Client Discovery &amp; Headless DOM Audit Workstation</span>
            </p>
          </div>
        </div>

        {/* Live KPI Cards (Double-Bezel Nested Micro Architecture) */}
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-3 gap-2 bg-[#090D18] p-1.5 rounded-2xl border border-white/[0.08] shadow-inner">
            <div className="px-3.5 py-1.5 rounded-xl bg-[#0F1626]/80 border border-white/[0.04]">
              <span className="text-[10px] uppercase font-mono text-slate-400 block font-semibold">Total Scans</span>
              <span className="text-xs font-mono font-extrabold text-slate-200">{totalScans}</span>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-[#0F1626]/80 border border-white/[0.04]">
              <span className="text-[10px] uppercase font-mono text-indigo-400/90 block font-semibold">Qualified</span>
              <span className="text-xs font-mono font-extrabold text-indigo-300">{totalQualified}</span>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-[#0F1626]/80 border border-white/[0.04]">
              <span className="text-[10px] uppercase font-mono text-amber-400/90 block font-semibold">No Website</span>
              <span className="text-xs font-mono font-extrabold text-amber-300">{highPriorityCount} 🔥</span>
            </div>
          </div>

          {/* Nested "Button-in-Button" CSV Export */}
          <button
            onClick={handleExportCsv}
            className="group flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-slate-200 text-xs font-semibold transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <span>Export CSV</span>
            <div className="w-5 h-5 rounded-full bg-white/[0.08] flex items-center justify-center group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors">
              <Download className="w-3 h-3 text-slate-400 group-hover:text-indigo-300" />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
