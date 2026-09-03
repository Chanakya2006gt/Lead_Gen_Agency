import { GoogleEvidence } from "@/core/db/schema";

export interface OutreachValidationInput {
  name: string;
  category?: string | null;
  domain?: string | null;
  googleEvidence: GoogleEvidence;
  coreAngle: string;
  whatsappCopy: string;
  coldEmailCopy: string;
  phoneScript: string;
  whyPoints: string[];
}

export interface ValidatedOutreach {
  whatsappCopy: string;
  coldEmailCopy: string;
  phoneScript: string;
  whyPoints: string[];
  claimsSanitized: boolean;
}

export class OutreachClaimValidator {
  private static readonly UNVERIFIED_CLAIM_PATTERNS = [
    /\b[0-9.]+\s*★/gi,
    /\b[0-9.]+\s*stars?\b/gi,
    /\b\d+\s*(?:Google\s*)?reviews?\b/gi,
    /verified\s*reviews?/gi,
    /Google\s*Maps\s*(?:listing|profile|rating|reviews?)/gi,
    /strong\s*established\s*reputation/gi,
    /high\s*customer\s*demand/gi,
    /purchasing\s*power/gi,
    /congratulations\s*on\s*(?:maintaining|the)\s*(?:a\s*)?[0-9.]+/gi,
  ];

  public static validate(input: OutreachValidationInput): ValidatedOutreach {
    const isGoogleVerified =
      input.googleEvidence.status === "VERIFIED" &&
      typeof input.googleEvidence.rating === "number" &&
      input.googleEvidence.rating !== null &&
      typeof input.googleEvidence.reviewCount === "number" &&
      input.googleEvidence.reviewCount !== null;

    if (isGoogleVerified) {
      return {
        whatsappCopy: input.whatsappCopy,
        coldEmailCopy: input.coldEmailCopy,
        phoneScript: input.phoneScript,
        whyPoints: input.whyPoints,
        claimsSanitized: false,
      };
    }

    // Google entity is NOT verified - Strictly purge any rating or Google review claims
    let whatsappCopy = input.whatsappCopy;
    let coldEmailCopy = input.coldEmailCopy;
    let phoneScript = input.phoneScript;
    let whyPoints = input.whyPoints.filter((pt) => {
      return !this.UNVERIFIED_CLAIM_PATTERNS.some((pattern) => pattern.test(pt));
    });

    for (const pattern of this.UNVERIFIED_CLAIM_PATTERNS) {
      whatsappCopy = whatsappCopy.replace(pattern, "");
      coldEmailCopy = coldEmailCopy.replace(pattern, "");
      phoneScript = phoneScript.replace(pattern, "");
    }

    // Clean up empty parentheses, multiple spaces, or orphaned commas
    whatsappCopy = whatsappCopy
      .replace(/\(\s*,?\s*\)/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    coldEmailCopy = coldEmailCopy
      .replace(/\(\s*,?\s*\)/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    phoneScript = phoneScript
      .replace(/\(\s*,?\s*\)/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Replace unverified generic greetings with clean website-first hooks
    const domainDisplay = input.domain || "your website";

    whatsappCopy = whatsappCopy
      .replace(/I was reviewing your Google Maps listing \([^)]*\)/gi, `I was analyzing ${domainDisplay}`)
      .replace(/I was reviewing your Google Maps listing/gi, `I was analyzing ${domainDisplay}`)
      .replace(/I was reviewing your/gi, `I was analyzing ${domainDisplay}`);

    coldEmailCopy = coldEmailCopy
      .replace(/while researching top-rated [^—]+—congratulations on maintaining a [^.\n]+/gi, `while reviewing ${domainDisplay}`)
      .replace(/on your Google Maps profile/gi, `on ${domainDisplay}`);

    phoneScript = phoneScript
      .replace(/looking up [^—]+ on Google Maps—congratulations on the [^!]+!/gi, `reviewing ${domainDisplay}`)
      .replace(/on Google Maps/gi, `on ${domainDisplay}`);

    return {
      whatsappCopy: whatsappCopy.trim(),
      coldEmailCopy: coldEmailCopy.trim(),
      phoneScript: phoneScript.trim(),
      whyPoints,
      claimsSanitized: true,
    };
  }
}
