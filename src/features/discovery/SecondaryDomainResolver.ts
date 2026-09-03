/**
 * Secondary Domain Resolver & Entity Verification Engine
 * 
 * Automatically discovers unlinked official websites for businesses that lack a website
 * on their Google Maps / Google Business Profile (GBP), with zero new API keys.
 * 
 * Enforces weighted multi-signal entity proof (Phone, Title/H1 Jaccard Similarity,
 * Locality, Domain Slug) with discrete HIGH | MEDIUM | LOW confidence tiers.
 */

import { PlaywrightAuditEngine } from "@/features/auditor/PlaywrightAuditEngine";

export interface BusinessEntityQuery {
  name: string;
  formattedAddress?: string | null;
  locationInput?: string | null;
  phone?: string | null;
}

export type DomainConfidenceTier = "HIGH" | "MEDIUM" | "LOW" | "REJECTED";

export interface SecondaryDomainResult {
  verified: boolean;
  confidenceTier: DomainConfidenceTier;
  unlinkedWebsiteUrl: string | null;
  score: number;
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
    "home",
    "about",
    "contact",
    "welcome",
    "official",
    "website",
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
          confidenceTier: "REJECTED",
          unlinkedWebsiteUrl: null,
          score: 0,
          matchingSignals: [],
        };
      }

      // 2. Validate Top Non-Directory Candidates with Multi-Signal Entity Proof
      for (const candidateUrl of candidateUrls.slice(0, 3)) {
        const proof = await this.verifyEntityProof(candidateUrl, business);
        
        // Invariant: Only HIGH confidence candidates are automatically verified for GBP disconnect
        if (proof.confidenceTier === "HIGH") {
          return {
            verified: true,
            confidenceTier: "HIGH",
            unlinkedWebsiteUrl: proof.originUrl,
            score: proof.score,
            matchingSignals: proof.matchingSignals,
          };
        }
      }
    } catch (err: any) {
      console.warn(`SecondaryDomainResolver failed for ${business.name}:`, err.message);
    }

    return {
      verified: false,
      confidenceTier: "REJECTED",
      unlinkedWebsiteUrl: null,
      score: 0,
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
   * Multi-Signal DOM Entity Proof: Evaluates Phone, Locality, Title/H1 Jaccard Similarity, and Domain Slug
   */
  public static async verifyEntityProof(
    candidateUrl: string,
    business: BusinessEntityQuery
  ): Promise<{
    verified: boolean;
    confidenceTier: DomainConfidenceTier;
    originUrl: string;
    score: number;
    matchingSignals: string[];
  }> {
    let originUrl = "";
    try {
      originUrl = new URL(candidateUrl).origin;
    } catch {
      return { verified: false, confidenceTier: "REJECTED", originUrl: "", score: 0, matchingSignals: [] };
    }

    try {
      const allowLocalhost = process.env.NODE_ENV === "test" || process.env.PLAYWRIGHT_TEST === "1";
      await PlaywrightAuditEngine.validateUrlSecurity(originUrl, allowLocalhost);

      const res = await fetch(originUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadEngineAudit/1.0)" },
        signal: AbortSignal.timeout(3500),
      });

      if (!res.ok) {
        return { verified: false, confidenceTier: "REJECTED", originUrl, score: 0, matchingSignals: [] };
      }

      const html = await res.text();
      const text = html.toLowerCase();
      const matchingSignals: string[] = [];

      let score = 0;
      let signalFamilyCount = 0;
      let hasStrongIdentitySignal = false;

      // -------------------------------------------------------------
      // 1. Phone Exact Match (40 Points, Strong Identity Signal)
      // -------------------------------------------------------------
      const cleanPhone = business.phone ? business.phone.replace(/[^0-9]/g, "").slice(-10) : "";
      const phoneMatch = cleanPhone.length >= 8 && text.includes(cleanPhone);
      if (phoneMatch) {
        score += 40;
        signalFamilyCount++;
        hasStrongIdentitySignal = true;
        matchingSignals.push(`Phone Verified (${cleanPhone})`);
      }

      // -------------------------------------------------------------
      // 2. Exact Locality / Street / City Match (25 Points)
      // -------------------------------------------------------------
      const city = (business.formattedAddress || business.locationInput || "").split(",")[0].trim().toLowerCase();
      const cityMatch = city.length > 2 && text.includes(city);
      if (cityMatch) {
        score += 25;
        signalFamilyCount++;
        matchingSignals.push(`Locality Verified (${city})`);
      }

      // -------------------------------------------------------------
      // 3. Strict Brand Evidence Jaccard Similarity in <title> and <h1> (25 Points)
      // -------------------------------------------------------------
      const titleMatches = [...html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map((m) => m[1]);
      const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1]);
      const pageBrandText = (titleMatches.join(" ") + " " + h1Matches.join(" "))
        .toLowerCase()
        .replace(/<[^>]+>/g, " ")
        .replace(/[^a-z0-9\s]/g, " ");

      const businessTokens = new Set(
        business.name
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 2 && !this.GENERIC_STOP_WORDS.has(w))
      );

      const pageBrandTokens = new Set(
        pageBrandText
          .split(/\s+/)
          .filter((w) => w.length > 2 && !this.GENERIC_STOP_WORDS.has(w))
      );

      if (businessTokens.size > 0 && pageBrandTokens.size > 0) {
        const intersection = new Set([...businessTokens].filter((x) => pageBrandTokens.has(x)));
        const union = new Set([...businessTokens, ...pageBrandTokens]);
        const jaccard = union.size > 0 ? intersection.size / union.size : 0;
        const tokenOverlapRatio = intersection.size / businessTokens.size;

        if (tokenOverlapRatio >= 0.75 || jaccard >= 0.4) {
          score += 25;
          signalFamilyCount++;
          hasStrongIdentitySignal = true;
          matchingSignals.push(`Brand Title/H1 Match (${[...intersection].join(", ")})`);
        } else if (tokenOverlapRatio >= 0.5 || jaccard >= 0.25) {
          score += 15;
          signalFamilyCount++;
          matchingSignals.push(`Partial Brand Title Match (${[...intersection].join(", ")})`);
        }
      }

      // -------------------------------------------------------------
      // 4. Domain Slug Heuristic (10 Points)
      // -------------------------------------------------------------
      try {
        const hostname = new URL(candidateUrl).hostname.toLowerCase().replace(/^www\./, "");
        const nameSlug = business.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        const firstToken = [...businessTokens][0] || "";

        if (hostname.includes(nameSlug) || (firstToken.length >= 4 && hostname.includes(firstToken))) {
          score += 10;
          signalFamilyCount++;
          matchingSignals.push(`Domain Slug Match (${hostname})`);
        }
      } catch {}

      // -------------------------------------------------------------
      // Discrete Confidence Tier Classification
      // -------------------------------------------------------------
      let confidenceTier: DomainConfidenceTier = "REJECTED";

      if (score >= 80 && signalFamilyCount >= 2 && hasStrongIdentitySignal) {
        confidenceTier = "HIGH";
      } else if (score >= 50 && signalFamilyCount >= 2) {
        confidenceTier = "MEDIUM";
      } else if (score >= 30) {
        confidenceTier = "LOW";
      }

      const verified = confidenceTier === "HIGH";

      return {
        verified,
        confidenceTier,
        originUrl,
        score,
        matchingSignals,
      };
    } catch {
      return { verified: false, confidenceTier: "REJECTED", originUrl, score: 0, matchingSignals: [] };
    }
  }

  /**
   * Evidence-Based Domain Migration Verification Gate
   * Proves whether a new candidate URL legitimately belongs to the business entity
   * before allowing it to overwrite an existing verified website.
   */
  public static async verifyDomainMigration(
    newCandidateUrl: string,
    business: BusinessEntityQuery,
    existingVerifiedUrl?: string | null
  ): Promise<boolean> {
    if (!newCandidateUrl) return false;

    // Fast Path: If new URL is identical to existing URL
    if (existingVerifiedUrl && new URL(newCandidateUrl).origin === new URL(existingVerifiedUrl).origin) {
      return true;
    }

    // Step 1: Check if new candidate URL is a 301/308 redirect from existing URL
    if (existingVerifiedUrl) {
      try {
        const allowLocalhost = process.env.NODE_ENV === "test" || process.env.PLAYWRIGHT_TEST === "1";
        await PlaywrightAuditEngine.validateUrlSecurity(existingVerifiedUrl, allowLocalhost);

        const redirectCheck = await fetch(existingVerifiedUrl, {
          method: "HEAD",
          redirect: "follow",
          headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadEngineMigration/1.0)" },
          signal: AbortSignal.timeout(3000),
        });
        if (redirectCheck.ok) {
          const finalOrigin = new URL(redirectCheck.url).origin;
          await PlaywrightAuditEngine.validateUrlSecurity(finalOrigin, allowLocalhost);
          if (finalOrigin === new URL(newCandidateUrl).origin) {
            return true; // Legitimate verified domain redirect
          }
        }
      } catch {}
    }

    // Step 2: Multi-Signal Entity Proof on new candidate URL
    const proof = await this.verifyEntityProof(newCandidateUrl, business);
    return proof.confidenceTier === "HIGH" || proof.confidenceTier === "MEDIUM";
  }
}
