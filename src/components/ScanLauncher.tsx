"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  Loader2,
  MapPin,
  Square,
  Navigation,
  Stethoscope,
  Hammer,
  Wind,
  Sun,
  Sparkles,
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

const HIGH_TICKET_NICHES = [
  { niche: "Dental Clinics", icon: Stethoscope },
  { niche: "Roofing Contractors", icon: Hammer },
  { niche: "HVAC Specialists", icon: Wind },
  { niche: "Solar Installers", icon: Sun },
  { niche: "Cosmetic Surgery", icon: Sparkles },
  { niche: "Luxury Hair Salons", icon: Scissors },
];

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

export function ScanLauncher({ onScanLaunched, onCancelScan, isLoading, activeScanId }: ScanLauncherProps) {
  const initialCity = useMemo(() => getInitialCityFromTimezone(), []);
  const [niche, setNiche] = useState("Dental Clinics");
  const [location, setLocation] = useState(initialCity);
  const [radiusKm, setRadiusKm] = useState(15);
  const [source, setSource] = useState<
    "google_places" | "live_google_maps" | "serpapi" | "mock" | "apify" | "outscraper"
  >("google_places");

  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(location.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setPredictions(data.predictions || []);
          if (isFocused && data.predictions?.length > 0) {
            setShowDropdown(true);
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

  return (
    <div className="card-surface p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            Prospect Discovery &amp; Qualification
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingests real businesses, filters by reputation (&ge; 4.0★, &ge; 50 reviews), and audits digital surface gaps.
          </p>
        </div>

        {/* Preset Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {HIGH_TICKET_NICHES.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setNiche(p.niche);
                setShowDropdown(false);
              }}
              className={`px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                niche === p.niche
                  ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/40"
                  : "bg-white/[0.03] hover:bg-white/[0.07] text-slate-400 hover:text-slate-200 border border-white/[0.06]"
              }`}
            >
              {p.niche}
            </button>
          ))}
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

      <form id="scan-launcher-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Niche Input */}
        <div className="md:col-span-4">
          <label className="block text-[11px] text-slate-400 font-medium mb-1">
            Target Industry / Niche
          </label>
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="e.g. Dental Clinics, HVAC, Roofing"
            required
            className="w-full px-3.5 py-2 rounded-lg bg-[#07090E] border border-white/[0.08] text-slate-100 text-xs focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Target City */}
        <div className="md:col-span-4 relative" ref={dropdownRef}>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-[11px] text-slate-400 font-medium">
              Target City
            </label>
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={isDetectingLocation}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              {isDetectingLocation ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Navigation className="w-2.5 h-2.5" />}
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
              className="w-full pl-8 pr-8 py-2 rounded-lg bg-[#07090E] border border-white/[0.08] text-slate-100 text-xs focus:outline-none focus:border-indigo-500 transition"
            />
            <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            {isSearchingPlaces && (
              <Loader2 className="w-3 h-3 text-slate-400 animate-spin absolute right-2.5 top-2.5" />
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown && predictions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#0E1118] border border-white/[0.12] rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-white/[0.04]">
              {predictions.map((p, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectPrediction(p)}
                  className="p-2.5 hover:bg-white/[0.06] cursor-pointer transition flex items-start gap-2 text-xs"
                >
                  <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span className="text-slate-200 truncate">{p.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Engine Selector */}
        <div className="md:col-span-2">
          <label className="block text-[11px] text-slate-400 font-medium mb-1">
            Data Source
          </label>
          <select
            data-testid="select-engine"
            value={source}
            onChange={(e) => setSource(e.target.value as any)}
            className="w-full px-2.5 py-2 rounded-lg bg-[#07090E] border border-white/[0.08] text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="google_places">Google Places API</option>
            <option value="live_google_maps">Google Maps (Live)</option>
            <option value="serpapi">SerpAPI Maps</option>
            <option value="apify">Apify Actor</option>
            <option value="outscraper">Outscraper</option>
          </select>
        </div>

        {/* Submit Button */}
        <div className="md:col-span-2 flex items-end gap-2">
          {isLoading ? (
            <>
              <button
                type="button"
                disabled
                className="flex-1 py-2 px-3 rounded-lg bg-indigo-600/30 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-wait"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Scanning...</span>
              </button>
              {onCancelScan && (
                <button
                  type="button"
                  onClick={onCancelScan}
                  data-testid="btn-cancel-scan"
                  className="py-2 px-3 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                >
                  <Square className="w-3 h-3 fill-rose-400" />
                  <span>Stop</span>
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              data-testid="btn-launch-discovery"
              onClick={handleSubmit}
              className="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Run Discovery</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
