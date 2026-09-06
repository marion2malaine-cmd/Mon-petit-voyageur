import type { MapRoute } from "./renderGuide";

// The same day colours as the interactive map, without the "#".
const PALETTE = ["78a189", "334d3e", "c98a4b", "5b7f9c", "8d6a9f", "b0623f", "4f8a6d", "7d7f45"];
const MAX_URL_LENGTH = 8000;
const TIMEOUT_MS = 10000;

/**
 * A Mapbox Static Images URL of the whole trip: one line per day joining its
 * stops, numbered pins for the stops and a fork pin for each table. It is the
 * picture the guide shows before the interactive map loads, in print, and
 * offline once inlined.
 *
 * Static requests count in the same free tier (50 000 a month). Returns null
 * when nothing is located or the overlays would exceed the URL limit.
 */
export function buildStaticMapUrl(routes: MapRoute[], token: string, size = "1200x640"): string | null {
  const overlays: string[] = [];

  routes.forEach((route, index) => {
    const colour = PALETTE[index % PALETTE.length];
    const stops = route.points.filter((point) => point.kind !== "restaurant");
    if (stops.length > 1) {
      overlays.push(`path-4+${colour}-0.85(${encodeURIComponent(encodePolyline(stops.map((p) => [p.lat, p.lon])))})`);
    }
    stops.forEach((point, order) => {
      overlays.push(`pin-s-${Math.min(order + 1, 99)}+${colour}(${point.lon.toFixed(5)},${point.lat.toFixed(5)})`);
    });
    route.points
      .filter((point) => point.kind === "restaurant")
      .forEach((point) => overlays.push(`pin-s-restaurant+${colour}(${point.lon.toFixed(5)},${point.lat.toFixed(5)})`));
  });

  if (!overlays.length) return null;

  const url = `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${overlays.join(",")}/auto/${size}?padding=40&access_token=${encodeURIComponent(token)}`;
  return url.length <= MAX_URL_LENGTH ? url : null;
}

// A guide is previewed, downloaded and mailed: the same picture three times.
const cache = new Map<string, string | null>();

/**
 * The still map of the trip as a data URI, ready to be inlined so the guide
 * shows it before the interactive map loads, offline and on paper.
 */
export async function stillMapDataUri(routes: MapRoute[], serverToken: string | null | undefined): Promise<string | null> {
  if (!serverToken) return null;
  const url = buildStaticMapUrl(routes, serverToken);
  if (!url) return null;
  if (cache.has(url)) return cache.get(url) ?? null;
  const dataUri = await fetchStaticMapDataUri(url);
  cache.set(url, dataUri);
  return dataUri;
}

export function resetStaticMapCache(): void {
  cache.clear();
}

/** Fetches the static map and inlines it, so a downloaded guide keeps it offline. */
export async function fetchStaticMapDataUri(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "image/png";
    if (!type.startsWith("image/")) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${type};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
  finally {
    clearTimeout(timer);
  }
}

/** Google's encoded polyline format, which Mapbox path overlays accept. */
export function encodePolyline(points: [number, number][]): string {
  let output = "";
  let previousLat = 0;
  let previousLon = 0;
  for (const [lat, lon] of points) {
    const roundedLat = Math.round(lat * 1e5);
    const roundedLon = Math.round(lon * 1e5);
    output += encodeValue(roundedLat - previousLat) + encodeValue(roundedLon - previousLon);
    previousLat = roundedLat;
    previousLon = roundedLon;
  }
  return output;
}

function encodeValue(value: number): string {
  let shifted = value < 0 ? ~(value << 1) : value << 1;
  let output = "";
  while (shifted >= 0x20) {
    output += String.fromCharCode((0x20 | (shifted & 0x1f)) + 63);
    shifted >>= 5;
  }
  output += String.fromCharCode(shifted + 63);
  return output;
}
