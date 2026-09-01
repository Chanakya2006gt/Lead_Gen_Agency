import { describe, it, expect } from "vitest";
import { GooglePlacesApiAdapter } from "@/features/discovery/GooglePlacesApiAdapter";

describe("GooglePlacesApiAdapter Unit Tests", () => {
  it("Throws explicit error when API key is missing or not provided", async () => {
    const adapter = new GooglePlacesApiAdapter("");
    await expect(
      adapter.discover({
        niche: "Dental Clinics",
        location: "Warangal",
      })
    ).rejects.toThrow(/GOOGLE_MAPS_API_KEY is not configured/);
  });

  it("Adapter name is GooglePlacesApiAdapter", () => {
    const adapter = new GooglePlacesApiAdapter("test_key");
    expect(adapter.name).toBe("GooglePlacesApiAdapter");
  });
});
