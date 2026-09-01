import { describe, it, expect } from "vitest";
import { GooglePlacesApiAdapter } from "@/features/discovery/GooglePlacesApiAdapter";

describe("GooglePlacesApiAdapter Unit Tests", () => {
  it("Returns empty array gracefully when API key is missing or not provided", async () => {
    const adapter = new GooglePlacesApiAdapter("");
    const results = await adapter.discover({
      niche: "Dental Clinics",
      location: "Warangal",
    });

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  it("Adapter name is GooglePlacesApiAdapter", () => {
    const adapter = new GooglePlacesApiAdapter("test_key");
    expect(adapter.name).toBe("GooglePlacesApiAdapter");
  });
});
