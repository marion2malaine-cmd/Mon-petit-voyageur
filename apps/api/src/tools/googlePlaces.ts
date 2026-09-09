import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Photo } from "@mlt/contracts";
import type { AppConfig } from "../config";

/**
 * The photo of a hotel, from Google Places.
 *
 * Every hotel the plan names exists on Google Maps with its own pictures —
 * the ones Booking shows too. The photo libraries never have them (an
 * encyclopedia has no page for a guesthouse, a stock library answers "hotel"
 * with someone else's), so a lodging that the hotel engine did not already
 * illustrate is looked up here, by name and town.
 *
 * Each lookup is two paid calls (a text search, then the photo's public
 * address), roughly four cents. Answers are kept on disk for a year: the same
 * hotel in the next plan costs nothing.
 */

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const PHOTO_WIDTH = 1200;
const TIMEOUT_MS = 6000;
const TTL_MS = 365 * 24 * 3600 * 1000;

interface CacheStore {
  version: 1;
  entries: Record<string, { expiresAt: number; photo: Photo | null }>;
}

let store: CacheStore | null = null;
let storeFile: string | null | undefined;

function storePath(config: AppConfig): string | null {
  if (config.NODE_ENV === "test" || config.SQLITE_PATH === ":memory:") return null;
  // Next to the SerpApi cache, on the same persistent volume.
  const base = config.SERPAPI_CACHE_PATH ? path.dirname(path.resolve(config.SERPAPI_CACHE_PATH)) : path.dirname(config.SQLITE_PATH);
  return path.resolve(base, "google-places-photos.json");
}

function loadStore(config: AppConfig): CacheStore {
  const file = storePath(config);
  if (store && storeFile === file) return store;
  let loaded: CacheStore | null = null;
  if (file && existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      if (parsed?.version === 1) loaded = parsed;
    } catch {
      // A corrupt cache is just an empty one.
    }
  }
  store = loaded ?? { version: 1, entries: {} };
  storeFile = file;
  const now = Date.now();
  for (const [key, entry] of Object.entries(store.entries)) {
    if (entry.expiresAt <= now) delete store.entries[key];
  }
  return store;
}

function saveStore(config: AppConfig): void {
  const file = storePath(config);
  if (!file || !store) return;
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(store));
  } catch {
    // Losing the cache costs a few cents next time, not the plan.
  }
}

export function resetGooglePlacesCache(): void {
  store = null;
  storeFile = undefined;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface HotelPhotoQuery {
  name: string;
  town?: string | null;
  destination?: string | null;
}

/**
 * Finds the hotel on Google Maps and returns its first photo, as a public
 * image address (no key inside) with the Google Maps page as the source.
 * Null when the key is missing, the place unknown, or Google unreachable.
 */
export async function findHotelPhoto(config: AppConfig, query: HotelPhotoQuery): Promise<Photo | null> {
  const key = config.GOOGLE_MAPS_API_KEY;
  const name = query.name.trim();
  if (!key || !name) return null;

  const where = [query.town, query.destination].filter((part) => part && part.trim()).join(" ");
  const text = `${name} ${where}`.trim();
  const cacheKey = text.toLowerCase();
  const cached = loadStore(config).entries[cacheKey];
  if (cached) return cached.photo;

  let photo: Photo | null = null;
  try {
    const search = await fetchWithTimeout(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.photos.name,places.photos.authorAttributions,places.googleMapsUri"
      },
      body: JSON.stringify({ textQuery: text, maxResultCount: 1, includedType: "lodging" })
    });
    if (search.ok) {
      const json = (await search.json()) as any;
      const place = json.places?.[0];
      const photoName: string | undefined = place?.photos?.[0]?.name;
      if (photoName) {
        // skipHttpRedirect returns the image's own address instead of
        // redirecting to it — that address is what the app and the guide
        // embed, and it carries no key.
        const media = await fetchWithTimeout(
          `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${PHOTO_WIDTH}&skipHttpRedirect=true`,
          { headers: { "X-Goog-Api-Key": key } }
        );
        if (media.ok) {
          const body = (await media.json()) as any;
          const url = typeof body.photoUri === "string" && /^https:\/\//.test(body.photoUri) ? body.photoUri : null;
          if (url) {
            const author = place.photos[0].authorAttributions?.[0]?.displayName;
            photo = {
              query: name,
              url,
              thumb_url: null,
              credit: author ? `${author} · Google Maps` : "Google Maps",
              source_url: typeof place.googleMapsUri === "string" ? place.googleMapsUri : null,
              license: null
            };
          }
        }
      }
    } else {
      console.warn(`[places] hotel photo lookup failed (HTTP ${search.status}) for "${text}"`);
      // A refused key or a quota is not worth caching as "no photo".
      return null;
    }
  } catch (error) {
    console.warn(`[places] hotel photo lookup failed for "${text}": ${(error as Error).message}`);
    return null;
  }

  loadStore(config).entries[cacheKey] = { expiresAt: Date.now() + TTL_MS, photo };
  saveStore(config);
  return photo;
}
