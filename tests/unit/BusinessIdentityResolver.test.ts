import { describe, it, expect } from "vitest";
import { BusinessIdentityResolver } from "@/features/identity/BusinessIdentityResolver";

describe("BusinessIdentityResolver (Stable Entity Identity)", () => {
  it("Extracts Google Maps Feature Hex IDs from full Maps URLs", () => {
    const mapsUrl =
      "https://www.google.com/maps/place/Arrow+Dental+Clinic/data=!4m7!3m6!1s0x3bcb9046c82d9a69:0x892a7e7bbd564cf7!8m2!3d17.9784!4d79.5941!16s%2Fg%2F11b8v3_456?hl=en";

    const placeId = BusinessIdentityResolver.extractGooglePlaceId(mapsUrl);
    expect(placeId).toBe("gfeat_0x3bcb9046c82d9a69:0x892a7e7bbd564cf7");
  });

  it("Extracts Google Place ID from query parameter URLs", () => {
    const mapsUrl = "https://www.google.com/maps/search/?api=1&query=Dental&query_place_id=ChIJN1t_tDeuEmsRUsoyG83frY4";
    const placeId = BusinessIdentityResolver.extractGooglePlaceId(mapsUrl);
    expect(placeId).toBe("gplace_ChIJN1t_tDeuEmsRUsoyG83frY4");
  });

  it("Extracts Google Customer ID (CID) from CID URLs", () => {
    const mapsUrl = "https://maps.google.com/?cid=9883713028323214583";
    const placeId = BusinessIdentityResolver.extractGooglePlaceId(mapsUrl);
    expect(placeId).toBe("gcid_9883713028323214583");
  });

  it("Generates a deterministic SHA-256 fallback ID that is identical across repeated runs", () => {
    const id1 = BusinessIdentityResolver.buildDeterministicId(
      "Arrow Dental Clinic",
      "H.No 1-2-3, Main Road, Warangal, Telangana 506001",
      "+91 98765 43210"
    );

    const id2 = BusinessIdentityResolver.buildDeterministicId(
      "arrow dental clinic", // casing variance
      "H.No 1-2-3, Main Road, Warangal, Telangana 506001",
      "9876543210" // phone formatting variance
    );

    expect(id1).toBe(id2);
    expect(id1.startsWith("det_")).toBe(true);
    expect(id1.length).toBe(28); // "det_" + 24 hex chars
  });

  it("Resolves Canonical ID with Google URL priority over deterministic hash", () => {
    const resolved = BusinessIdentityResolver.resolveId({
      name: "Sowjanya Dental",
      formattedAddress: "Warangal",
      phone: "+91 9999999999",
      googleMapsUrl: "https://www.google.com/maps/place/data=!4m2!3m1!1s0x3bcb9123:0x4567abcd",
    });

    expect(resolved).toBe("gfeat_0x3bcb9123:0x4567abcd");
  });
});
