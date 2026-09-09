import type { Photo } from "@mlt/contracts";
import type { AppConfig } from "../config";

/**
 * The exact activity on Viator, with its own photo.
 *
 * The Viator Partner API (affiliate access) returns, for a free-text search
 * in a destination, the products it sells with their gallery: the photo of
 * *this* cooking class, *this* boat trip — what neither an encyclopedia nor a
 * stock library can give. The affiliate link of the product replaces the
 * search page, so the traveler lands on the offer the card shows.
 *
 * No key configured: nothing happens and the card keeps its library photo.
 */

const SEARCH_URL = "https://api.viator.com/partner/search/freetext";
const TIMEOUT_MS = 6000;
const PREFERRED_WIDTH = 720;

export interface ViatorMatch {
  product_code: string;
  title: string;
  url: string;
  price_from_eur: number | null;
  rating: number | null;
  photo: Photo;
}

const memory = new Map<string, ViatorMatch | null>();

export function resetViatorCache(): void {
  memory.clear();
}

function nameKey(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const STOP = new Set(["de", "du", "des", "la", "le", "les", "et", "en", "au", "aux", "a", "the", "of", "in", "and", "to", "with", "avec", "sur", "dans", "pour", "for", "from", "tour", "visite", "excursion", "day", "jour", "journee", "half", "demi", "private", "prive", "privee"]);

/** The words of the activity title that name what it is, for the match. */
function keywords(value: string): string[] {
  return nameKey(value).split(" ").filter((word) => word.length > 2 && !STOP.has(word));
}

/**
 * Searches the activity in its destination and keeps the first product that
 * really is it: most of the title's own words must appear in the product's
 * title. A "Marrakech food tour" must not illustrate a cooking class.
 */
export async function findViatorActivity(
  config: AppConfig,
  input: { title: string; destination: string; locale: "fr" | "en" }
): Promise<ViatorMatch | null> {
  const key = config.VIATOR_API_KEY;
  const title = input.title.trim();
  if (!key || !title) return null;

  const cacheKey = `${input.locale}:${nameKey(title)}:${nameKey(input.destination)}`;
  if (memory.has(cacheKey)) return memory.get(cacheKey) ?? null;

  let match: ViatorMatch | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(SEARCH_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json;version=2.0",
        "Accept-Language": input.locale === "fr" ? "fr-FR" : "en-US",
        "exp-api-key": key
      },
      body: JSON.stringify({
        searchTerm: `${title} ${input.destination}`.trim(),
        currency: "EUR",
        searchTypes: [{ searchType: "PRODUCTS", pagination: { start: 1, count: 5 } }]
      })
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      console.warn(`[viator] search failed (HTTP ${response.status}) for "${title}"`);
      return null;
    }
    const json = (await response.json()) as any;
    const products: any[] = json?.products?.results ?? [];
    const wanted = keywords(title);
    const needed = Math.max(1, Math.ceil(wanted.length * 0.5));

    for (const product of products) {
      const productTitle = String(product?.title ?? "");
      const hits = wanted.filter((word) => nameKey(productTitle).includes(word)).length;
      if (hits < needed) continue;

      const variants: any[] = product?.images?.[0]?.variants ?? [];
      const wide = variants.filter((variant) => variant?.url && (!variant.width || !variant.height || variant.width >= variant.height));
      const chosen =
        wide.find((variant) => variant.width >= PREFERRED_WIDTH) ?? wide[wide.length - 1] ?? variants[variants.length - 1];
      if (!chosen?.url) continue;

      const url = affiliateUrl(String(product.productUrl ?? ""), config);
      if (!url) continue;

      match = {
        product_code: String(product.productCode ?? ""),
        title: productTitle,
        url,
        price_from_eur: product?.pricing?.summary?.fromPrice != null ? Number(product.pricing.summary.fromPrice) : null,
        rating: product?.reviews?.combinedAverageRating != null ? Math.round(Number(product.reviews.combinedAverageRating) * 10) / 10 : null,
        photo: {
          query: title,
          url: String(chosen.url),
          thumb_url: variants.find((variant) => variant?.width && variant.width < 400)?.url ?? null,
          credit: "Viator",
          source_url: url,
          license: null
        }
      };
      break;
    }
  } catch (error) {
    console.warn(`[viator] search failed for "${title}": ${(error as Error).message}`);
    return null;
  }

  memory.set(cacheKey, match);
  return match;
}

/** The product page, signed with the affiliate identifiers. */
function affiliateUrl(productUrl: string, config: AppConfig): string | null {
  if (!/^https?:\/\//i.test(productUrl)) return null;
  try {
    const url = new URL(productUrl);
    url.searchParams.set("pid", config.VIATOR_AFFILIATE_PID);
    url.searchParams.set("mcid", config.VIATOR_AFFILIATE_MCID);
    url.searchParams.set("medium", "api");
    return url.toString();
  } catch {
    return null;
  }
}
