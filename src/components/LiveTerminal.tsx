"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { DiscoveryScan } from "@/core/db/schema";

interface LiveTerminalProps {
  isScanning: boolean;
  activeScan?: DiscoveryScan | null;
}

export function LiveTerminal({ isScanning, activeScan }: LiveTerminalProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isScanning && !activeScan) return null;

  return (
    <div className="card-surface overflow-hidden">
      {/* Header Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-[#0B0D13] flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition select-none text-xs"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-slate-400 font-medium">Pipeline Status:</span>

          {isScanning ? (
            <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Scanning &amp; Auditing Targets...</span>
            </span>
          ) : activeScan?.status === "COMPLETED" ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>Scan Completed ({activeScan.qualifiedCount} leads qualified)</span>
            </span>
          ) : activeScan?.status === "FAILED" ? (
            <span className="inline-flex items-center gap-1.5 text-rose-400 font-medium">
              <AlertCircle className="w-3 h-3" />
              <span>Scan Failed</span>
            </span>
          ) : null}
        </div>

        <button className="text-slate-400 hover:text-white p-1">
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Details Output */}
      {isOpen && activeScan && (
        <div className="p-3.5 font-mono text-[11px] space-y-1.5 bg-[#07090E] border-t border-white/[0.04] text-slate-300">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Scan ID:</span>
            <span className="text-slate-200">{activeScan.id}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Target:</span>
            <span className="text-slate-200">
              {activeScan.niche} in {activeScan.locationInput} (Radius: {activeScan.radiusKm} km)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Raw Ingested:</span>
            <span className="text-slate-200">{activeScan.rawDiscoveredCount} businesses</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Qualified:</span>
            <span className="text-emerald-400 font-semibold">{activeScan.qualifiedCount} leads</span>
          </div>
        </div>
      )}
    </div>
  );
}
