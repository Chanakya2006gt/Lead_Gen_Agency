"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, Sparkles, MapPin, Sliders, Globe, Radio, Flame, ShieldAlert, Cpu, ArrowRight, Check } from "lucide-react";

interface ScanLauncherProps {
  onScanLaunched: (scanId: string) => void;
  isLoading: boolean;
}

interface PlacePrediction {
  description: string;
  place_id: string;
  main_text?: string;
  secondary_text?: string;
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
    "google_places" | "live_google_maps" | "serpapi" | "mock" | "apify" | "outscraper"
  >("google_places");

  // Autocomplete state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced Place Autocomplete Query
  useEffect(() => {
    if (!isFocused || !location.trim() || location.length < 2) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(location.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setPredictions(data.predictions || []);
          if (isFocused && data.predictions?.length > 0) {
            setShowDropdown(true);
          }
        }
      } catch (err) {
        console.error("Failed to fetch autocomplete predictions:", err);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [location, isFocused]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPrediction = (prediction: PlacePrediction) => {
    setLocation(prediction.description);
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim() || !location.trim()) return;
    setShowDropdown(false);

    try {
      setErrorMessage(null);
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
      setErrorMessage(err.message);
    }
  };

  const applyPreset = (p: { niche: string; location: string; radius: number }) => {
    setNiche(p.niche);
    setLocation(p.location);
    setRadiusKm(p.radius);
    setShowDropdown(false);
  };

  return (
    <div className="double-bezel-outer relative overflow-visible group">
      {/* Dynamic Ambient Radial Mesh (10% Accent Layer) */}
      <div className="absolute -top-12 right-1/4 w-96 h-48 bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none transition-all duration-700 group-hover:scale-110" />

      <div className="double-bezel-inner p-6 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              <h2 className="text-xs uppercase font-mono font-bold tracking-widest text-indigo-300">
                DISCOVERY &amp; AUDIT PIPELINE
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Search any city worldwide. Ingests verified businesses, validates rating &ge; 4.0★ &amp; reviews &ge; 50, and performs headless DOM audits.
            </p>
          </div>

          {/* Quick Market Presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-mono text-[10px] uppercase font-bold mr-1">Quick Markets:</span>
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-indigo-600/20 hover:text-indigo-300 border border-white/[0.08] hover:border-indigo-500/40 text-slate-300 transition-all duration-200 text-xs font-semibold active:scale-95 cursor-pointer shadow-sm"
              >
                {p.niche} · <span className="text-slate-500 font-mono">{p.location.split(",")[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-0.5"
            >
              Dismiss
            </button>
          </div>
        )}

        <form id="scan-launcher-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3.5 relative">
          {/* Niche Input */}
          <div className="md:col-span-4">
            <label className="block text-[10px] font-mono uppercase text-slate-400 font-bold mb-1.5">
              Target Vertical / Niche
            </label>
            <div className="relative">
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. Dental Clinics, HVAC, Roofing"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-[#06080D] border border-white/[0.08] text-slate-100 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition font-medium shadow-inner"
              />
            </div>
          </div>

          {/* Target City with Real-Time Google Places Autocomplete */}
          <div className="md:col-span-3 relative" ref={dropdownRef}>
            <label className="block text-[10px] font-mono uppercase text-slate-400 font-bold mb-1.5 flex justify-between">
              <span>Target City (Search Worldwide)</span>
              {isSearchingPlaces && <span className="text-[10px] text-indigo-400 font-mono animate-pulse">Searching Google...</span>}
            </label>
            <div className="relative">
              <input
                type="text"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setIsFocused(true);
                }}
                onFocus={() => {
                  setIsFocused(true);
                  if (predictions.length > 0) setShowDropdown(true);
                }}
                placeholder="Type any city (e.g. Warangal, Dallas, London)"
                required
                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-[#06080D] border border-white/[0.08] text-slate-100 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition font-medium shadow-inner"
              />
              <MapPin className="w-4 h-4 text-indigo-400 absolute left-3 top-2.5" />
              {isSearchingPlaces && (
                <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin absolute right-3 top-3" />
              )}
            </div>

            {/* Live Autocomplete Dropdown List */}
            {showDropdown && predictions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0B101D] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-2 border-b border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
                  <span>Google Places Suggestions</span>
                  <span className="text-emerald-400">Live API</span>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-white/[0.04]">
                  {predictions.map((p, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectPrediction(p)}
                      className="p-3 hover:bg-indigo-600/20 hover:text-indigo-200 cursor-pointer transition flex items-start gap-2.5 select-none"
                    >
                      <MapPin className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          {p.main_text || p.description}
                        </div>
                        {p.secondary_text && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5 font-normal">
                            {p.secondary_text}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Radius Slider */}
          <div className="md:col-span-2">
            <label className="block text-[10px] font-mono uppercase text-slate-400 font-bold mb-1.5 flex justify-between">
              <span>Radius</span>
              <span className="text-indigo-400 font-mono font-extrabold">{radiusKm} km</span>
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
            <label className="block text-[10px] font-mono uppercase text-slate-400 font-bold mb-1.5">
              Engine
            </label>
            <select
              data-testid="select-engine"
              value={source}
              onChange={(e) => setSource(e.target.value as any)}
              className="w-full px-2 py-2.5 rounded-xl bg-[#06080D] border border-white/[0.08] text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
            >
              <option value="google_places">Google Places API (Direct Key)</option>
              <option value="live_google_maps">Real-Time Maps (Browser)</option>
              <option value="serpapi">SerpAPI (Google Maps API)</option>
              <option value="apify">Apify Actor API</option>
              <option value="outscraper">Outscraper API</option>
              <option value="mock">Simulated (Zero Cost)</option>
            </select>
          </div>

          {/* Button-in-Button Launch CTA */}
          <div className="md:col-span-2 flex items-end">
            <button
              type="button"
              data-testid="btn-launch-discovery"
              onClick={handleSubmit}
              disabled={isLoading}
              className="group w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold tracking-wide flex items-center justify-between shadow-[0_0_25px_rgba(99,102,241,0.35)] transition-all duration-300 active:scale-[0.98] cursor-pointer"
            >
              <span>{isLoading ? "Auditing Live..." : "Launch Discovery"}</span>
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                )}
              </div>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
