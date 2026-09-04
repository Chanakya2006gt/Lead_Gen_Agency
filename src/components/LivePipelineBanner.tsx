"use client";

import React from "react";
import { DiscoveryScan } from "@/core/db/schema";
import { Loader2, Square, Activity, CheckCircle, Radio } from "lucide-react";

interface LivePipelineBannerProps {
  isScanning: boolean;
  activeScan: DiscoveryScan | null;
  onCancelScan?: () => void;
}

export function LivePipelineBanner({
  isScanning,
  activeScan,
  onCancelScan,
}: LivePipelineBannerProps) {
  if (!activeScan && !isScanning) return null;

  const status = activeScan?.status || (isScanning ? "RUNNING" : "COMPLETED");
  const isRunning = status === "RUNNING";

  return (
    <div className="card-surface p-4 border border-indigo-500/20 bg-gradient-to-r from-indigo-950/20 via-[#0D111A] to-[#0D111A] animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Active Pipeline State & Counter */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
            {isRunning ? (
              <Radio className="w-4 h-4 animate-pulse text-indigo-400" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white font-sans tracking-tight">
                {isRunning ? "Live Opportunity Pipeline Active" : "Discovery Pipeline Completed"}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                  isRunning
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse"
                    : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                {status}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              <span>
                Auditing {activeScan?.niche || "local market"} entities in {activeScan?.locationInput || "selected location"}
              </span>
            </p>
          </div>
        </div>

        {/* Right: Metrics & Cancel Button */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <div>
              <span className="text-slate-500">Discovered:</span>{" "}
              <strong className="text-slate-200">{activeScan?.rawDiscoveredCount || 0}</strong>
            </div>
            <span className="text-slate-600">·</span>
            <div>
              <span className="text-slate-500">Qualified:</span>{" "}
              <strong className="text-emerald-400">{activeScan?.qualifiedCount || 0}</strong>
            </div>
          </div>

          {isRunning && onCancelScan && (
            <button
              type="button"
              onClick={onCancelScan}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium transition cursor-pointer active:scale-[0.98]"
            >
              <Square className="w-3 h-3 fill-rose-400" />
              <span>Stop Scan</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
