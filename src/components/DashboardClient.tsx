"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { ScanLauncher } from "@/components/ScanLauncher";
import { LeadMatrixTable } from "@/components/LeadMatrixTable";
import { LeadDossierModal } from "@/components/LeadDossierModal";
import { LiveTerminal } from "@/components/LiveTerminal";
import { Lead, DiscoveryScan, HumanStatus } from "@/core/db/schema";
import { Loader2, RefreshCw, X } from "lucide-react";

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

  const highPriorityCount = leads.filter((l) => !l.hasWebsite).length;

  return (
    <div className="min-h-screen bg-[#090B10] flex flex-col text-slate-100">
      <Header
        totalScans={scans.length}
        totalQualified={leads.length}
        highPriorityCount={highPriorityCount}
        activeScanId={activeScanId}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-5">
        {/* Discovery Launchpad */}
        <ScanLauncher
          onScanLaunched={handleScanLaunched}
          onCancelScan={handleCancelScan}
          isLoading={isScanning}
          activeScanId={activeScanId}
        />

        {/* Live Pipeline Status */}
        <LiveTerminal
          isScanning={isScanning}
          activeScan={activeScan}
        />

        {/* Scan Selector Tabs Bar */}
        {scans.length > 0 && (
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium mr-1">
                Scans:
              </span>
              {scans.map((scan) => {
                const isActive = scan.id === activeScanId;
                return (
                  <div
                    key={scan.id}
                    onClick={() => setActiveScanId(scan.id)}
                    className={`group/tab relative px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 cursor-pointer select-none ${
                      isActive
                        ? "bg-white/[0.1] text-white border border-white/[0.12]"
                        : "bg-white/[0.02] hover:bg-white/[0.05] text-slate-400 hover:text-slate-200 border border-transparent"
                    }`}
                  >
                    <span>
                      {scan.niche} <span className="text-slate-500">({scan.locationInput})</span>
                    </span>
                    {scan.status === "RUNNING" ? (
                      <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                    ) : (
                      <span className="text-[11px] text-slate-400 font-normal">
                        {scan.qualifiedCount} leads
                      </span>
                    )}

                    {/* Delete Scan / Close Tab */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteScan(scan.id, e)}
                      className="opacity-0 group-hover/tab:opacity-100 p-0.5 rounded hover:bg-white/[0.1] text-slate-400 hover:text-slate-200 transition cursor-pointer ml-0.5"
                      title="Delete this scan"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => {
                fetchScans();
                if (activeScanId) fetchScanDetails(activeScanId);
              }}
              className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-white transition cursor-pointer"
              title="Refresh Pipeline"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Lead Matrix Table (The Star of the System) */}
        <LeadMatrixTable
          leads={leads}
          onSelectLead={(lead) => setSelectedLead(lead)}
          selectedLeadId={selectedLead?.id}
          onStatusChange={handleStatusChange}
        />
      </main>

      {/* Sales Intelligence Dossier Modal */}
      <LeadDossierModal
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
