import { RawBusinessInput } from "./UniversalFilterService";

export interface CommercialEntityFilterResult {
  isCommercial: boolean;
  exclusionReason?: string;
}

export class CommercialEntityFilter {
  private static readonly NON_COMMERCIAL_PATTERNS: { regex: RegExp; reason: string }[] = [
    {
      regex: /\b(college|university|institute of dental|school of dentistry|academy|faculty of|polytechnic)\b/i,
      reason: "Educational / Academic Institution (Not a private commercial operating business)",
    },
    {
      regex: /\b(government|govt|dispensary|district hospital|civil hospital|state health|municipal|esic|cantonment|primary health centre|phc)\b/i,
      reason: "Government / Public Sector Healthcare Institution",
    },
    {
      regex: /\b(association|society|board|council|federation|trust|charitable trust|foundation|ngo|union)\b/i,
      reason: "Non-Profit / Professional Association / Regulatory Body",
    },
    {
      regex: /\b(equipment|supplies|surgical supplies|dental lab|materials depot|distributors|wholesalers)\b/i,
      reason: "B2B Supply / Equipment Wholesale (Not consumer or direct client operating business)",
    },
  ];

  /**
   * Filter candidates to ensure only operating commercial entities enter qualification
   */
  public static evaluate(candidate: RawBusinessInput): CommercialEntityFilterResult {
    const textToInspect = `${candidate.name} ${candidate.category || ""} ${candidate.formattedAddress || ""}`.toLowerCase();

    for (const pattern of this.NON_COMMERCIAL_PATTERNS) {
      if (pattern.regex.test(textToInspect)) {
        return {
          isCommercial: false,
          exclusionReason: pattern.reason,
        };
      }
    }

    return {
      isCommercial: true,
    };
  }
}
