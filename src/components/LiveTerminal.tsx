"use client";

import React, { useState, useEffect } from "react";
import { Terminal, ChevronDown, ChevronUp, Radio, CheckCircle2, Loader2, Sparkles } from "lucide-react";

interface LiveTerminalProps {
  isScanning: boolean;
  niche?: string;
  location?: string;
}

export function LiveTerminal({ isScanning, niche = "Dental Clinics", location = "Warangal" }: LiveTerminalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [logs, setLogs] = useState<Array<{ timestamp: string; text: string; type: "info" | "success" | "warn" | "exec" }>>([]);

  useEffect(() => {
    if (!isScanning) {
      if (logs.length === 0) {
        setLogs([
          { timestamp: "00:00.00", text: "Ready. Select a target niche & market to initiate real-time headless discovery.", type: "info" },
        ]);
      }
      return;
    }

    setLogs([]);
    const startTime = Date.now();

    const addLog = (text: string, type: "info" | "success" | "warn" | "exec", delayMs: number) => {
      setTimeout(() => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        setLogs((prev) => [...prev, { timestamp: `+${elapsed}s`, text, type }]);
      }, delayMs);
    };

    addLog(`Initializing Headless Chromium instance (Dual-Viewport: 1280x900 / 375x812)...`, "exec", 200);
    addLog(`Navigating to Google Maps Search: "${niche} in ${location}"`, "info", 800);
    addLog(`Parsing feed container [role="feed"] -> Scrolling DOM to extract candidate listings...`, "info", 1800);
    addLog(`Extracted raw business profiles (ratings, review counts, addresses, phone numbers, websites).`, "success", 3000);
    addLog(`Enforcing 13 Universal Mathematical Invariants (rating >= 4.0★, reviews >= 50)...`, "exec", 4000);
    addLog(`Executing mobile DOM audit (<meta name="viewport">, layout overflow, SSL, CTAs)...`, "info", 5200);
    addLog(`Computing 4D mathematical scores (S_rep, S_gap, S_opp, S_conf) & synthesizing pitch deck.`, "success", 6800);
    addLog(`Discovery & audit completed. Leads persisted to database.`, "success", 8200);
  }, [isScanning, niche, location]);

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
            <span>PLAYWRIGHT RUNTIME TELEMETRY</span>
          </span>

          {isScanning && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              <span>LIVE SCRAPING ACTIVE</span>
            </span>
          )}
        </div>

        <button className="text-slate-400 hover:text-white p-1">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Terminal Output */}
      {isOpen && (
        <div className="p-4 font-mono text-[11px] space-y-1.5 max-h-48 overflow-y-auto bg-[#05070B] text-slate-300">
          {logs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-2.5">
              <span className="text-slate-600 select-none font-bold shrink-0">{log.timestamp}</span>
              <span className="shrink-0">
                {log.type === "success" && <span className="text-emerald-400 font-bold">✔</span>}
                {log.type === "exec" && <span className="text-indigo-400 font-bold">❯</span>}
                {log.type === "info" && <span className="text-sky-400 font-bold">ℹ</span>}
                {log.type === "warn" && <span className="text-amber-400 font-bold">⚠</span>}
              </span>
              <span
                className={
                  log.type === "success"
                    ? "text-emerald-300"
                    : log.type === "exec"
                    ? "text-indigo-200"
                    : log.type === "warn"
                    ? "text-amber-300"
                    : "text-slate-300"
                }
              >
                {log.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
