"use client";

import React from "react";
import { Download, Terminal, Activity } from "lucide-react";

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
    <header className="sticky top-0 z-40 px-3.5 sm:px-6 py-2 sm:py-3 bg-[#0A0E17]/85 backdrop-blur-xl border-b border-white/[0.1] shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        {/* Brand & Terminal Identity */}
        <div className="flex items-center justify-between sm:justify-start gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-xs sm:text-sm font-bold tracking-tight text-white font-sans">
                  LEAD ENGINE
                </h1>
                <span className="px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-medium bg-white/[0.04] text-slate-300 border border-white/[0.06]">
                  v1.0.0
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate hidden xs:block">
                Discovery &amp; technical evidence workstation
              </p>
            </div>
          </div>

          {/* Mobile Export Button (Visible on mobile header row) */}
          <button
            type="button"
            onClick={handleExportCsv}
            aria-label="Export Leads to CSV"
            className="sm:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 text-[11px] font-medium transition cursor-pointer"
          >
            <Download className="w-3 h-3 text-slate-400" />
            <span>Export</span>
          </button>
        </div>

        {/* Live Metrics Summary & Desktop Export */}
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3.5 text-xs">
          <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-slate-400 font-mono">
            <span>
              <strong className="text-slate-100 font-bold">{totalScans}</strong> Scans
            </span>
            <span className="text-slate-600">·</span>
            <span>
              <strong className="text-slate-100 font-bold">{totalQualified}</strong> Leads
            </span>
            {highPriorityCount > 0 && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <Activity className="w-3 h-3 animate-pulse" />
                  <span>{highPriorityCount} Opps</span>
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            aria-label="Export Leads to CSV"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 text-xs font-medium transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>
    </header>
  );
}
