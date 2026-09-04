import { chromium, Browser, Page } from "playwright";
import { RawBusinessInput, RawReviewTimestamp } from "@/features/qualification/UniversalFilterService";
import { IDiscoveryAdapter, DiscoveryParams, DiscoveryPlan } from "./types";
import { BusinessIdentityResolver } from "@/features/identity/BusinessIdentityResolver";
import { LocationResolver } from "./LocationResolver";
import { MarketContextProvider } from "@/features/commercial/MarketContext";
import { DiscoveryStrategyBuilder } from "./DiscoveryStrategyBuilder";

export class LiveGoogleMapsAdapter implements IDiscoveryAdapter {
  public readonly name = "LiveGoogleMapsAdapter";
  private isHeadless: boolean;

  constructor(isHeadless: boolean = true) {
    this.isHeadless = isHeadless;
  }

  public async discover(planOrParams: DiscoveryPlan | DiscoveryParams): Promise<RawBusinessInput[]> {
    let plan: DiscoveryPlan;
    if ("queries" in planOrParams) {
      plan = planOrParams;
    } else {
      const location = LocationResolver.resolve(planOrParams.location);
      const marketContext = MarketContextProvider.resolve(planOrParams.location);
      plan = DiscoveryStrategyBuilder.buildPlan({
        niche: planOrParams.niche,
        location,
        marketContext,
        mode: planOrParams.mode || "STANDARD",
      });
    }

    const candidateMap = new Map<string, RawBusinessInput>();
    let browser: Browser | null = null;

    try {
      const launchArgs = [
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
      ];
      if (process.env.PLAYWRIGHT_NO_SANDBOX === "1") {
        launchArgs.push("--no-sandbox");
      }

      browser = await chromium.launch({
        headless: this.isHeadless,
        args: launchArgs,
      });

      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 800 },
        locale: "en-US",
      });

      const page = await context.newPage();

      const maxQueries = Math.min(plan.queries.length, plan.budget.maxProviderCalls);

      for (let qIdx = 0; qIdx < maxQueries; qIdx++) {
        const queryVariant = plan.queries[qIdx];
        const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(queryVariant.textQuery)}`;

        try {
          await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 25000 });

          // Accept Google Cookies if consent banner appears
          try {
            const consentBtn = await page.$('button[aria-label*="Accept"], form[action*="consent"] button');
            if (consentBtn) {
              await consentBtn.click();
              await page.waitForTimeout(1000);
            }
          } catch {}

          // Wait for feed container
          try {
            await page.waitForSelector('div[role="feed"], div[aria-label*="Results for"], a[href*="/maps/place/"]', {
              timeout: 10000,
            });
          } catch {
            continue;
          }

          // Progressive scroll
          const feedSelector = 'div[role="feed"]';
          const feedExists = await page.$(feedSelector);

          if (feedExists) {
            for (let i = 0; i < 3; i++) {
              await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (el) el.scrollTop += 1500;
              }, feedSelector);
              await page.waitForTimeout(1200);
            }
          }

          // Extract Places with exact DOM Category Subtitle parsing
          const rawPlaces = await page.evaluate((maxItems) => {
            const items: {
              name: string;
              category?: string;
              rating: number;
              reviewCount: number;
              websiteUrl: string | null;
              phone: string | null;
              googleMapsUrl: string;
              addressSnippet: string | null;
            }[] = [];

            const cards = document.querySelectorAll('div[role="feed"] > div, div.Nv2PK');

            for (const card of Array.from(cards)) {
              if (items.length >= maxItems) break;

              const linkEl = card.querySelector('a[href*="/maps/place/"]') as HTMLAnchorElement | null;
              const titleEl = card.querySelector('div.fontHeadlineSmall, div.qBF1Pd, div.NrDZNb') as HTMLElement | null;

              if (!linkEl || !titleEl) continue;

              const name = titleEl.innerText?.trim();
              const href = linkEl.href;
              if (!name || !href) continue;

              // Extract Rating & Reviews
              let rating = 0;
              let reviewCount = 0;
              const ariaLabel = card.querySelector('span[role="img"]')?.getAttribute("aria-label") || "";
              const ratingMatch = ariaLabel.match(/([0-9.]+)\s*stars?/i) || card.textContent?.match(/([0-9.]+)\s*★/);
              if (ratingMatch) rating = parseFloat(ratingMatch[1]) || 0;

              const reviewMatch = card.textContent?.match(/\(([0-9,]+)\)/) || ariaLabel.match(/([0-9,]+)\s*reviews?/i);
              if (reviewMatch) reviewCount = parseInt(reviewMatch[1].replace(/,/g, ""), 10) || 0;

              // Extract Real Category Subtitle from DOM (Text before the first dot '·')
              let extractedCategory = "";
              const subtitleContainer = card.querySelector('div.W4Efsd');
              if (subtitleContainer) {
                const subText = subtitleContainer.textContent || "";
                const parts = subText.split("·");
                if (parts.length > 0) {
                  const rawCat = parts[0].replace(/[0-9.★()]/g, "").trim();
                  if (rawCat.length > 2 && rawCat.length < 50) {
                    extractedCategory = rawCat;
                  }
                }
              }

              // Extract Website & Phone
              let websiteUrl: string | null = null;
              let phone: string | null = null;
              const siteLink = card.querySelector('a[data-value*="http"], a[aria-label*="Website"]') as HTMLAnchorElement | null;
              if (siteLink && siteLink.href && !siteLink.href.includes("google.com")) {
                websiteUrl = siteLink.href;
              }

              const text = card.textContent || "";
              const phoneMatch = text.match(/(?:\+?[0-9]{1,4}[ -]?)?\(?[0-9]{3}\)?[ -]?[0-9]{3}[ -]?[0-9]{4}/);
              if (phoneMatch) phone = phoneMatch[0];

              const addrMatch = text.match(/·\s*([^·\n]+(?:St|Ave|Rd|Rd\.|Road|Street|Blvd|Lane|Nagar|Colony|Highway|Circle|Cross|Floor|Phase|Ext|Zone|Industrial|Telangana|Texas|TX|CA|UK|India)[^·\n]*)/i);
              const addressSnippet = addrMatch ? addrMatch[1].trim() : null;

              items.push({
                name,
                category: extractedCategory || undefined,
                rating,
                reviewCount,
                websiteUrl,
                phone,
                googleMapsUrl: href,
                addressSnippet,
              });
            }
            return items;
          }, plan.budget.maxResultsPerQuery);

          for (const item of rawPlaces) {
            const placeId = BusinessIdentityResolver.resolveId({
              googleMapsUrl: item.googleMapsUrl,
              name: item.name,
              formattedAddress: item.addressSnippet || plan.location.canonicalName,
              phone: item.phone,
            });

            if (!candidateMap.has(placeId)) {
              candidateMap.set(placeId, {
                placeId,
                name: item.name,
                // INVARIANT: Do not overwrite category with plan.originalNiche
                category: item.category || "Operating Business",
                rating: item.rating,
                reviewCount: item.reviewCount,
                websiteUrl: item.websiteUrl,
                phone: item.phone,
                formattedAddress: item.addressSnippet || plan.location.canonicalName,
                googleMapsUrl: item.googleMapsUrl,
                reviews: [],
                discoveryNiche: plan.originalNiche,
                discoveryQuery: queryVariant.textQuery,
                googlePrimaryTypeDisplayName: item.category || undefined,
                categorySource: item.category ? "GOOGLE_MAPS_DOM" : "UNKNOWN",
                categoryConfidence: item.category ? 0.85 : 0.3,
              });

              if (candidateMap.size >= plan.budget.maxTotalCandidates) {
                break;
              }
            }
          }
        } catch (err) {
          console.warn(`Live Maps search failed for query "${queryVariant.textQuery}":`, err);
        }

        if (candidateMap.size >= plan.budget.maxTotalCandidates) {
          break;
        }
      }
    } finally {
      if (browser) await browser.close();
    }

    return Array.from(candidateMap.values());
  }
}
