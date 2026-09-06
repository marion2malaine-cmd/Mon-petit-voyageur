import { degraded, errored, ok, type ToolContext, type ToolResult } from "./types";

/**
 * Month-wide flight prices from the Travelpayouts (Aviasales) Data API — the
 * "whole month at a glance" Skyscanner shows. Free with an affiliate account,
 * no per-call quota: it is what picks the dates before a single live search
 * is spent on the exact fare.
 *
 * Prices come from real searches made by Aviasales users in the last days,
 * so they are a reliable comparison across dates rather than a bookable
 * quote; the live search on the chosen dates provides that.
 */

const API_URL = "https://api.travelpayouts.com/aviasales/v3/grouped_prices";
const TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_MONTHS_AHEAD = 6;

const cache = new Map<string, { expiresAt: number; result: unknown }>();

// Aviasales addresses multi-airport cities by their metro code.
const METRO_CODES: Record<string, string> = {
  "CDG,ORY": "PAR",
  "LHR,LGW,STN,LTN": "LON",
  "MXP,LIN,BGY": "MIL",
  "FCO,CIA": "ROM",
  "JFK,EWR,LGA": "NYC",
  "NRT,HND": "TYO",
  "KIX,ITM": "OSA",
  "IST,SAW": "IST",
  "DXB,DWC": "DXB",
  "GRU,CGH": "SAO",
  "GIG,SDU": "RIO",
  "EZE,AEP": "BUE",
  "PEK,PKX": "BJS",
  "PVG,SHA": "SHA",
  "BKK,DMK": "BKK",
  "IAD,DCA": "WAS",
  "ORD,MDW": "CHI"
};

/** The single code Aviasales wants for a place: its metro code, else the first airport. */
export function toAviasalesCode(codes: string): string {
  return METRO_CODES[codes] ?? codes.split(",")[0];
}

export interface CalendarDay {
  /** Departure date, YYYY-MM-DD. */
  date: string;
  /** Return date, YYYY-MM-DD, when the API gave one. */
  return_date: string | null;
  /** Round-trip price for one adult. */
  price: number;
  transfers: number | null;
  airline: string | null;
  link: string | null;
}

export interface CalendarInput {
  originCodes: string;
  destinationCodes: string;
  /** YYYY-MM */
  month: string;
  /** Length of the stay in days; the API prices round trips of that length. */
  tripDuration: number;
  currency?: string;
}

/** Cheapest round trip for every departure day of a month. */
export async function getPriceCalendar(ctx: ToolContext, input: CalendarInput): Promise<ToolResult<unknown>> {
  const source = "travelpayouts-calendar";
  if (!ctx.config.TRAVELPAYOUTS_TOKEN) {
    return degraded(source, { days: [] }, ["TRAVELPAYOUTS_TOKEN is missing"], null);
  }
  if (!/^\d{4}-\d{2}$/.test(input.month)) {
    return degraded(source, { days: [] }, [`Invalid month: ${input.month}`], null);
  }

  const params = new URLSearchParams({
    origin: toAviasalesCode(input.originCodes),
    destination: toAviasalesCode(input.destinationCodes),
    departure_at: input.month,
    group_by: "departure_at",
    trip_duration: String(Math.max(1, Math.min(30, input.tripDuration))),
    currency: (input.currency ?? "EUR").toLowerCase(),
    market: "fr"
  });

  try {
    const { json, url } = await query(ctx, params);
    if (json?.success === false || json?.error) {
      return degraded(source, { days: [] }, [`Travelpayouts: ${json.error ?? "request refused"}`], url);
    }

    const days = parseDays(json?.data);
    const data = { days, month: input.month, origin: params.get("origin"), destination: params.get("destination") };
    return days.length ? ok(source, data, url) : degraded(source, data, ["No price known for that month"], url);
  } catch (error) {
    return errored(source, `Calendar error: ${(error as Error).message}`);
  }
}

export interface MonthsInput {
  originCodes: string;
  destinationCodes: string;
  tripDuration: number;
  currency?: string;
  /** How many months ahead to look, from next month. */
  months?: number;
  now?: Date;
}

