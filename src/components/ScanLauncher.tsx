"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  Loader2,
  MapPin,
  Square,
  Navigation,
  Globe,
  Zap,
  Sparkles,
} from "lucide-react";
import { Lead } from "@/core/db/schema";
import { DiscoveryMode } from "@/features/discovery/types";

interface ScanLauncherProps {
  onScanLaunched: (scanId: string) => void;
  onDirectAuditCompleted?: (lead: Lead) => void;
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

interface MarketSuggestion {
  label: string;
  category: string;
  reason: string;
  confidence: number;
}

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
    if (tz.includes("London")) {
      return "London, UK";
    }
    if (tz.includes("Dubai")) {
      return "Dubai, UAE";
    }
  } catch {}
  return "Warangal, Telangana, India";
}

export function ScanLauncher({
  onScanLaunched,
  onDirectAuditCompleted,
  onCancelScan,
  isLoading,
  activeScanId,
}: ScanLauncherProps) {
  const [activeMode, setActiveMode] = useState<"discovery" | "direct">("discovery");

  // Discovery Mode State
  const initialCity = useMemo(() => getInitialCityFromTimezone(), []);
  const [niche, setNiche] = useState("Dental Clinics");
  const [location, setLocation] = useState(initialCity);
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>("COMMERCIAL");
  const [radiusKm, setRadiusKm] = useState(15);
  const [source, setSource] = useState<
    "google_places" | "live_google_maps" | "serpapi" | "mock" | "apify" | "outscraper"
  >("google_places");

  // Market Suggestions State (Backend-driven)
  const [marketSuggestions, setMarketSuggestions] = useState<MarketSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Direct URL Teardown Mode State
  const [directUrl, setDirectUrl] = useState("");
  const [directName, setDirectName] = useState("");
  const [directCategory, setDirectCategory] = useState("");
  const [isAuditingDirect, setIsAuditingDirect] = useState(false);

  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch Market-Aware Suggestions from backend whenever location changes
  useEffect(() => {
    if (!location.trim() || location.length < 2) return;

    const timer = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const res = await fetch(`/api/discovery/suggestions?location=${encodeURIComponent(location.trim())}`);
        if (res.ok) {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            setMarketSuggestions(data.suggestions || []);
          } catch {
            // Non-JSON response
          }
        }
      } catch {
        // Fallback
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [location]);

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

          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
            { headers: { Accept: "application/json" } }
          );
          if (res.ok) {
            const text = await res.text();
            try {
              const data = JSON.parse(text);
              const address = data.address || {};
              const city =
                address.city ||
                address.town ||
                address.village ||
                address.county ||
                address.state_district ||
                "Detected City";
              const state = address.state || "";
              const country = address.country || "";
              const fullLoc = [city, state, country].filter(Boolean).join(", ");
              setLocation(fullLoc);
            } catch {
              setLocation(getInitialCityFromTimezone());
            }
          } else {
            setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        } catch {
          setLocation(getInitialCityFromTimezone());
        } finally {
          setIsDetectingLocation(false);
        }
      },
      () => {
        setIsDetectingLocation(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if (!isFocused || !location.trim() || location.length < 2) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const res = await fetch(
          `/api/places/autocomplete?input=${encodeURIComponent(location.trim())}`
        );
        if (res.ok) {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            setPredictions(data.predictions || []);
            if (isFocused && data.predictions?.length > 0) {
              setShowDropdown(true);
            }
          } catch {
            // Non-JSON response
          }
        }
      } catch {
        // Fallback
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [location, isFocused]);

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

  const handleDiscoverySubmit = async (e?: React.SyntheticEvent) => {
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
          mode: discoveryMode,
        }),
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned non-JSON response (${res.status}).`);
      }

      if (!res.ok) {
        throw new Error(data?.error || `Failed to launch scan (${res.status})`);
      }

      onScanLaunched(data.scanId);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleDirectAuditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directUrl.trim()) return;

    setIsAuditingDirect(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/audit/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: directUrl.trim(),
          name: directName.trim() || null,
          category: directCategory.trim() || null,
          location,
          persist: false,
        }),
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned non-JSON response (${res.status}).`);
      }

      if (!res.ok) {
        throw new Error(data?.error || `Failed to audit website (${res.status})`);
      }

      if (onDirectAuditCompleted && data.lead) {
        onDirectAuditCompleted(data.lead);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsAuditingDirect(false);
    }
  };

  return (
    <div className="card-surface p-5">
      {/* Top Header & Mode Toggle Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>Market Discovery &amp; Commercial Scoping</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeMode === "discovery"
              ? "Constructs a bounded DiscoveryPlan from market context, filters non-commercial entities, and audits live websites."
              : "Instant on-demand technical teardown and commercial economics synthesis for any single website."}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-black/40 border border-white/[0.08] self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              setActiveMode("discovery");
              setErrorMessage(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeMode === "discovery"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Market Discovery Scan</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode("direct");
              setErrorMessage(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeMode === "direct"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Instant URL Teardown</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-slate-400 hover:text-white text-xs px-2 py-0.5 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* MODE 1: Market Discovery Scan Form */}
      {activeMode === "discovery" && (
        <div>
          {/* Dynamic Market-Aware Suggestions */}
          {marketSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs mb-3">
              <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>Suggested Industries:</span>
              </span>
              {marketSuggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  title={s.reason}
                  onClick={() => {
                    setNiche(s.label);
                    setShowDropdown(false);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs transition cursor-pointer flex items-center gap-1.5 ${
                    niche === s.label
                      ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/40"
                      : "bg-white/[0.03] hover:bg-white/[0.07] text-slate-400 hover:text-slate-200 border border-white/[0.06]"
                  }`}
                >
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          )}

          <form
            id="scan-launcher-form"
            onSubmit={handleDiscoverySubmit}
            className="grid grid-cols-1 md:grid-cols-12 gap-3"
          >
            {/* Niche Input */}
            <div className="md:col-span-4">
              <label className="block text-[11px] text-slate-400 font-medium mb-1">
                Target Industry / Niche
              </label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. Dental Clinics, HVAC, Luxury Salons"
                required
                className="w-full px-3.5 py-2 rounded-lg bg-slate-900/60 backdrop-blur-md border border-white/[0.12] text-slate-100 text-xs focus:outline-none focus:border-indigo-400 transition"
              />
            </div>

            {/* Target City */}
            <div className="md:col-span-3 relative" ref={dropdownRef}>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] text-slate-400 font-medium">
                  Target Market / City
                </label>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={isDetectingLocation}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  {isDetectingLocation ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <Navigation className="w-2.5 h-2.5" />
                  )}
                  <span>{isDetectingLocation ? "Detecting..." : "Auto-Detect"}</span>
                </button>
              </div>
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
                  placeholder="Type any city (e.g. Hyderabad, Dallas, London)"
                  required
                  className="w-full pl-8 pr-8 py-2 rounded-lg bg-slate-900/60 backdrop-blur-md border border-white/[0.12] text-slate-100 text-xs focus:outline-none focus:border-indigo-400 transition"
                />
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                {isSearchingPlaces && (
                  <Loader2 className="w-3 h-3 text-slate-400 animate-spin absolute right-2.5 top-2.5" />
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {showDropdown && predictions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#0F172A] border border-white/[0.15] rounded-lg shadow-2xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-white/[0.06] backdrop-blur-xl">
                  {predictions.map((p, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectPrediction(p)}
                      className="p-2.5 hover:bg-white/[0.08] cursor-pointer transition flex items-start gap-2 text-xs"
                    >
                      <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span className="text-slate-200 truncate">{p.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Discovery Mode Selector */}
            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-400 font-medium mb-1">
                Discovery Mode
              </label>
              <select
                value={discoveryMode}
                onChange={(e) => setDiscoveryMode(e.target.value as DiscoveryMode)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-900/60 backdrop-blur-md border border-white/[0.12] text-slate-200 text-xs focus:outline-none focus:border-indigo-400 cursor-pointer font-mono"
              >
                <option value="STANDARD">STANDARD (≤30)</option>
                <option value="COMMERCIAL">COMMERCIAL (≤60)</option>
                <option value="EXHAUSTIVE">EXHAUSTIVE (≤120)</option>
              </select>
            </div>

            {/* Engine Selector */}
            <div className="md:col-span-1">
              <label className="block text-[11px] text-slate-400 font-medium mb-1">
                Provider
              </label>
              <select
                data-testid="select-engine"
                value={source}
                onChange={(e) => setSource(e.target.value as any)}
                className="w-full px-2 py-2 rounded-lg bg-slate-900/60 backdrop-blur-md border border-white/[0.12] text-slate-200 text-xs focus:outline-none focus:border-indigo-400 cursor-pointer"
              >
                <option value="google_places">Google</option>
                <option value="live_google_maps">Live</option>
                <option value="serpapi">SerpAPI</option>
                <option value="apify">Apify</option>
              </select>
            </div>

            {/* Submit & Action Controls */}
            <div className="md:col-span-2 flex items-end gap-2">
              {isLoading ? (
                <div className="flex items-center gap-1.5 w-full">
                  <button
                    data-testid="btn-launch-discovery"
                    disabled
                    className="flex-1 py-2 px-2 rounded-lg bg-indigo-600/80 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed opacity-90 shadow-lg shadow-indigo-950/40"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Scanning...</span>
                  </button>
                  {onCancelScan && (
                    <button
                      type="button"
                      onClick={onCancelScan}
                      title="Cancel active scan"
                      className="py-2 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center justify-center gap-1 transition cursor-pointer shadow-lg shadow-rose-900/30 shrink-0"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  data-testid="btn-launch-discovery"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-indigo-900/30 disabled:opacity-50"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Scan Market</span>
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* MODE 2: Instant Single URL Teardown Form */}
      {activeMode === "direct" && (
        <form onSubmit={handleDirectAuditSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Target Website URL */}
          <div className="md:col-span-5">
            <label className="block text-[11px] text-slate-400 font-medium mb-1 flex items-center gap-1">
              <Globe className="w-3 h-3 text-emerald-400" />
              <span>Target Website URL</span>
            </label>
            <input
              type="text"
              value={directUrl}
              onChange={(e) => setDirectUrl(e.target.value)}
              placeholder="e.g. sowjanyadental.com or https://company.in"
              required
              className="w-full px-3.5 py-2 rounded-lg bg-slate-900/60 backdrop-blur-md border border-white/[0.12] text-slate-100 text-xs focus:outline-none focus:border-emerald-400 transition"
            />
          </div>

          {/* Optional Business Name */}
          <div className="md:col-span-3">
            <label className="block text-[11px] text-slate-400 font-medium mb-1">
              Business Name (Optional)
            </label>
            <input
              type="text"
              value={directName}
              onChange={(e) => setDirectName(e.target.value)}
              placeholder="Auto-detected from domain if empty"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-900/60 backdrop-blur-md border border-white/[0.12] text-slate-100 text-xs focus:outline-none focus:border-emerald-400 transition"
            />
          </div>

          {/* Optional Category */}
          <div className="md:col-span-2">
            <label className="block text-[11px] text-slate-400 font-medium mb-1">
              Category
            </label>
            <input
              type="text"
              value={directCategory}
              onChange={(e) => setDirectCategory(e.target.value)}
              placeholder="Auto-detected if empty (e.g. Dental Clinic)"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-900/60 backdrop-blur-md border border-white/[0.12] text-slate-100 text-xs focus:outline-none focus:border-emerald-400 transition"
            />
          </div>

          {/* Submit Button */}
          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={isAuditingDirect || !directUrl.trim()}
              className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-900/20 disabled:opacity-50"
            >
              {isAuditingDirect ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Auditing...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Run Teardown</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
