"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Header } from "@/components/Header";
import { ScanLauncher } from "@/components/ScanLauncher";
import { ExecutiveMetrics } from "@/components/ExecutiveMetrics";
import { LeadMatrixTable } from "@/components/LeadMatrixTable";
import { LeadInspectorDrawer } from "@/components/LeadInspectorDrawer";
import { LivePipelineBanner } from "@/components/LivePipelineBanner";
import { Lead, DiscoveryScan, HumanStatus } from "@/core/db/schema";
import { Loader2, RefreshCw, X, Trash2, ChevronDown } from "lucide-react";

export function DashboardClient() {
  const [scans, setScans] = useState<DiscoveryScan[]>([]);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [activeScan, setActiveScan] = useState<DiscoveryScan | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Fetch all scans
  const fetchScans = useCallback(async () => {
    try {
      const res = await fetch("/api/scans");
      if (res.ok) {
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
      }
    } catch (err) {
      console.error("Error fetching scans:", err);
    }
  }, []);

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
    } catch (err) {
      console.error("Error fetching scan details:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    }, 2000);

    return () => clearInterval(interval);
  }, [isScanning, activeScanId, fetchScanDetails, fetchScans]);

  const handleScanLaunched = (newScanId: string) => {
    setActiveScanId(newScanId);
    setIsScanning(true);
    fetchScans();
    fetchScanDetails(newScanId);
  };

  const handleDirectAuditCompleted = (directLead: Lead) => {
    setSelectedLead(directLead);
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
      }
    } catch (err) {
      console.error("Failed to cancel scan:", err);
    }
  };

  const handleDeleteScan = async (scanId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
      }
    } catch (err) {
      console.error("Failed to delete scan:", err);
    }
  };

  const handleClearAllScans = async () => {
    if (!confirm("Are you sure you want to clear all discovery scan history?")) return;
    try {
      const res = await fetch("/api/scans", {
        method: "DELETE",
      });
      if (res.ok) {
        setScans([]);
        setActiveScanId(null);
        setActiveScan(null);
        setLeads([]);
      }
    } catch (err) {
      console.error("Failed to clear all scans:", err);
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
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const highPriorityCount = leads.filter((l) => !l.hasWebsite || l.isGbpDisconnected).length;

  // Render top 4 recent markets as primary quick tabs, overflow into dropdown
  const visibleScans = scans.slice(0, 4);
  const overflowScans = scans.slice(4);

  return (
    <div className="min-h-screen bg-[#070A10] flex flex-col text-slate-100 relative selection:bg-indigo-500 selection:text-white">
      {/* Prominent High-Contrast Atmospheric Background Wallpaper Layer */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <img
          src="/assets/hero-bg.jpg"
          alt="Atmospheric Background"
          className="w-full h-full object-cover object-[center_20%] opacity-100 contrast-[1.3] brightness-[1.25] saturate-[1.15]"
        />
        {/* Cinematic Rim Glow and Ambient Lighting Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070A10]/70 via-transparent to-black/20 pointer-events-none" />
        <div className="absolute inset-0 bg-radial-[circle_at_50%_30%] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Navigation Header */}
      <Header
        totalScans={scans.length}
        totalQualified={leads.length}
        highPriorityCount={highPriorityCount}
        activeScanId={activeScanId}
      />

      {/* Main Studio Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-5 relative z-10">
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
          <div className="card-surface p-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 font-mono">
              <span className="text-xs text-slate-400 font-medium mr-1 font-sans">
                Active Markets:
              </span>

              {/* Top Recent Market Tabs */}
              {visibleScans.map((scan) => {
                const isActive = scan.id === activeScanId;
                return (
                  <div
                    key={scan.id}
                    onClick={() => setActiveScanId(scan.id)}
                    className={`group/tab relative px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 cursor-pointer select-none ${
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

                    {/* Delete Individual Scan */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteScan(scan.id, e)}
                      className="opacity-0 group-hover/tab:opacity-100 p-0.5 rounded hover:bg-white/[0.1] text-slate-400 hover:text-slate-200 transition cursor-pointer ml-0.5"
                      title="Delete this market"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {/* Overflow Dropdown for Older Market Scans */}
              {overflowScans.length > 0 && (
                <div className="relative inline-block">
                  <select
                    value={overflowScans.some((s) => s.id === activeScanId) ? activeScanId || "" : ""}
                    onChange={(e) => {
                      if (e.target.value) setActiveScanId(e.target.value);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900/70 border border-white/[0.12] text-slate-300 text-xs focus:outline-none focus:border-indigo-400 cursor-pointer font-mono"
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  fetchScans();
                  if (activeScanId) fetchScanDetails(activeScanId);
                }}
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-white transition cursor-pointer"
                title="Refresh Pipeline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleClearAllScans}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium transition cursor-pointer"
                title="Clear All Scan History"
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
    </div>
  );
}
