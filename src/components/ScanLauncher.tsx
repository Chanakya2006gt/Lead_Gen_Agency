"use client";

import React, { useState } from "react";
import { Search, Loader2, Sparkles, MapPin, Sliders, Globe, Radio, Flame, ShieldAlert, Cpu } from "lucide-react";

interface ScanLauncherProps {
  onScanLaunched: (scanId: string) => void;
  isLoading: boolean;
}

const PRESETS = [
  { niche: "Dental Clinics", location: "Warangal", radius: 15, tag: "Healthcare" },
  { niche: "Roofing Contractors", location: "Dallas, TX", radius: 25, tag: "Home Services" },
  { niche: "HVAC Specialists", location: "Austin, TX", radius: 20, tag: "HVAC" },
  { niche: "Solar Installers", location: "Phoenix, AZ", radius: 30, tag: "Energy" },
  { niche: "Luxury Hair Salons", location: "Miami, FL", radius: 15, tag: "Beauty & Spa" },
];

export function ScanLauncher({ onScanLaunched, isLoading }: ScanLauncherProps) {
  const [niche, setNiche] = useState("Dental Clinics");
  const [location, setLocation] = useState("Warangal");
  const [radiusKm, setRadiusKm] = useState(15);
  const [source, setSource] = useState<
    "live_google_maps" | "serpapi" | "mock" | "apify" | "outscraper"
  >("live_google_maps");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim() || !location.trim()) return;

    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: niche.trim(),
          location: location.trim(),
          radiusKm,
          source,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to launch scan");
      }

      const data = await res.json();
      onScanLaunched(data.scanId);
    } catch (err: any) {
      alert(`Scan Launch Error: ${err.message}`);
    }
  };

  const applyPreset = (p: { niche: string; location: string; radius: number }) => {
    setNiche(p.niche);
    setLocation(p.location);
    setRadiusKm(p.radius);
  };

  return (
    <div className="bg-[#0D131F]/90 border border-white/[0.08] rounded-2xl p-5 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-1/4 w-96 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-indigo-400" />
            <h2 className="text-xs uppercase font-mono font-bold tracking-wider text-slate-300">
              DISCOVERY &amp; AUDIT PIPELINE
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Discovers local operators, filters by rating &ge; 4.0★ &amp; reviews &ge; 50, and runs headless Chromium DOM audits.
          </p>
        </div>

        {/* Quick Market Presets */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 font-mono text-[10px] uppercase mr-1">Quick Markets:</span>
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(p)}
              className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-indigo-500/20 hover:text-indigo-300 border border-white/[0.06] text-slate-300 transition text-[11px] font-medium cursor-pointer"
            >
              {p.niche} · <span className="text-slate-500">{p.location.split(",")[0]}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 relative z-10">
        {/* Niche Input */}
        <div className="md:col-span-4">
          <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1.5">
            Target Niche / Vertical
          </label>
          <div className="relative">
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. Dental Clinics, HVAC, Roofing"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#070A0F] border border-white/[0.08] text-slate-100 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition font-medium"
            />
          </div>
        </div>

        {/* Location Input */}
        <div className="md:col-span-3">
          <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1.5">
            City / Search Market
          </label>
          <div className="relative">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Warangal, Dallas TX"
              required
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#070A0F] border border-white/[0.08] text-slate-100 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition font-medium"
            />
            <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
          </div>
        </div>

        {/* Radius Slider */}
        <div className="md:col-span-2">
          <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1.5 flex justify-between">
            <span>Radius</span>
            <span className="text-indigo-400 font-bold">{radiusKm} km</span>
          </label>
          <div className="pt-2">
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
            />
          </div>
        </div>

        {/* Discovery Engine Selector */}
        <div className="md:col-span-1">
          <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1.5">
            Engine
          </label>
          <select
            data-testid="select-engine"
            value={source}
            onChange={(e) => setSource(e.target.value as any)}
            className="w-full px-2.5 py-2.5 rounded-xl bg-[#070A0F] border border-white/[0.08] text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
          >
            <option value="live_google_maps">Real-Time Google Maps (Browser)</option>
            <option value="serpapi">SerpAPI (Google Maps API)</option>
            <option value="apify">Apify Actor API</option>
            <option value="outscraper">Outscraper API</option>
            <option value="mock">Simulated (Zero Cost)</option>
          </select>
        </div>

        {/* Launch Button */}
        <div className="md:col-span-2 flex items-end">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold tracking-wide flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all active:scale-95 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Auditing Live...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span>Launch Discovery</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