/**
 * The cheapest known fare of each of the coming months, cheapest month first
 * — for a traveler who said "whenever".
 */
export async function getCheapestMonths(ctx: ToolContext, input: MonthsInput): Promise<ToolResult<unknown>> {
  const source = "travelpayouts-months";
  if (!ctx.config.TRAVELPAYOUTS_TOKEN) {
    return degraded(source, { months: [] }, ["TRAVELPAYOUTS_TOKEN is missing"], null);
  }

  const now = input.now ?? new Date();
  const count = Math.max(1, Math.min(MAX_MONTHS_AHEAD, input.months ?? MAX_MONTHS_AHEAD));
  const months = Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1 + index, 1));
    return date.toISOString().slice(0, 7);
  });

  try {
    const results = await Promise.all(
      months.map(async (month) => {
        const result = await getPriceCalendar(ctx, { ...input, month });
        const days = ((result.data as any)?.days ?? []) as CalendarDay[];
        const cheapest = days.slice().sort((left, right) => left.price - right.price)[0] ?? null;
        return cheapest ? { month, price: cheapest.price, date: cheapest.date, return_date: cheapest.return_date } : null;
      })
    );
    const ranked = results.filter((entry): entry is NonNullable<typeof entry> => !!entry).sort((left, right) => left.price - right.price);
    return ranked.length ? ok(source, { months: ranked }, null) : degraded(source, { months: [] }, ["No price known for the coming months"], null);
  } catch (error) {
    return errored(source, `Months error: ${(error as Error).message}`);
  }
}

// The v3 answer is either an object keyed by date or an array of entries.
function parseDays(data: unknown): CalendarDay[] {
  const entries: any[] = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? Object.entries(data as Record<string, any>).map(([key, value]) => ({ departure_at: key, ...(value ?? {}) }))
      : [];

  return entries
    .map((entry) => {
      const date = String(entry.departure_at ?? entry.depart_date ?? "").slice(0, 10);
      const price = Number(entry.price ?? entry.value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(price) || price <= 0) return null;
      return {
        date,
        return_date: entry.return_at ? String(entry.return_at).slice(0, 10) : null,
        price: Math.round(price),
        transfers: entry.transfers != null ? Number(entry.transfers) : null,
        airline: entry.airline ? String(entry.airline) : null,
        link: typeof entry.link === "string" && entry.link.startsWith("/") ? `https://www.aviasales.com${entry.link}` : null
      } as CalendarDay;
    })
    .filter((day): day is CalendarDay => !!day)
    .sort((left, right) => left.date.localeCompare(right.date));
}

async function query(ctx: ToolContext, params: URLSearchParams): Promise<{ json: any; url: string }> {
  const key = params.toString();
  const url = `${API_URL}?${key}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return { json: hit.result, url };

  const fetchFn = ctx.fetchFn ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // The token travels in a header, never in the URL kept with the trip.
    const response = await fetchFn(url, {
      headers: { "X-Access-Token": ctx.config.TRAVELPAYOUTS_TOKEN!, Accept: "application/json" },
      signal: controller.signal
    });
    const json = (await response.json().catch(() => ({}))) as any;
    if (!response.ok && !json.error) json.error = `HTTP ${response.status}`;
    if (!json.error) cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, result: json });
    return { json, url };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The Aviasales search for a route and dates, with the site's affiliate
 * marker when one is configured: the traveler lands on the month view.
 */
export function aviasalesSearchUrl(
  originCodes: string,
  destinationCodes: string,
  departureDate: string,
  returnDate: string | null,
  adults: number,
  marker?: string | null
): string {
  const ddmm = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}`;
  const path = `${toAviasalesCode(originCodes)}${ddmm(departureDate)}${toAviasalesCode(destinationCodes)}${returnDate ? ddmm(returnDate) : ""}${Math.max(1, adults)}`;
  const url = new URL(`https://www.aviasales.com/search/${path}`);
  if (marker) url.searchParams.set("marker", marker);
  return url.toString();
}

export function resetTravelpayoutsCache(): void {
  cache.clear();
}
