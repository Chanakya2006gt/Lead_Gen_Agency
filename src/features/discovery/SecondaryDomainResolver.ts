/**
 * Secondary Domain Resolver & Entity Verification Engine
 * 
 * Automatically discovers unlinked official websites for businesses that lack a website
 * on their Google Maps / Google Business Profile (GBP), with zero new API keys.
 */

export interface BusinessEntityQuery {
  name: string;
  formattedAddress?: string | null;
  locationInput?: string | null;
  phone?: string | null;
}

export interface SecondaryDomainResult {
  verified: boolean;
  unlinkedWebsiteUrl: string | null;
  confidence: number;
  matchingSignals: string[];
}

export class SecondaryDomainResolver {
  // Comprehensive Aggregator, Directory & Registry Blacklist
  private static readonly DIRECTORY_DOMAINS: string[] = [
    "justdial.com",
    "practo.com",
    "indiamart.com",
    "sulekha.com",
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "mapsofindia.com",
    "yellowpages.com",
    "yelp.com",
    "tripadvisor.com",
    "threebestrated.in",
    "zaubacorp.com",
    "tofler.in",
    "lybrate.com",
    "sehat.com",
    "clinicspots.com",
    "credihealth.com",
    "google.com",
    "bing.com",
    "yahoo.com",
    "wikipedia.org",
    "dnb.com",
    "zoominfo.com",
    "crunchbase.com",
    "pitchbook.com",
    "g2.com",
    "trustpilot.com",
    "kompass.com",
    "cylex.in",
    "secretaryofstate.com",
    "tradeindia.com",
    "exportersindia.com",
    "bharatibiz.com",
    "dialme.in",
    "quickr.com",
    "olx.in",
  ];

  private static readonly GENERIC_STOP_WORDS = new Set([
    "hospital",
    "hospitals",
    "clinic",
    "clinics",
    "services",
    "service",
    "centre",
    "center",
    "pvt",
    "ltd",
    "limited",
    "private",
    "agency",
    "company",
    "associates",
    "group",
    "care",
    "solutions",
    "and",
    "the",
    "dr",
    "doctor",
  ]);

  /**
   * Main entrypoint: Discover and verify an unlinked official domain for a business entity
   */
  public static async resolve(business: BusinessEntityQuery): Promise<SecondaryDomainResult> {
    const city = (business.formattedAddress || business.locationInput || "").split(",")[0].trim();
    const query = `${business.name} ${city}`.trim();

    try {
      // 1. Fetch Candidate URLs via DuckDuckGo HTML (Zero API key, sub-500ms)
      const candidateUrls = await this.searchDuckDuckGo(query);

      if (candidateUrls.length === 0) {
        return {
          verified: false,
          unlinkedWebsiteUrl: null,
          confidence: 0,
          matchingSignals: [],
        };
      }

      // 2. Validate Top Non-Directory Candidates with Multi-Signal Entity Proof
      for (const candidateUrl of candidateUrls.slice(0, 3)) {
        const proof = await this.verifyEntityProof(candidateUrl, business);
        if (proof.verified) {
          return {
            verified: true,
            unlinkedWebsiteUrl: proof.originUrl,
            confidence: proof.confidence,
            matchingSignals: proof.matchingSignals,
          };
        }
      }
    } catch (err: any) {
      // Fail closed gracefully without disrupting pipeline
      console.warn(`SecondaryDomainResolver failed for ${business.name}:`, err.message);
    }

    return {
      verified: false,
      unlinkedWebsiteUrl: null,
      confidence: 0,
      matchingSignals: [],
    };
  }

  /**
   * Fast HTML search query to DuckDuckGo (Zero-Cost Default)
   */
  public static async searchDuckDuckGo(query: string): Promise<string[]> {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) return [];

      const html = await res.text();

      // Extract destination links from DuckDuckGo redirect uddg parameter
      const rawUrls = [...html.matchAll(/uddg=([^&'"\s]+)/g)]
        .map((m) => decodeURIComponent(m[1]))
        .filter((rawUrl) => {
          try {
            const parsed = new URL(rawUrl);
            const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
            return (
              parsed.protocol.startsWith("http") &&
              !this.DIRECTORY_DOMAINS.some((d) => hostname === d || hostname.endsWith("." + d))
            );
          } catch {
            return false;
          }
        });

      // Deduplicate by hostname
      const seenHosts = new Set<string>();
      const filtered: string[] = [];

      for (const u of rawUrls) {
        try {
          const host = new URL(u).hostname.toLowerCase();
          if (!seenHosts.has(host)) {
            seenHosts.add(host);
            filtered.push(u);
          }
        } catch {}
      }

      return filtered;
    } catch {
      return [];
    }
  }

  /**
   * Multi-Signal DOM Entity Proof: Verifies phone numbers, city names, and brand tokens
   */
  public static async verifyEntityProof(
    candidateUrl: string,
    business: BusinessEntityQuery
  ): Promise<{ verified: boolean; originUrl: string; confidence: number; matchingSignals: string[] }> {
    let originUrl = "";
    try {
      originUrl = new URL(candidateUrl).origin;
    } catch {
      return { verified: false, originUrl: "", confidence: 0, matchingSignals: [] };
    }

    try {
      const res = await fetch(originUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadEngineAudit/1.0)" },
        signal: AbortSignal.timeout(3500),
      });

      if (!res.ok) {
        return { verified: false, originUrl, confidence: 0, matchingSignals: [] };
      }

      const html = await res.text();
      const text = html.toLowerCase();
      const matchingSignals: string[] = [];

      // Signal 1: Phone Number Exact Match
      const cleanPhone = business.phone ? business.phone.replace(/[^0-9]/g, "").slice(-10) : "";
      const phoneMatch = cleanPhone.length >= 8 && text.includes(cleanPhone);
      if (phoneMatch) {
        matchingSignals.push(`Phone Verified (${cleanPhone})`);
      }

      // Signal 2: City / Locality Match
      const city = (business.formattedAddress || business.locationInput || "").split(",")[0].trim().toLowerCase();
      const cityMatch = city.length > 2 && text.includes(city);
      if (cityMatch) {
        matchingSignals.push(`Locality Verified (${city})`);
      }

      // Signal 3: Unique Brand Name Tokens Match
      const nameTokens = business.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !this.GENERIC_STOP_WORDS.has(w));

      const matchedTokens = nameTokens.filter((t) => text.includes(t));
      const brandTokenRatio = nameTokens.length > 0 ? matchedTokens.length / nameTokens.length : 0;

      if (nameTokens.length > 0 && brandTokenRatio >= 0.75) {
        matchingSignals.push(`Brand Tokens Verified (${matchedTokens.join(", ")})`);
      }

      // Decision Invariant:
      // A domain is 100% verified if:
      // 1. Phone matches directly, OR
      // 2. City matches AND brand token ratio is >= 75%
      const verified = phoneMatch || (cityMatch && brandTokenRatio >= 0.75 && nameTokens.length > 0);
      const confidence = phoneMatch ? 0.95 : verified ? 0.85 : 0;

      return {
        verified,
        originUrl,
        confidence,
        matchingSignals,
      };
    } catch {
      return { verified: false, originUrl, confidence: 0, matchingSignals: [] };
    }
  }
}
