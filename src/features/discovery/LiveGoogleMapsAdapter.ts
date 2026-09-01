import { chromium } from "playwright";
import { RawBusinessInput, RawReviewTimestamp } from "@/features/qualification/UniversalFilterService";
import { IDiscoveryAdapter, DiscoveryParams } from "./types";

export class LiveGoogleMapsAdapter implements IDiscoveryAdapter {
  public readonly name = "LiveGoogleMapsAdapter";

  public async discover(params: DiscoveryParams): Promise<RawBusinessInput[]> {
    const { niche, location, maxResults = 15 } = params;
    const query = `${niche} in ${location}`;
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`;

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

    const page = await context.newPage();
    const results: RawBusinessInput[] = [];

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

      // Wait for feed container or place links
      try {
        await page.waitForSelector('div[role="feed"], div.Nv2PK, a.hfpxzc, a[href*="/maps/place/"]', {
          timeout: 10000,
        });
      } catch {
        // Continue to evaluate
      }

      // Scroll feed container to trigger lazy loading of cards
      const feedSelector = 'div[role="feed"]';
      for (let i = 0; i < 5; i++) {
        await page.evaluate((sel) => {
          const feed = document.querySelector(sel);
          if (feed) {
            feed.scrollTop = feed.scrollHeight;
          } else {
            window.scrollBy(0, 1200);
          }
        }, feedSelector);
        await page.waitForTimeout(1200);
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

            // Rating Extraction (Must be parsed accurately, NO fake defaults)
            const ratingEl = card.querySelector('.MW4etd, [aria-label*="stars"], [aria-label*="star"]');
            const ratingMatch = (ratingEl?.textContent || text).match(/([1-5]\.\d)/);
            if (!ratingMatch) continue; // Skip if unparseable
            const rating = parseFloat(ratingMatch[1]);

            // Review Count Extraction (Must be parsed accurately, NO fake defaults)
            const reviewEl = card.querySelector('.UY7F9, [aria-label*="reviews"]');
            const reviewText = reviewEl?.textContent || text;
            const reviewCountMatch = reviewText.match(/\(([\d,]+)\)/) || reviewText.match(/([\d,]+)\s+reviews/i);
            if (!reviewCountMatch) continue; // Skip if unparseable
            const reviewCount = parseInt(reviewCountMatch[1].replace(/,/g, ""), 10);

            // Website Button
            const websiteBtn = card.querySelector('a[data-value="Website"], a.lcr4fd, a[aria-label*="website" i]');
            const websiteUrl = websiteBtn ? (websiteBtn as HTMLAnchorElement).href : null;

            // Phone
            const phoneMatch = text.match(/(\+?\d[\d\s\-()]{8,}\d)/);
            const phone = phoneMatch ? phoneMatch[1].trim() : null;

            // Address / Subtitle
            const addressEl = card.querySelector('.W4Efsd:last-child');
            const address = addressEl?.textContent?.trim() || "";

            items.push({
              name,
              href,
              rating,
              reviewCount,
              websiteUrl,
              phone,
              address,
            });
          }
        }

        return items;
      }, maxResults);

      for (const item of rawPlaces) {
        const placeId = `gmaps_${Buffer.from(item.name).toString("hex").substring(0, 16)}_${Date.now().toString(36)}`;

        results.push({
          placeId,
          name: item.name,
          category: niche,
          rating: item.rating,
          reviewCount: item.reviewCount,
          websiteUrl: item.websiteUrl,
          phone: item.phone,
          formattedAddress: item.address || location,
          googleMapsUrl: item.href,
          reviews: [], // Honest: Live Maps summary does not provide granular review timestamps
        });
      }
    } catch (err) {
      console.warn("Live Google Maps scraping encountered an issue:", err);
    } finally {
      await context.close();
      await browser.close();
    }

    return results;
  }
}
