"use client";

import React, { useState } from "react";
import { Terminal, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { DiscoveryScan } from "@/core/db/schema";

interface LiveTerminalProps {
  isScanning: boolean;
  activeScan?: DiscoveryScan | null;
}

export function LiveTerminal({ isScanning, activeScan }: LiveTerminalProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="bg-[#070A0F] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl transition-all">
      {/* Header Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2.5 bg-[#0B101A] border-b border-white/[0.06] flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-300 flex items-center gap-1.5 ml-2">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>PIPELINE EXECUTION TELEMETRY</span>
          </span>

          {isScanning ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              <span>ACTIVE SCAN RUNNING</span>
            </span>
          ) : activeScan?.status === "COMPLETED" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>SCAN COMPLETED</span>
            </span>
          ) : activeScan?.status === "FAILED" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
              <AlertCircle className="w-3 h-3 text-rose-400" />
              <span>SCAN FAILED</span>
            </span>
          ) : null}
        </div>

        <button className="text-slate-400 hover:text-white p-1">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Terminal Output */}
      {isOpen && (
        <div className="p-4 font-mono text-[11px] space-y-2 bg-[#05070B] text-slate-300 max-h-48 overflow-y-auto">
          {activeScan ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold">SCAN ID:</span>
                <span className="text-indigo-300">{activeScan.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold">TARGET:</span>
                <span className="text-slate-200">
                  {activeScan.niche} in {activeScan.locationInput} (Radius: {activeScan.radiusKm} km)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold">RAW INGESTED:</span>
                <span className="text-amber-300">{activeScan.rawDiscoveredCount} businesses</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold">QUALIFIED (Rating &ge; 4.0★ &amp; Rev &ge; 50):</span>
                <span className="text-emerald-300 font-bold">{activeScan.qualifiedCount} leads</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold">STATUS:</span>
                <span
                  className={
                    activeScan.status === "COMPLETED"
                      ? "text-emerald-400 font-bold"
                      : activeScan.status === "RUNNING"
                      ? "text-amber-400 font-bold animate-pulse"
                      : "text-rose-400 font-bold"
                  }
                >
                  {activeScan.status}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-slate-500">
              Ready. Select a target vertical and location to execute a live qualification scan.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
