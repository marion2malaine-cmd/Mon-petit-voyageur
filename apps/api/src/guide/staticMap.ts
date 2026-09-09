import type { JourneyLeg, MapRoute } from "./renderGuide";

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
export function buildStaticMapUrl(routes: MapRoute[], token: string, size = "1200x640", legs: JourneyLeg[] = []): string | null {
  const overlays: string[] = [];

  // The thread of the trip first, so the day walks are drawn on top of it:
  // one line per hop, coloured and pinned by the way it is travelled.
  legs.forEach((leg) => {
    const style = LEG_STYLES[leg.mode] ?? LEG_STYLES.car;
    overlays.push(
      `path-3+${style.colour}-0.9(${encodeURIComponent(encodePolyline([[leg.from.lat, leg.from.lon], [leg.to.lat, leg.to.lon]]))})`
    );
    overlays.push(
      `pin-s-${style.pin}+${style.colour}(${((leg.from.lon + leg.to.lon) / 2).toFixed(5)},${((leg.from.lat + leg.to.lat) / 2).toFixed(5)})`
    );
  });

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

// Mapbox maki icons that exist on the static pins, per way of travelling.
const LEG_STYLES: Record<string, { colour: string; pin: string }> = {
  car: { colour: "c0664a", pin: "car" },
  train: { colour: "c0664a", pin: "rail" },
  bus: { colour: "c0664a", pin: "bus" },
  boat: { colour: "5b7f9c", pin: "ferry" },
  plane: { colour: "22384a", pin: "airport" },
  foot: { colour: "78a189", pin: "pitch" }
};

// A guide is previewed, downloaded and mailed: the same picture three times.
const cache = new Map<string, string | null>();

/**
 * The still map of the trip as a data URI, ready to be inlined so the guide
 * shows it before the interactive map loads, offline and on paper.
 */
export async function stillMapDataUri(
  routes: MapRoute[],
  serverToken: string | null | undefined,
  legs: JourneyLeg[] = []
): Promise<string | null> {
  if (!serverToken) return null;
  const url = buildStaticMapUrl(routes, serverToken, "1200x640", legs);
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
