"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  Loader2,
  Sparkles,
  MapPin,
  Square,
  Navigation,
  Check,
  Building2,
  Stethoscope,
  Hammer,
  Wind,
  Sun,
  Scissors
} from "lucide-react";

interface ScanLauncherProps {
  onScanLaunched: (scanId: string) => void;
  onCancelScan?: () => void;
  isLoading: boolean;
  activeScanId?: string | null;
}

interface PlacePrediction {
  description: string;
  place_id: string;
  main_text?: string;
  secondary_text?: string;
}

// High-ticket service verticals for local client acquisition
const HIGH_TICKET_NICHES = [
  { niche: "Dental Clinics", icon: Stethoscope, tag: "Healthcare" },
  { niche: "Roofing Contractors", icon: Hammer, tag: "Home Services" },
  { niche: "HVAC Specialists", icon: Wind, tag: "HVAC" },
  { niche: "Solar Installers", icon: Sun, tag: "Energy" },
  { niche: "Cosmetic Surgery", icon: Sparkles, tag: "Medical Spa" },
  { niche: "Luxury Hair Salons", icon: Scissors, tag: "Beauty & Spa" },
];

/**
 * Infer a regional city from the browser's timezone if GPS is not yet granted
 */
function getInitialCityFromTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.includes("Kolkata") || tz.includes("Calcutta") || tz.includes("India")) {
      return "Warangal, Telangana, India";
    }
    if (tz.includes("Chicago") || tz.includes("Central")) {
      return "Dallas, TX, USA";
    }
    if (tz.includes("New_York") || tz.includes("Eastern")) {
      return "New York, NY, USA";
    }
    if (tz.includes("Los_Angeles") || tz.includes("Pacific")) {
      return "Los Angeles, CA, USA";
    }
    if (tz.includes("Phoenix") || tz.includes("Denver")) {
      return "Phoenix, AZ, USA";
    }
    if (tz.includes("London") || tz.includes("Europe/London")) {
      return "London, UK";
    }
    if (tz.includes("Paris") || tz.includes("Berlin")) {
      return "Berlin, Germany";
    }
    if (tz.includes("Sydney") || tz.includes("Melbourne")) {
      return "Sydney, Australia";
    }
    if (tz.includes("Dubai")) {
      return "Dubai, UAE";
    }
    if (tz.includes("Singapore")) {
      return "Singapore";
    }
  } catch {}
  return "Warangal, Telangana, India";
}

export function ScanLauncher({ onScanLaunched, onCancelScan, isLoading, activeScanId }: ScanLauncherProps) {
  const initialCity = useMemo(() => getInitialCityFromTimezone(), []);
  const [niche, setNiche] = useState("Dental Clinics");
  const [location, setLocation] = useState(initialCity);
  const [radiusKm, setRadiusKm] = useState(15);
  const [source, setSource] = useState<
    "google_places" | "live_google_maps" | "serpapi" | "mock" | "apify" | "outscraper"
  >("google_places");

  // Geolocation & Auto-Detect state
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationDetected, setLocationDetected] = useState(false);

  // Autocomplete state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Extract a clean display city name for presets (e.g. "Warangal" from "Warangal, Telangana, India")
  const currentCityShort = useMemo(() => {
    if (!location.trim()) return "Local Market";
    const parts = location.split(",");
    return parts[0].trim();
  }, [location]);

  // Dynamically generate high-ticket niche presets for the active city
  const dynamicPresets = useMemo(() => {
    return HIGH_TICKET_NICHES.map((item) => ({
      niche: item.niche,
      location: location.trim() || initialCity,
      radius: item.niche === "Solar Installers" || item.niche === "Roofing Contractors" ? 25 : 15,
      tag: item.tag,
      icon: item.icon,
    }));
  }, [location, initialCity]);

  // Request browser GPS position and reverse-geocode
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage("Geolocation is not supported by your browser.");
      return;
    }

    setIsDetectingLocation(true);
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          // Reverse geocode with OpenStreetMap Nominatim (Free, no key required)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`
          );
          if (res.ok) {
            const data = await res.json();
            const address = data.address || {};
            const city = address.city || address.town || address.village || address.county || address.state_district || "Detected City";
            const state = address.state || "";
            const country = address.country || "";
            const fullLoc = [city, state, country].filter(Boolean).join(", ");
            setLocation(fullLoc);
            setLocationDetected(true);
          } else {
            // Fallback to coordinates
            setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        } catch (err) {
          console.error("Failed to reverse geocode:", err);
          setLocation(getInitialCityFromTimezone());
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (err) => {
        console.warn("Geolocation permission dismissed/denied:", err.message);
        setIsDetectingLocation(false);
        // Retain current timezone-based location
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

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
    setIsFocused(false);
  };

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    if (e && e.preventDefault) e.preventDefault();
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
    setRadiusKm(p.radius);
    setShowDropdown(false);
  };

  return (
    <div className="double-bezel-outer relative overflow-visible group">
      {/* Dynamic Ambient Radial Mesh */}
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

          {/* Quick Markets Tailored to Current/Detected City */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-mono text-[10px] uppercase font-bold mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" /> High-Ticket Markets ({currentCityShort}):
            </span>
            {dynamicPresets.map((p, idx) => {
              const Icon = p.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 active:scale-95 cursor-pointer shadow-sm flex items-center gap-1.5 ${
                    niche === p.niche
                      ? "bg-indigo-600/30 border-indigo-500/60 text-indigo-200"
                      : "bg-white/[0.03] hover:bg-indigo-600/20 hover:text-indigo-300 border-white/[0.08] hover:border-indigo-500/40 text-slate-300"
                  }`}
                >
                  <Icon className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span>{p.niche}</span>
                </button>
              );
            })}
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

          {/* Target City with Real-Time Google Places Autocomplete & GPS Auto-Detect */}
          <div className="md:col-span-3 relative" ref={dropdownRef}>
            <label className="block text-[10px] font-mono uppercase text-slate-400 font-bold mb-1.5 flex justify-between items-center">
              <span>Target City (Worldwide)</span>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
                className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition"
                title="Detect exact GPS location"
              >
                {isDetectingLocation ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Navigation className="w-3 h-3 text-indigo-400" />
                )}
                <span>{isDetectingLocation ? "Detecting..." : "Auto-Detect"}</span>
              </button>
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

          {/* Launch & Stop Scan CTA Controls */}
          <div className="md:col-span-2 flex items-end gap-2">
            {isLoading ? (
              <>
                <button
                  type="button"
                  disabled
                  className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold tracking-wide flex items-center justify-center gap-2 cursor-wait"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>Auditing...</span>
                </button>

                {onCancelScan && (
                  <button
                    type="button"
                    onClick={onCancelScan}
                    data-testid="btn-cancel-scan"
                    className="py-2.5 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 hover:text-rose-200 text-xs font-bold transition flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-lg"
                    title="Halt current scan"
                  >
                    <Square className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                    <span>Stop</span>
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                data-testid="btn-launch-discovery"
                onClick={handleSubmit}
                className="group w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold tracking-wide flex items-center justify-between shadow-[0_0_25px_rgba(99,102,241,0.35)] transition-all duration-300 active:scale-[0.98] cursor-pointer"
              >
                <span>Launch Discovery</span>
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
