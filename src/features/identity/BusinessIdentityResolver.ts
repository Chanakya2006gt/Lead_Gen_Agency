import crypto from "crypto";

export interface IdentityInputs {
  name: string;
  formattedAddress?: string | null;
  phone?: string | null;
  googleMapsUrl?: string | null;
}

export class BusinessIdentityResolver {
  /**
   * Attempts to extract a permanent Google Feature Hex ID (0x...:0x...) or Place CID from a Google Maps URL.
   * Google Maps URLs contain permanent feature IDs such as:
   * - /data=!4m7!3m6!1s0x3bcb9046c82d9a69:0x892a7e7bbd564cf7!...
   * - ?cid=9883713028323214583
   * - /place/?q=place_id:ChIJ...
   * - ?ftid=0x3bcb...:0xabcd...
   */
  public static extractGooglePlaceId(url?: string | null): string | null {
    if (!url) return null;

    try {
      // 1. Direct Place ID query (e.g. ?q=place_id:ChIJ...)
      const placeIdMatch = url.match(/place_id[=:]\s*([a-zA-Z0-9_\-]+)/i);
      if (placeIdMatch && placeIdMatch[1]) {
        return `gplace_${placeIdMatch[1]}`;
      }

      // 2. Google Maps Hex Feature ID (e.g. 1s0x3bcb9046c82d9a69:0x892a7e7bbd564cf7 or ftid=0x...:0x...)
      const hexFeatureMatch = url.match(/(0x[0-9a-f]+:0x[0-9a-f]+)/i);
      if (hexFeatureMatch && hexFeatureMatch[1]) {
        return `gfeat_${hexFeatureMatch[1].toLowerCase()}`;
      }

      // 3. Customer ID parameter (e.g. ?cid=1234567890123456789)
      const cidMatch = url.match(/[?&]cid=([0-9]+)/i);
      if (cidMatch && cidMatch[1]) {
        return `gcid_${cidMatch[1]}`;
      }

      // 4. Data-record 1s parameter without explicit colon
      const dataParamMatch = url.match(/!1s(0x[0-9a-f]+)/i);
      if (dataParamMatch && dataParamMatch[1]) {
        return `gfeat_${dataParamMatch[1].toLowerCase()}`;
      }
    } catch {
      // Fallback
    }

    return null;
  }

  /**
   * Builds a persistent, deterministic SHA-256 identifier based on Unicode-normalized business signals.
   * Guaranteed to return the exact same identifier across searches today, next week, or next year.
   */
  public static buildDeterministicId(
    name: string,
    formattedAddress?: string | null,
    phone?: string | null
  ): string {
    const normalize = (val?: string | null) =>
      (val || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();

    const cleanName = normalize(name);
    const cleanAddress = normalize(formattedAddress);
    // Normalize phone to last 10 digits if available to handle international prefixes consistently
    const rawDigits = (phone || "").replace(/\D+/g, "");
    const cleanPhone = rawDigits.length >= 10 ? rawDigits.slice(-10) : rawDigits;

    const seed = `${cleanName}|${cleanAddress}|${cleanPhone}`;
    const hash = crypto.createHash("sha256").update(seed, "utf8").digest("hex").slice(0, 24);

    return `det_${hash}`;
  }

  /**
   * Resolves a canonical, stable business identity.
   * Priority: Official Google Place/Feature ID > Deterministic SHA-256 seed.
   */
  public static resolveId(inputs: IdentityInputs): string {
    const extractedGoogleId = this.extractGooglePlaceId(inputs.googleMapsUrl);
    if (extractedGoogleId) {
      return extractedGoogleId;
    }

    return this.buildDeterministicId(inputs.name, inputs.formattedAddress, inputs.phone);
  }

  /**
   * Secondary Entity Linking across disparate scrapers / adapters:
   * 1. Exact Canonical Place ID match
   * 2. Phone Match (last 10 digits) + Name prefix similarity match
   */
  public static findMatchingLead(
    inputs: IdentityInputs,
    existingLeads: Array<{ id: string; placeId: string; name: string; phone: string | null; formattedAddress: string | null }>
  ): { id: string; placeId: string } | null {
    const canonicalId = this.resolveId(inputs);

    // 1. Exact Place ID match
    const exact = existingLeads.find((l) => l.placeId === canonicalId);
    if (exact) return exact;

    // 2. Secondary Link: Phone Number + Name Similarity
    const rawDigits = (inputs.phone || "").replace(/\D+/g, "");
    const cleanPhone = rawDigits.length >= 10 ? rawDigits.slice(-10) : "";

    if (cleanPhone) {
      const phoneMatch = existingLeads.find((l) => {
        const existingDigits = (l.phone || "").replace(/\D+/g, "");
        const existingCleanPhone = existingDigits.length >= 10 ? existingDigits.slice(-10) : "";
        if (!existingCleanPhone || existingCleanPhone !== cleanPhone) return false;

        const normIncoming = inputs.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        const normExisting = l.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        return normIncoming.includes(normExisting.slice(0, 5)) || normExisting.includes(normIncoming.slice(0, 5));
      });

      if (phoneMatch) return phoneMatch;
    }

    return null;
  }
}
