"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { ScanLauncher } from "@/components/ScanLauncher";
import { LeadMatrixTable } from "@/components/LeadMatrixTable";
import { LeadDossierModal } from "@/components/LeadDossierModal";
import { LiveTerminal } from "@/components/LiveTerminal";
import { Lead, DiscoveryScan, HumanStatus } from "@/core/db/schema";
import { Loader2, RefreshCw, Layers, Sparkles } from "lucide-react";

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
        const data = await res.json();
        setScans(data.scans || []);
        setActiveScanId((current) => {
          if (!current && data.scans?.length > 0) {
            return data.scans[0].id;
          }
          return current;
        });
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
        const data = await res.json();
        setActiveScan(data.scan);
        setLeads(data.leads || []);

        if (data.scan?.status === "RUNNING") {
          setIsScanning(true);
        } else {
          setIsScanning(false);
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

  const handleStatusChange = async (leadId: string, status: HumanStatus) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        // Update local state
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

  const highPriorityCount = leads.filter((l) => !l.hasWebsite).length;

  return (
    <div className="min-h-screen bg-[#070A0F] flex flex-col text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      <Header
        totalScans={scans.length}
        totalQualified={leads.length}
        highPriorityCount={highPriorityCount}
        activeScanId={activeScanId}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Discovery Launchpad */}
        <ScanLauncher onScanLaunched={handleScanLaunched} isLoading={isScanning} />

        {/* Live Pipeline Telemetry Drawer */}
        <LiveTerminal
          isScanning={isScanning}
          activeScan={activeScan}
        />

        {/* Scan Selector Tabs Bar */}
        {scans.length > 0 && (
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase text-slate-500 font-semibold mr-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Scans:
              </span>
              {scans.map((scan) => {
                const isActive = scan.id === activeScanId;
                return (
                  <button
                    key={scan.id}
                    onClick={() => setActiveScanId(scan.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                      isActive
                        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                        : "bg-[#0D131F] hover:bg-white/[0.04] text-slate-400 border border-white/[0.08]"
                    }`}
                  >
                    <span>
                      {scan.niche} <span className="text-slate-500 font-normal">({scan.locationInput})</span>
                    </span>
                    {scan.status === "RUNNING" ? (
                      <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                    ) : (
                      <span className="font-mono text-[10px] text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded">
                        {scan.qualifiedCount} leads
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                fetchScans();
                if (activeScanId) fetchScanDetails(activeScanId);
              }}
              className="p-2 rounded-xl bg-[#0D131F] hover:bg-white/[0.06] border border-white/[0.08] text-slate-400 hover:text-white transition cursor-pointer"
              title="Refresh Pipeline"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Live Ingestion / Audit Active Banner */}
        {isScanning && (
          <div className="bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-indigo-950/60 border border-indigo-500/40 rounded-2xl p-4 flex items-center justify-between text-xs text-indigo-200 shadow-xl backdrop-blur-xl animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div>
                <span className="font-bold text-white block">
                  Scraping &amp; Auditing Live Targets for {activeScan?.niche} in {activeScan?.locationInput}
                </span>
                <span className="text-[11px] text-indigo-300">
                  Executing Headless Chromium Dual-Viewport Audits across mobile &amp; desktop...
                </span>
              </div>
            </div>
            <span className="font-mono text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
              13 Invariants Active
            </span>
          </div>
        )}

        {/* Lead Matrix Table */}
        <LeadMatrixTable
          leads={leads}
          onSelectLead={(lead) => setSelectedLead(lead)}
          selectedLeadId={selectedLead?.id}
          onStatusChange={handleStatusChange}
        />
      </main>

      {/* Dossier Modal Drawer */}
      <LeadDossierModal
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
