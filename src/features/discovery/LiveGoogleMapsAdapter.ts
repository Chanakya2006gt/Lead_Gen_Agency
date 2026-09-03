import { chromium } from "playwright";
import { RawBusinessInput, RawReviewTimestamp } from "@/features/qualification/UniversalFilterService";
import { IDiscoveryAdapter, DiscoveryParams, DiscoveryPlan } from "./types";
import { BusinessIdentityResolver } from "@/features/identity/BusinessIdentityResolver";
import { LocationResolver } from "./LocationResolver";
import { MarketContextProvider } from "@/features/commercial/MarketContext";
import { DiscoveryStrategyBuilder } from "./DiscoveryStrategyBuilder";

export class LiveGoogleMapsAdapter implements IDiscoveryAdapter {
  public readonly name = "LiveGoogleMapsAdapter";

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

    const browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--lang=en-US",
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      locale: "en-US",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const candidateMap = new Map<string, RawBusinessInput>();
    const maxCalls = Math.min(plan.queries.length, plan.budget.maxProviderCalls);

    try {
      for (let qIdx = 0; qIdx < maxCalls; qIdx++) {
        const q = plan.queries[qIdx];
        const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(q.textQuery)}?hl=en`;
        const page = await context.newPage();

        try {
          await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 25000 });

          // Handle Google Cookie / Consent dialogs
          try {
            const consentButtons = [
              'button:has-text("Accept all")',
              'button:has-text("I agree")',
              'button:has-text("Reject all")',
              'form[action*="consent"] button',
            ];
            for (const btnSelector of consentButtons) {
              const btn = page.locator(btnSelector).first();
              if (await btn.isVisible({ timeout: 1500 })) {
                await btn.click();
                await page.waitForTimeout(1000);
                break;
              }
            }
          } catch {
            // No consent modal
          }

          // Wait for feed container
          try {
            await page.waitForSelector('div[role="feed"], div.Nv2PK, a.hfpxzc, a[href*="/maps/place/"]', {
              timeout: 10000,
            });
          } catch {
            // Continue
          }

          // Scroll feed container
          const feedSelector = 'div[role="feed"]';
          for (let i = 0; i < 4; i++) {
            await page.evaluate((sel) => {
              const feed = document.querySelector(sel);
              if (feed) {
                feed.scrollTop = feed.scrollHeight;
              } else {
                window.scrollBy(0, 1200);
              }
            }, feedSelector);
            await page.waitForTimeout(1000);
          }

          // Extract listing items from DOM
          const rawPlaces = await page.evaluate((max) => {
            const items: any[] = [];
            const cards = Array.from(document.querySelectorAll('div.Nv2PK, div[role="article"]'));

            if (cards.length > 0) {
              for (const card of cards) {
                if (items.length >= max) break;

                const linkEl = card.querySelector('a.hfpxzc, a[href*="/maps/place/"]') as HTMLAnchorElement | null;
                const nameEl = card.querySelector('.fontHeadlineSmall, .qBF1Pd, [role="heading"]');
                const name = linkEl?.getAttribute("aria-label") || nameEl?.textContent?.trim() || "";

                if (!name || items.some((p) => p.name === name)) continue;

                const href = linkEl?.href || "";
                const text = card.textContent || "";

                const ratingEl = card.querySelector('.MW4etd, [aria-label*="stars"], [aria-label*="star"]');
                const ratingMatch = (ratingEl?.textContent || text).match(/([1-5]\.\d)/);
                if (!ratingMatch) continue;
                const rating = parseFloat(ratingMatch[1]);

                const reviewEl = card.querySelector('.UY7F9, [aria-label*="reviews"]');
                const reviewText = reviewEl?.textContent || text;
                const reviewCountMatch = reviewText.match(/\(([\d,]+)\)/) || reviewText.match(/([\d,]+)\s+reviews/i);
                if (!reviewCountMatch) continue;
                const reviewCount = parseInt(reviewCountMatch[1].replace(/,/g, ""), 10);

                const websiteBtn = card.querySelector('a[data-value="Website"], a.lcr4fd, a[aria-label*="website" i]');
                const websiteUrl = websiteBtn ? (websiteBtn as HTMLAnchorElement).href : null;

                const phoneMatch = text.match(/(\+?\d[\d\s\-()]{8,}\d)/);
                const phone = phoneMatch ? phoneMatch[1].trim() : null;

                const addrMatch = text.match(/·\s*([^·\n]+(?:St|Ave|Rd|Rd\.|Road|Street|Blvd|Lane|Nagar|Colony|Highway|Circle|Cross|Floor|Phase|Ext|Zone|Industrial|Telangana|Texas|TX|CA|UK|India)[^·\n]*)/i);
                const addressSnippet = addrMatch ? addrMatch[1].trim() : "";

                items.push({
                  name,
                  rating,
                  reviewCount,
                  websiteUrl,
                  phone,
                  googleMapsUrl: href,
                  addressSnippet,
                });
              }
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
                category: plan.originalNiche,
                rating: item.rating,
                reviewCount: item.reviewCount,
                websiteUrl: item.websiteUrl,
                phone: item.phone,
                formattedAddress: item.addressSnippet || plan.location.canonicalName,
                googleMapsUrl: item.googleMapsUrl,
                reviews: [],
              });

              if (candidateMap.size >= plan.budget.maxTotalCandidates) {
                break;
              }
            }
          }
        } finally {
          await page.close();
        }

        if (candidateMap.size >= plan.budget.maxTotalCandidates) {
          break;
        }
      }
    } finally {
      await browser.close();
    }

    return Array.from(candidateMap.values());
  }
}
