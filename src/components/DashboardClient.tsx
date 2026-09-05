"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { Header } from "@/components/Header";
import { ScanLauncher } from "@/components/ScanLauncher";
import { ExecutiveMetrics } from "@/components/ExecutiveMetrics";
import { LeadMatrixTable } from "@/components/LeadMatrixTable";
import { LeadInspectorDrawer } from "@/components/LeadInspectorDrawer";
import { LivePipelineBanner } from "@/components/LivePipelineBanner";
import { Lead, DiscoveryScan, HumanStatus } from "@/core/db/schema";
import { Loader2, RefreshCw, X, Trash2, ChevronDown, Lock, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

interface ToastNotification {
  type: "success" | "error" | "info";
  message: string;
}

export function DashboardClient() {
  const [scans, setScans] = useState<DiscoveryScan[]>([]);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [activeScan, setActiveScan] = useState<DiscoveryScan | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [secretInput, setSecretInput] = useState("");
  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [toast, setToast] = useState<ToastNotification | null>(null);

  // Dialog State
  const [deleteScanTarget, setDeleteScanTarget] = useState<DiscoveryScan | null>(null);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);
  const [destroyConfirmInput, setDestroyConfirmInput] = useState("");
  const [isClearingAll, setIsClearingAll] = useState(false);

  const showToast = useCallback((type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  }, []);

  // Global Cmd+K / Ctrl+K keyboard shortcut to focus discovery input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const nicheInput = document.getElementById("discovery-niche-input");
        if (nicheInput) {
          nicheInput.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch all scans
  const fetchScans = useCallback(async () => {
    try {
      const res = await fetch("/api/scans");
      if (res.status === 401) {
        setIsLocked(true);
        return;
      }
      if (res.ok) {
        setIsLocked(false);
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setScans(data.scans || []);
          setActiveScanId((current) => {
            if (!current && data.scans?.length > 0) {
              return data.scans[0].id;
            }
            return current;
          });
        } catch {
          // Non-JSON response
        }
      } else {
        showToast("error", `Failed to load discovery history (${res.status})`);
      }
    } catch (err: any) {
      showToast("error", err?.message || "Error fetching scans");
    }
  }, [showToast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretInput.trim()) return;
    setIsLoggingIn(true);
    setAuthErrorMsg(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secretInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsLocked(false);
        setSecretInput("");
        fetchScans();
        showToast("success", "Workstation unlocked successfully");
      } else {
        setAuthErrorMsg(data?.error || "Authentication failed.");
      }
    } catch (err: any) {
      setAuthErrorMsg(err.message || "Login request failed.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Fetch leads for active scan
  const fetchScanDetails = useCallback(async (scanId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/scans/${scanId}`);
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setActiveScan(data.scan);
          setLeads(data.leads || []);

          if (data.scan?.status === "RUNNING") {
            setIsScanning(true);
          } else {
            setIsScanning(false);
          }
        } catch {
          // Non-JSON response
        }
      }
    } catch (err: any) {
      showToast("error", err?.message || "Failed to load scan details");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  useEffect(() => {
    if (activeScanId) {
      fetchScanDetails(activeScanId);
    }
  }, [activeScanId, fetchScanDetails]);

  // Polling while active scan is running
  useEffect(() => {
    if (!isScanning || !activeScanId) return;

    const interval = setInterval(() => {
      fetchScanDetails(activeScanId);
      fetchScans();
    }, 2500);

    return () => clearInterval(interval);
  }, [isScanning, activeScanId, fetchScanDetails, fetchScans]);

  const handleScanLaunched = (newScanId: string) => {
    setActiveScanId(newScanId);
    setIsScanning(true);
    fetchScans();
    fetchScanDetails(newScanId);
    showToast("info", "Discovery & technical audit pipeline dispatched");
  };

  const handleDirectAuditCompleted = (directLead: Lead) => {
    setSelectedLead(directLead);
    showToast("success", `Completed instant teardown for ${directLead.name}`);
  };

  const handleCancelScan = async () => {
    if (!activeScanId) return;
    try {
      const res = await fetch(`/api/scans/${activeScanId}/cancel`, {
        method: "POST",
      });
      if (res.ok) {
        setIsScanning(false);
        fetchScanDetails(activeScanId);
        fetchScans();
        showToast("info", "Scan cancellation requested");
      }
    } catch (err: any) {
      showToast("error", err?.message || "Failed to cancel scan");
    }
  };

  const confirmDeleteScan = async () => {
    if (!deleteScanTarget) return;
    const scanId = deleteScanTarget.id;
    try {
      const res = await fetch(`/api/scans/${scanId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const remaining = scans.filter((s) => s.id !== scanId);
        setScans(remaining);
        if (activeScanId === scanId) {
          if (remaining.length > 0) {
            setActiveScanId(remaining[0].id);
            fetchScanDetails(remaining[0].id);
          } else {
            setActiveScanId(null);
            setActiveScan(null);
            setLeads([]);
          }
        }
        showToast("success", "Market scan removed from history");
      } else {
        showToast("error", `Failed to delete scan (${res.status})`);
      }
    } catch (err: any) {
      showToast("error", err?.message || "Failed to delete scan");
    } finally {
      setDeleteScanTarget(null);
    }
  };

  const confirmClearAllScans = async () => {
    if (destroyConfirmInput.trim() !== "DESTROY_ALL") return;
    setIsClearingAll(true);
    try {
      const res = await fetch("/api/scans", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DESTROY_ALL" }),
      });
      if (res.ok) {
        setScans([]);
        setActiveScanId(null);
        setActiveScan(null);
        setLeads([]);
        showToast("success", "All scan history cleared");
      } else {
        showToast("error", `Failed to clear scan history (${res.status})`);
      }
    } catch (err: any) {
      showToast("error", err?.message || "Failed to clear all scans");
    } finally {
      setIsClearingAll(false);
      setIsClearAllOpen(false);
      setDestroyConfirmInput("");
    }
  };

  const handleStatusChange = async (leadId: string, status: HumanStatus) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, humanStatus: status } : l))
        );
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead((prev) => (prev ? { ...prev, humanStatus: status } : null));
        }
      } else {
        showToast("error", `Failed to update lead status (${res.status})`);
      }
    } catch (err: any) {
      showToast("error", err?.message || "Failed to update status");
    }
  };

  const highPriorityCount = useMemo(
    () => leads.filter((l) => (l.totalLeadScore ?? 0) >= 70).length,
    [leads]
  );

  const visibleScans = useMemo(() => scans.slice(0, 5), [scans]);
  const overflowScans = useMemo(() => scans.slice(5), [scans]);

  if (isLocked) {
    return (
      <div className="min-h-screen bg-[#070A10] flex items-center justify-center p-4 relative text-slate-100">
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
          <Image
            src="/assets/hero-bg.jpg"
            alt="Atmospheric Background"
            fill
            priority
            className="object-cover object-[center_20%] opacity-100 contrast-[1.25] brightness-[1.2]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070A10]/90 via-black/50 to-black/70 pointer-events-none" />
        </div>

        <div className="w-full max-w-sm card-surface p-6 z-10 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Workstation Locked</h2>
          </div>
          <p className="text-xs text-slate-400">Enter LEAD_ENGINE_API_SECRET to authenticate your workstation session.</p>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder="Workstation Secret"
              required
              className="w-full px-3.5 py-2 rounded-lg bg-slate-900/80 border border-white/[0.15] text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-400"
            />
            {authErrorMsg && <p className="text-rose-400 text-xs font-mono">{authErrorMsg}</p>}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {isLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Unlock Workstation</span>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070A10] flex flex-col text-slate-100 relative selection:bg-indigo-500 selection:text-white">
      {/* Prominent High-Contrast Atmospheric Background Wallpaper Layer */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <Image
          src="/assets/hero-bg.jpg"
          alt="Atmospheric Background"
          fill
          priority
          className="object-cover object-[center_20%] opacity-100 contrast-[1.25] brightness-[1.2]"
        />
        {/* Cinematic Rim Glow and Ambient Lighting Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070A10]/75 via-black/20 to-black/30 pointer-events-none" />
        <div className="absolute inset-0 bg-radial-[circle_at_50%_30%] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Navigation Header */}
      <Header
        totalScans={scans.length}
        totalQualified={leads.length}
        highPriorityCount={highPriorityCount}
        activeScanId={activeScanId}
      />

      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed top-16 right-6 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            className={`px-4 py-2.5 rounded-lg border shadow-xl flex items-center gap-2.5 text-xs font-mono ${
              toast.type === "success"
                ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
                : toast.type === "error"
                ? "bg-rose-950/90 border-rose-500/40 text-rose-200"
                : "bg-indigo-950/90 border-indigo-500/40 text-indigo-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toast.type === "error" ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Main Studio Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-3.5 sm:space-y-5 relative z-10">
        {/* Layer 1: Discovery Launchpad */}
        <ScanLauncher
          onScanLaunched={handleScanLaunched}
          onDirectAuditCompleted={handleDirectAuditCompleted}
          onCancelScan={handleCancelScan}
          isLoading={isScanning}
          activeScanId={activeScanId}
        />

        {/* Live Telemetry Progress Banner */}
        <LivePipelineBanner
          isScanning={isScanning}
          activeScan={activeScan}
          onCancelScan={handleCancelScan}
        />

        {/* Executive KPI Metric Cards Strip */}
        <ExecutiveMetrics leads={leads} />

        {/* Scan Selector Tabs Bar (Cleaned & De-cluttered) */}
        {scans.length > 0 && (
          <div className="card-surface p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
            <div role="tablist" aria-label="Market discovery scans" className="flex items-center gap-1.5 font-mono overflow-x-auto no-scrollbar whitespace-nowrap py-0.5 -mx-0.5 px-0.5">
              <span className="text-xs text-slate-400 font-medium mr-1 font-sans shrink-0">
                Active Markets:
              </span>

              {/* Top Recent Market Tabs */}
              {visibleScans.map((scan) => {
                const isActive = scan.id === activeScanId;
                return (
                  <div
                    key={scan.id}
                    role="tab"
                    tabIndex={0}
                    aria-selected={isActive}
                    onClick={() => setActiveScanId(scan.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveScanId(scan.id);
                      }
                    }}
                    className={`group/tab relative px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 cursor-pointer select-none shrink-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[34px] sm:min-h-0 ${
                      isActive
                        ? "bg-indigo-600/40 text-white border border-indigo-500/50 shadow-sm"
                        : "bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08]"
                    }`}
                  >
                    <span>
                      {scan.niche} <span className="text-slate-400 font-sans">({scan.locationInput})</span>
                    </span>
                    {scan.status === "RUNNING" ? (
                      <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                    ) : (
                      <span className="text-[11px] text-slate-400 font-normal">
                        {scan.qualifiedCount}
                      </span>
                    )}

                    {/* Delete Individual Scan Trigger */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteScanTarget(scan);
                      }}
                      aria-label={`Delete ${scan.niche} in ${scan.locationInput}`}
                      className="opacity-0 group-hover/tab:opacity-100 p-0.5 rounded hover:bg-white/[0.1] text-slate-400 hover:text-slate-200 transition cursor-pointer ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {/* Overflow Dropdown for Older Market Scans */}
              {overflowScans.length > 0 && (
                <div className="relative inline-block shrink-0">
                  <select
                    value={overflowScans.some((s) => s.id === activeScanId) ? activeScanId || "" : ""}
                    onChange={(e) => {
                      if (e.target.value) setActiveScanId(e.target.value);
                    }}
                    aria-label="Select older market scans"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900/70 border border-white/[0.12] text-slate-300 text-xs focus:outline-none focus:border-indigo-400 cursor-pointer font-mono min-h-[34px] sm:min-h-0"
                  >
                    <option value="" disabled>
                      +{overflowScans.length} Older Markets...
                    </option>
                    {overflowScans.map((scan) => (
                      <option key={scan.id} value={scan.id}>
                        {scan.niche} ({scan.locationInput}) — {scan.qualifiedCount} leads
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Actions: Refresh & Clear All History */}
            <div className="flex items-center justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  fetchScans();
                  if (activeScanId) fetchScanDetails(activeScanId);
                  showToast("info", "Pipeline refreshed");
                }}
                aria-label="Refresh discovery pipeline"
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-white transition cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsClearAllOpen(true)}
                aria-label="Clear all scan history"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium transition cursor-pointer min-h-[34px]"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear History</span>
              </button>
            </div>
          </div>
        )}

        {/* Layer 3: The Opportunity Matrix Table & Grid Views */}
        <LeadMatrixTable
          leads={leads}
          onSelectLead={(lead) => setSelectedLead(lead)}
          selectedLeadId={selectedLead?.id}
          onStatusChange={handleStatusChange}
        />
      </main>

      {/* Layer 4: Slide-Over Inspector Drawer */}
      <LeadInspectorDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onStatusChange={handleStatusChange}
      />

      {/* Accessible Dialog: Delete Market Confirmation */}
      <Dialog.Root open={!!deleteScanTarget} onOpenChange={(open) => { if (!open) setDeleteScanTarget(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-in fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-md card-surface p-5 sm:p-6 space-y-4 shadow-2xl focus:outline-none">
            <Dialog.Title className="text-sm font-bold text-white flex items-center gap-2 font-mono">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Delete Market Scan</span>
            </Dialog.Title>
            <Dialog.Description className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove the market scan for <strong className="text-white">{deleteScanTarget?.niche}</strong> ({deleteScanTarget?.locationInput})? Historical business observations will be preserved in the ledger.
            </Dialog.Description>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteScanTarget(null)}
                className="px-3.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-xs transition cursor-pointer border border-white/[0.08] min-h-[36px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteScan}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition cursor-pointer shadow-lg shadow-rose-950/40 min-h-[36px]"
              >
                Confirm Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Accessible Dialog: Clear All History (DESTROY_ALL) */}
      <Dialog.Root open={isClearAllOpen} onOpenChange={(open) => { if (!open) { setIsClearAllOpen(false); setDestroyConfirmInput(""); } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-in fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-md card-surface p-5 sm:p-6 space-y-4 shadow-2xl focus:outline-none border border-rose-500/30">
            <Dialog.Title className="text-sm font-bold text-rose-300 flex items-center gap-2 font-mono">
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Clear All Scan History</span>
            </Dialog.Title>
            <Dialog.Description className="text-xs text-slate-300 leading-relaxed">
              This action wipes all active discovery scans and associated leads from the workstation database. Type <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono font-bold">DESTROY_ALL</span> below to confirm:
            </Dialog.Description>
            <input
              type="text"
              value={destroyConfirmInput}
              onChange={(e) => setDestroyConfirmInput(e.target.value)}
              placeholder="Type DESTROY_ALL"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/[0.15] text-slate-100 text-xs font-mono focus:outline-none focus:border-rose-400 min-h-[38px]"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setIsClearAllOpen(false); setDestroyConfirmInput(""); }}
                className="px-3.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-xs transition cursor-pointer border border-white/[0.08] min-h-[36px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={destroyConfirmInput.trim() !== "DESTROY_ALL" || isClearingAll}
                onClick={confirmClearAllScans}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs transition cursor-pointer shadow-lg shadow-rose-950/40 flex items-center gap-1.5 min-h-[36px]"
              >
                {isClearingAll && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Wipe All History</span>
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
