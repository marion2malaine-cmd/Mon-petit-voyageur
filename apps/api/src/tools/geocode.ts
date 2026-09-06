// Nominatim is OpenStreetMap's geocoder: no key, but it requires an
// identifying User-Agent and asks for at most one request per second.
const USER_AGENT = "MonPetitVoyageur/1.0 (https://github.com/mon-petit-voyageur; trip guide maps)";
const MIN_INTERVAL_MS = 1100;
const TIMEOUT_MS = 8000;

export interface GeoPoint {
  lat: number;
  lon: number;
}

const cache = new Map<string, GeoPoint | null>();
let lastCallAt = 0;

// Answers are kept on disk next to the database: a place geocoded once for a
// destination never costs Nominatim a request again, whoever plans it next.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

let diskLoaded = false;
function diskPath(): string | null {
  if (process.env.NODE_ENV === "test") return null;
  const sqlite = process.env.SQLITE_PATH ?? "apps/api/data/mlt.sqlite";
  if (sqlite === ":memory:") return null;
  return path.resolve(path.dirname(sqlite), "geocode-cache.json");
}
function loadDisk(): void {
  if (diskLoaded) return;
  diskLoaded = true;
  const file = diskPath();
  if (!file || !existsSync(file)) return;
  try {
    for (const [key, value] of Object.entries(JSON.parse(readFileSync(file, "utf8")) as Record<string, GeoPoint | null>)) {
      if (!cache.has(key)) cache.set(key, value);
    }
  } catch {
    // A corrupt cache is an empty one.
  }
}
function saveDisk(): void {
  const file = diskPath();
  if (!file) return;
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(Object.fromEntries(cache)));
  } catch {
    // Losing the cache costs a request later, never the guide now.
  }
}

/**
 * Resolves a place name to coordinates so the guide can draw the day's route.
 *
 * Failures return null rather than throwing: a map with four of five markers
 * is still useful, a crashed guide is not.
 */
export async function geocodePlace(place: string, destination: string): Promise<GeoPoint | null> {
  const query = buildQuery(place, destination);
  if (!query) return null;

  loadDisk();
  const cached = cache.get(query);
  if (cached !== undefined) return cached;

  await respectRateLimit();

  try {
    const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "1" });
    const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params}`);
    if (!response.ok) {
      cache.set(query, null);
      return null;
    }

    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    const point = first ? { lat: Number(first.lat), lon: Number(first.lon) } : null;

    cache.set(query, point && Number.isFinite(point.lat) && Number.isFinite(point.lon) ? point : null);
    saveDisk();
    return cache.get(query) ?? null;
  } catch {
    cache.set(query, null);
    return null;
  }
}

/**
 * Geocodes a list of places, sequentially, as Nominatim's policy requires.
 * `maxRequests` caps the network calls of this batch (cached places are
 * free and never counted); the rest is left unplaced.
 */
export async function geocodePlaces(
  places: string[],
  destination: string,
  maxRequests = Number.POSITIVE_INFINITY
): Promise<Map<string, GeoPoint>> {
  const resolved = new Map<string, GeoPoint>();
  let requests = 0;
  loadDisk();

  for (const place of [...new Set(places.map((p) => p.trim()).filter(Boolean))]) {
    const query = buildQuery(place, destination);
    const known = cache.has(query);
    if (!known && requests >= maxRequests) continue;
    if (!known) requests += 1;
    const point = await geocodePlace(place, destination);
    if (point) resolved.set(place, point);
  }

  return resolved;
}

export function resetGeocodeCache(): void {
  cache.clear();
  lastCallAt = 0;
  diskLoaded = true;
}

function buildQuery(place: string, destination: string): string {
  const cleaned = place
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";

  const city = destination.trim();
  return cleaned.toLowerCase().includes(city.toLowerCase()) ? cleaned : `${cleaned}, ${city}`;
}

async function respectRateLimit(): Promise<void> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastCallAt = Date.now();
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
