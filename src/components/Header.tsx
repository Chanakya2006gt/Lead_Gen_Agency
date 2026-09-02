"use client";

import React from "react";
import { Download, Layers } from "lucide-react";

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
    <header className="sticky top-0 z-40 px-6 py-3.5 bg-[#0A0C10] border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Brand & Purpose */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white">
                LEAD ENGINE
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/[0.06] text-slate-300 border border-white/[0.06]">
                Client Prospecting
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Verified local business discovery &amp; conversion audit system
            </p>
          </div>
        </div>

        {/* Live Metrics Summary & Export */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
            <span>
              <strong className="text-slate-200">{totalScans}</strong> Scans
            </span>
            <span className="text-slate-600">·</span>
            <span>
              <strong className="text-slate-200">{totalQualified}</strong> Leads
            </span>
            {highPriorityCount > 0 && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <span>{highPriorityCount} High Priority</span>
                </span>
              </>
            )}
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 text-xs font-medium transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>
    </header>
  );
}
