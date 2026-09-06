import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { degraded, errored, ok, type ToolContext, type ToolResult } from "./types";

/**
 * Live flight and hotel prices through SerpApi's Google Flights and Google
 * Hotels engines. Replaces Amadeus Self-Service, decommissioned in July 2026.
 *
 * The free plan allows 250 searches a month and one trip plan costs two, so
 * every search is treated as precious:
 * - nothing is searched without exact dates and a known airport — a guess
 *   ("in 30 days") would burn a search on a fare nobody wants;
 * - answers are cached on disk for a day, across server restarts, so the same
 *   trip planned twice (or a guide regenerated) costs nothing;
 * - a local monthly cap keeps a margin under the plan, and an exhausted quota
 *   degrades to the pre-filled booking links instead of failing the plan.
 */

export interface FlightsInput {
  originCity: string;
  destinationCity: string;
  departureDate?: string | null;
  returnDate?: string | null;
  adults?: number;
  currency?: string;
  locale?: "fr" | "en";
}

export interface HotelsInput {
  city: string;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  adults?: number;
  currency?: string;
  locale?: "fr" | "en";
}

const SERPAPI_URL = "https://serpapi.com/search.json";
const TIMEOUT_MS = 25_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS = 5;
// Below this Google rating a property is only kept when nothing better exists.
const MIN_HOTEL_RATING = 3.8;

// Google Flights wants airport or metro codes, never city names. Amadeus used
// to resolve those through its own API; this table covers the departure
// cities of a French audience and the destinations the app is asked about.
// Multi-airport metros list every airport so no fare is missed.
const AIRPORT_CODES: Record<string, string> = {
  // France
  paris: "CDG,ORY", lyon: "LYS", marseille: "MRS", nice: "NCE", toulouse: "TLS", bordeaux: "BOD",
  nantes: "NTE", lille: "LIL", strasbourg: "SXB", montpellier: "MPL", rennes: "RNS", brest: "BES",
  bale: "BSL", mulhouse: "BSL", "bale-mulhouse": "BSL", biarritz: "BIQ", ajaccio: "AJA", bastia: "BIA",
  corse: "AJA,BIA", corsica: "AJA,BIA", "cote d'azur": "NCE", "cote d azur": "NCE",
  // Europe
  london: "LHR,LGW,STN,LTN", londres: "LHR,LGW,STN,LTN", dublin: "DUB", edinburgh: "EDI", edimbourg: "EDI",
  amsterdam: "AMS", bruxelles: "BRU", brussels: "BRU", bruges: "BRU", berlin: "BER", munich: "MUC",
  munchen: "MUC", frankfurt: "FRA", francfort: "FRA", hamburg: "HAM", hambourg: "HAM", vienne: "VIE",
  vienna: "VIE", wien: "VIE", zurich: "ZRH", geneve: "GVA", geneva: "GVA", interlaken: "ZRH",
  prague: "PRG", budapest: "BUD", varsovie: "WAW", warsaw: "WAW", cracovie: "KRK", krakow: "KRK",
  copenhague: "CPH", copenhagen: "CPH", stockholm: "ARN", oslo: "OSL", helsinki: "HEL", reykjavik: "KEF",
  islande: "KEF", iceland: "KEF",
  lisbonne: "LIS", lisbon: "LIS", porto: "OPO", faro: "FAO", algarve: "FAO", madere: "FNC", madeira: "FNC",
  funchal: "FNC", acores: "PDL", azores: "PDL",
  madrid: "MAD", barcelone: "BCN", barcelona: "BCN", seville: "SVQ", sevilla: "SVQ", valence: "VLC",
  valencia: "VLC", malaga: "AGP", andalousie: "AGP", andalusia: "AGP", bilbao: "BIO", "san sebastian": "EAS",
  "saint-sebastien": "EAS", majorque: "PMI", mallorca: "PMI", palma: "PMI", ibiza: "IBZ", minorque: "MAH",
  menorca: "MAH", tenerife: "TFS,TFN", canaries: "TFS,TFN,LPA", "canary islands": "TFS,TFN,LPA",
  "gran canaria": "LPA", lanzarote: "ACE", fuerteventura: "FUE",
  rome: "FCO,CIA", roma: "FCO,CIA", milan: "MXP,LIN,BGY", milano: "MXP,LIN,BGY", venise: "VCE", venice: "VCE",
  venezia: "VCE", florence: "FLR,PSA", firenze: "FLR,PSA", toscane: "FLR,PSA", tuscany: "FLR,PSA",
  naples: "NAP", napoli: "NAP", "cote amalfitaine": "NAP", "amalfi coast": "NAP", sicile: "CTA,PMO",
  sicily: "CTA,PMO", palerme: "PMO", palermo: "PMO", catane: "CTA", catania: "CTA", sardaigne: "CAG,OLB",
  sardinia: "CAG,OLB", cagliari: "CAG", bologne: "BLQ", bologna: "BLQ", turin: "TRN", torino: "TRN",
  "lac de come": "MXP", "lake como": "MXP", pouilles: "BRI,BDS", puglia: "BRI,BDS", bari: "BRI",
  athenes: "ATH", athens: "ATH", crete: "HER,CHQ", heraklion: "HER", iraklio: "HER", chania: "CHQ",
  "la canee": "CHQ", rhodes: "RHO", santorin: "JTR", santorini: "JTR", mykonos: "JMK", corfou: "CFU",
  corfu: "CFU", thessalonique: "SKG", thessaloniki: "SKG", cyclades: "JTR,JMK",
  dubrovnik: "DBV", split: "SPU", zagreb: "ZAG", croatie: "SPU,DBV", croatia: "SPU,DBV", malte: "MLA",
  malta: "MLA", chypre: "LCA,PFO", cyprus: "LCA,PFO", istanbul: "IST,SAW", cappadoce: "NAV,ASR",
  cappadocia: "NAV,ASR", antalya: "AYT", bodrum: "BJV", izmir: "ADB",
  // Maghreb, Middle East, Africa
  marrakech: "RAK", marrakesh: "RAK", casablanca: "CMN", agadir: "AGA", fes: "FEZ", fez: "FEZ",
  essaouira: "ESU", tanger: "TNG", tunis: "TUN", djerba: "DJE", alger: "ALG", "le caire": "CAI", cairo: "CAI",
  louxor: "LXR", luxor: "LXR", hurghada: "HRG", dubai: "DXB,DWC", "abou dabi": "AUH", "abu dhabi": "AUH",
  doha: "DOH", mascate: "MCT", muscat: "MCT", oman: "MCT", amman: "AMM", jordanie: "AMM", jordan: "AMM",
  petra: "AMM", "tel aviv": "TLV", dakar: "DSS", senegal: "DSS", "cap-vert": "SID,RAI", "cap vert": "SID,RAI",
  "cape verde": "SID,RAI", nairobi: "NBO", kenya: "NBO", zanzibar: "ZNZ", tanzanie: "JRO,ZNZ",
  tanzania: "JRO,ZNZ", "le cap": "CPT", "cape town": "CPT", johannesburg: "JNB", "afrique du sud": "CPT,JNB",
  "south africa": "CPT,JNB", maurice: "MRU", "ile maurice": "MRU", mauritius: "MRU", reunion: "RUN",
  "la reunion": "RUN", seychelles: "SEZ", madagascar: "TNR", "nosy be": "NOS",
  // Americas
  "new york": "JFK,EWR,LGA", nyc: "JFK,EWR,LGA", boston: "BOS", washington: "IAD,DCA", chicago: "ORD,MDW",
  miami: "MIA", orlando: "MCO", floride: "MIA,MCO", florida: "MIA,MCO", "los angeles": "LAX",
  "san francisco": "SFO", "las vegas": "LAS", californie: "LAX,SFO", california: "LAX,SFO", seattle: "SEA",
  "la nouvelle-orleans": "MSY", "new orleans": "MSY", montreal: "YUL", quebec: "YQB", toronto: "YYZ",
  vancouver: "YVR", canada: "YUL,YYZ", mexico: "MEX", cancun: "CUN", yucatan: "CUN", "riviera maya": "CUN",
  "la havane": "HAV", havana: "HAV", cuba: "HAV", "republique dominicaine": "PUJ,SDQ", "punta cana": "PUJ",
  "dominican republic": "PUJ,SDQ", guadeloupe: "PTP", martinique: "FDF", "saint-martin": "SXM",
  "costa rica": "SJO", "san jose": "SJO", panama: "PTY", colombie: "BOG,CTG", colombia: "BOG,CTG",
  bogota: "BOG", carthagene: "CTG", cartagena: "CTG", perou: "LIM", peru: "LIM", lima: "LIM", cusco: "CUZ",
  bolivie: "LPB", "la paz": "LPB", chili: "SCL", chile: "SCL", santiago: "SCL", argentine: "EZE,AEP",
  argentina: "EZE,AEP", "buenos aires": "EZE,AEP", bresil: "GRU,GIG", brazil: "GRU,GIG",
  "rio de janeiro": "GIG,SDU", rio: "GIG,SDU", "sao paulo": "GRU,CGH",
  // Asia, Oceania
  tokyo: "NRT,HND", kyoto: "KIX,ITM", osaka: "KIX,ITM", japon: "NRT,HND", japan: "NRT,HND", seoul: "ICN",
  coree: "ICN", korea: "ICN", pekin: "PEK,PKX", beijing: "PEK,PKX", shanghai: "PVG,SHA", "hong kong": "HKG",
  taipei: "TPE", taiwan: "TPE", bangkok: "BKK,DMK", thailande: "BKK,DMK", thailand: "BKK,DMK",
  phuket: "HKT", "chiang mai": "CNX", "koh samui": "USM", hanoi: "HAN", "ho chi minh": "SGN", saigon: "SGN",
  vietnam: "HAN,SGN", "da nang": "DAD", cambodge: "PNH,REP", cambodia: "PNH,REP", "siem reap": "REP",
  "phnom penh": "PNH", laos: "VTE,LPQ", "luang prabang": "LPQ", singapour: "SIN", singapore: "SIN",
  "kuala lumpur": "KUL", malaisie: "KUL", malaysia: "KUL", bali: "DPS", denpasar: "DPS", indonesie: "DPS,CGK",
  indonesia: "DPS,CGK", jakarta: "CGK", manille: "MNL", manila: "MNL", philippines: "MNL,CEB", cebu: "CEB",
  "sri lanka": "CMB", colombo: "CMB", maldives: "MLE", male: "MLE", inde: "DEL,BOM", india: "DEL,BOM",
  delhi: "DEL", "new delhi": "DEL", mumbai: "BOM", bombay: "BOM", goa: "GOI", rajasthan: "JAI", jaipur: "JAI",
  kerala: "COK", nepal: "KTM", katmandou: "KTM", kathmandu: "KTM", ouzbekistan: "TAS", uzbekistan: "TAS",
  tachkent: "TAS", tashkent: "TAS", samarcande: "SKD", samarkand: "SKD", sydney: "SYD", melbourne: "MEL",
  australie: "SYD,MEL", australia: "SYD,MEL", "nouvelle-zelande": "AKL,CHC", "new zealand": "AKL,CHC",
  auckland: "AKL", polynesie: "PPT", tahiti: "PPT", "nouvelle-caledonie": "NOU", noumea: "NOU", fidji: "NAN",
  fiji: "NAN"
};

/**
 * Airport code(s) for a place name. "Héraklion, Crète" is tried segment by
 * segment (the city first, then the region), each normalised without accents.
 */
export function resolveAirportCodes(place: string | null | undefined): string | null {
  if (!place) return null;
  const segments = place
    .split(/[,/()]/)
    .map(normalizePlace)
    .filter(Boolean);
  for (const segment of segments) {
    if (AIRPORT_CODES[segment]) return AIRPORT_CODES[segment];
    // "Île de Crète", "Sud de la Corse": the last word often is the place.
    const words = segment.split(" ");
    const tail = words[words.length - 1];
    if (words.length > 1 && AIRPORT_CODES[tail]) return AIRPORT_CODES[tail];
  }
  // A bare IATA code, as an LLM sometimes writes ("CDG").
  const bare = place.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(bare)) return bare;
  return null;
}

function normalizePlace(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^\s*(ile|island|isla)\s+(de|d'|of)\s+/, "")
    .replace(/[^a-z'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function searchFlights(ctx: ToolContext, input: FlightsInput): Promise<ToolResult<unknown>> {
  const source = "serpapi-google-flights";
  if (!ctx.config.SERPAPI_API_KEY) {
    return degraded(source, { offers: [] }, ["SERPAPI_API_KEY is missing"], null);
  }

  // No guessed dates: a search on "some day next month" costs a credit and
  // prices nobody will fly at.
  const departureDate = input.departureDate ?? null;
  const returnDate = input.returnDate ?? null;
  if (!departureDate || !returnDate || !ISO_DATE.test(departureDate) || !ISO_DATE.test(returnDate)) {
    return degraded(source, { offers: [] }, ["Exact travel dates are missing: no live flight search was made"], null);
  }

  const originCode = resolveAirportCodes(input.originCity);
  const destinationCode = resolveAirportCodes(input.destinationCity);
  if (!originCode || !destinationCode) {
    const unknown = [!originCode && input.originCity, !destinationCode && input.destinationCity].filter(Boolean);
    return degraded(source, { offers: [] }, [`No airport code known for: ${unknown.join(", ")}`], null);
  }

  const currency = input.currency ?? "EUR";
  const adults = Math.max(1, input.adults ?? 1);
  const locale = input.locale ?? "fr";

  const params = new URLSearchParams({
    engine: "google_flights",
    departure_id: originCode,
    arrival_id: destinationCode,
    outbound_date: departureDate,
    return_date: returnDate,
    type: "1",
    adults: String(adults),
    currency,
    hl: locale,
    gl: "fr"
  });

  try {
    const { json, url, cached } = await query(ctx, params);
    if (json.error) {
      return degraded(source, { offers: [] }, [describeError(json.error)], url);
    }

    const bookingUrl = googleFlightsUrl(originCode, destinationCode, departureDate, returnDate, locale, currency);
    const candidates: any[] = [...(json.best_flights ?? []), ...(json.other_flights ?? [])];
    const seen = new Set<string>();
    const offers = candidates
      .filter((offer) => Number.isFinite(Number(offer?.price)))
      .sort((left, right) => Number(left.price) - Number(right.price))
      .map((offer) => {
        const segments: any[] = offer.flights ?? [];
        const airlines = [...new Set(segments.map((segment) => segment.airline).filter(Boolean))];
        const layovers = (offer.layovers ?? []).map((layover: any) => layover.id ?? layover.name).filter(Boolean);
        const departureTime = segments[0]?.departure_airport?.time ?? "";
        return {
          label: `${input.originCity} -> ${input.destinationCity}`,
          price: Number(offer.price),
          currency,
          total_duration: formatDuration(offer.total_duration),
          stops: Math.max(0, segments.length - 1),
          notes: [
            `Carrier: ${airlines.join(", ") || "n/a"}`,
            layovers.length ? `Via ${layovers.join(", ")}` : "Direct",
            departureTime ? `${locale === "fr" ? "Départ" : "Departs"} ${departureTime.slice(11, 16) || departureTime}` : ""
          ].filter(Boolean),
          link: bookingUrl,
          // Airline + price + departure identify a fare; Google lists the same
          // one several times when several return legs pair with it.
          fingerprint: `${airlines.join("+")}|${offer.price}|${departureTime}`
        };
      })
      .filter((offer) => (seen.has(offer.fingerprint) ? false : (seen.add(offer.fingerprint), true)))
      .slice(0, MAX_RESULTS)
      .map(({ fingerprint: _fingerprint, ...offer }) => offer);

    const data = {
      offers,
      origin_code: originCode.split(",")[0],
      destination_code: destinationCode.split(",")[0],
      departure_date: departureDate,
      return_date: returnDate,
      price_insights: json.price_insights
        ? {
            lowest_price: json.price_insights.lowest_price ?? null,
            price_level: json.price_insights.price_level ?? null,
            typical_price_range: json.price_insights.typical_price_range ?? null
          }
        : null,
      cached
    };

    return offers.length ? ok(source, data, url) : degraded(source, data, ["Google Flights returned no itinerary"], url);
  } catch (error) {
    return errored(source, `Flight search error: ${(error as Error).message}`);
  }
}

export async function searchHotels(ctx: ToolContext, input: HotelsInput): Promise<ToolResult<unknown>> {
  const source = "serpapi-google-hotels";
  if (!ctx.config.SERPAPI_API_KEY) {
    return degraded(source, { stays: [] }, ["SERPAPI_API_KEY is missing"], null);
  }

  const checkInDate = input.checkInDate ?? null;
  const checkOutDate = input.checkOutDate ?? null;
  if (!checkInDate || !checkOutDate || !ISO_DATE.test(checkInDate) || !ISO_DATE.test(checkOutDate)) {
    return degraded(source, { stays: [] }, ["Exact travel dates are missing: no live hotel search was made"], null);
  }
  if (!input.city?.trim()) {
    return degraded(source, { stays: [] }, ["Destination is missing"], null);
  }

  const currency = input.currency ?? "EUR";
  const adults = Math.max(1, input.adults ?? 1);
  const locale = input.locale ?? "fr";

  const params = new URLSearchParams({
    engine: "google_hotels",
    q: input.city.trim(),
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    adults: String(adults),
    currency,
    hl: locale,
    gl: "fr"
  });

  try {
    const { json, url, cached } = await query(ctx, params);
    if (json.error) {
      return degraded(source, { stays: [] }, [describeError(json.error)], url);
    }

    const all = ((json.properties ?? []) as any[])
      .filter((property) => property?.name && property.rate_per_night?.extracted_lowest != null)
      .map((property) => {
        const total = property.total_rate?.extracted_lowest ?? null;
        const rating = property.overall_rating != null ? Math.round(Number(property.overall_rating) * 10) / 10 : null;
        return {
          name: property.name,
          area: property.nearby_places?.[0]?.name ?? input.city,
          rating,
          price_per_night: Number(property.rate_per_night.extracted_lowest),
          currency,
          notes: [
            property.hotel_class ? `${property.hotel_class}` : "",
            property.reviews ? `${property.reviews} ${locale === "fr" ? "avis" : "reviews"}` : "",
            total != null ? `${locale === "fr" ? "Séjour" : "Stay"} ${Math.round(Number(total))} ${currency}` : "",
            property.type && property.type !== "hotel" ? property.type : ""
          ].filter(Boolean),
          link: property.link ?? null
        };
      });

    // Cheapest first is the promise, but a 3.5-star dump is not a deal: the
    // well-rated properties are ranked first, the rest only fill the gaps.
    const good = all.filter((stay) => stay.rating === null || stay.rating >= MIN_HOTEL_RATING);
    const byPrice = (left: { price_per_night: number }, right: { price_per_night: number }) =>
      left.price_per_night - right.price_per_night;
    const stays = [...good.sort(byPrice), ...all.filter((stay) => !good.includes(stay)).sort(byPrice)].slice(0, MAX_RESULTS);

    const data = { stays, check_in: checkInDate, check_out: checkOutDate, cached };
    return stays.length ? ok(source, data, url) : degraded(source, data, ["Google Hotels returned no property"], url);
  } catch (error) {
    return errored(source, `Hotel search error: ${(error as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Cache and quota. One JSON file next to the SQLite database holds the recent
// answers and this month's search count, so neither a restart nor a redeploy
// spends the plan again. Tests and ":memory:" databases stay in memory.
// ---------------------------------------------------------------------------

interface CacheStore {
  version: 1;
  entries: Record<string, { expiresAt: number; result: unknown }>;
  usage: { month: string; searches: number };
}

let store: CacheStore | null = null;
let storeFile: string | null | undefined;

function storePath(ctx: ToolContext): string | null {
  if (ctx.config.SERPAPI_CACHE_PATH) return path.resolve(ctx.config.SERPAPI_CACHE_PATH);
  if (ctx.config.NODE_ENV === "test" || ctx.config.SQLITE_PATH === ":memory:") return null;
  return path.resolve(path.dirname(ctx.config.SQLITE_PATH), "serpapi-cache.json");
}

function loadStore(ctx: ToolContext): CacheStore {
  const file = storePath(ctx);
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
  store = loaded ?? { version: 1, entries: {}, usage: { month: monthKey(), searches: 0 } };
  storeFile = file;

  const now = Date.now();
  for (const [key, entry] of Object.entries(store.entries)) {
    if (entry.expiresAt <= now) delete store.entries[key];
  }
  if (store.usage.month !== monthKey()) store.usage = { month: monthKey(), searches: 0 };
  return store;
}

function saveStore(ctx: ToolContext): void {
  const file = storePath(ctx);
  if (!file || !store) return;
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(store));
  } catch {
    // Losing the cache costs a search later, never the plan now.
  }
}

function monthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Searches still allowed this month under the local cap. */
export function searchesLeft(ctx: ToolContext): number {
  const current = loadStore(ctx);
  return Math.max(0, (ctx.config.SERPAPI_MONTHLY_CAP ?? 200) - current.usage.searches);
}

/** One SerpApi call, served from the cache when the same search ran recently. */
async function query(
  ctx: ToolContext,
  params: URLSearchParams,
  ttlMs = CACHE_TTL_MS
): Promise<{ json: any; url: string; cached: boolean }> {
  const key = params.toString();
  // The reference stored with the trip never carries the key.
  const url = `${SERPAPI_URL}?${key}`;
  const current = loadStore(ctx);
  const hit = current.entries[key];
  if (hit && hit.expiresAt > Date.now()) {
    return { json: hit.result, url, cached: true };
  }

  if (searchesLeft(ctx) <= 0) {
    return {
      json: { error: `Local monthly cap reached (${ctx.config.SERPAPI_MONTHLY_CAP ?? 200} searches)` },
      url,
      cached: false
    };
  }

  const fetchFn = ctx.fetchFn ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchFn(`${url}&api_key=${encodeURIComponent(ctx.config.SERPAPI_API_KEY!)}`, {
      signal: controller.signal
    });
    const json = (await response.json().catch(() => ({}))) as any;
    if (!response.ok && !json.error) {
      json.error = `SerpApi returned ${response.status}`;
    }
    // Only a real answer is worth keeping: a quota error must be retried once
    // the plan resets, not remembered for a day. Only a real answer was billed.
    if (!json.error) {
      current.entries[key] = { expiresAt: Date.now() + ttlMs, result: json };
      current.usage.searches += 1;
      saveStore(ctx);
    }
    return { json, url, cached: false };
  } finally {
    clearTimeout(timer);
  }
}

function describeError(error: string): string {
  return /exhausted|limit|quota|cap reached/i.test(error) ? `SerpApi quota exhausted: ${error}` : `SerpApi: ${error}`;
}

function googleFlightsUrl(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  locale: string,
  currency: string
): string {
  const q = `Flights from ${origin.split(",")[0]} to ${destination.split(",")[0]} on ${departureDate} through ${returnDate}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&hl=${locale}&curr=${currency}`;
}

function formatDuration(minutes: unknown): string | null {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) return null;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

export function resetSerpApiCache(): void {
  store = null;
  storeFile = undefined;
}

// ---------------------------------------------------------------------------
// Restaurants and forum threads. Places and threads change slowly, so they are
// kept a week: the second traveler planning the same town pays nothing.
// ---------------------------------------------------------------------------

const PLACES_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PLACES = 15;
const MAX_FINDINGS = 10;

export interface RestaurantsInput {
  /** The day's area ("Archanes", "Vieille ville de La Canée"). */
  area: string;
  destination: string;
  locale?: "fr" | "en";
}

export interface PlaceResult {
  name: string;
  rating: number | null;
  reviews_count: number | null;
  price: "€" | "€€" | "€€€" | "€€€€" | null;
  cuisine: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  maps_url: string | null;
  place_id: string | null;
  /** Where Google Maps puts the place. */
  coordinates: { lat: number; lon: number } | null;
  /** Google Maps photo of the place, when it has one. */
  thumbnail: string | null;
  description: string | null;
}

/**
 * Real, rated restaurants around an area, from Google Maps. Only places with
 * a solid rating and enough reviews to trust it are returned, best first.
 */
export async function searchRestaurants(ctx: ToolContext, input: RestaurantsInput): Promise<ToolResult<unknown>> {
  const source = "serpapi-google-maps";
  if (!ctx.config.SERPAPI_API_KEY) {
    return degraded(source, { places: [] }, ["SERPAPI_API_KEY is missing"], null);
  }
  const area = input.area?.trim();
  if (!area) return degraded(source, { places: [] }, ["Area is missing"], null);

  const locale = input.locale ?? "fr";
  const where = /\b(crete|crète|corse|sicile|sardaigne)\b/i.test(area) || area.toLowerCase().includes(input.destination.toLowerCase())
    ? area
    : `${area}, ${input.destination}`;
  const params = new URLSearchParams({
    engine: "google_maps",
    type: "search",
    q: `${locale === "fr" ? "restaurants" : "restaurants"} ${where}`,
    hl: locale,
    gl: "fr"
  });

  try {
    const { json, url, cached } = await query(ctx, params, PLACES_TTL_MS);
    if (json.error) return degraded(source, { places: [] }, [describeError(json.error)], url);

    const all: PlaceResult[] = ((json.local_results ?? []) as any[])
      .filter((place) => place?.title)
      .map((place) => {
        const name = String(place.title);
        const address = place.address ? String(place.address) : null;
        const mapsQuery = encodeURIComponent([name, address].filter(Boolean).join(" "));
        return {
          name,
          rating: place.rating != null ? Math.round(Number(place.rating) * 10) / 10 : null,
          reviews_count: place.reviews != null ? Number(place.reviews) : null,
          price: normalizePrice(place.price),
          cuisine: place.type ? String(place.type) : Array.isArray(place.types) ? String(place.types[0] ?? "") || null : null,
          address,
          phone: place.phone ? String(place.phone) : null,
          website: place.website ? String(place.website) : null,
          maps_url: `https://www.google.com/maps/search/?api=1&query=${mapsQuery}${place.place_id ? `&query_place_id=${encodeURIComponent(place.place_id)}` : ""}`,
          place_id: place.place_id ? String(place.place_id) : null,
          coordinates:
            Number.isFinite(Number(place.gps_coordinates?.latitude)) && Number.isFinite(Number(place.gps_coordinates?.longitude))
              ? { lat: Number(place.gps_coordinates.latitude), lon: Number(place.gps_coordinates.longitude) }
              : null,
          thumbnail: typeof place.thumbnail === "string" && /^https?:\/\//i.test(place.thumbnail) ? place.thumbnail : null,
          description: place.description ? String(place.description) : null
        };
      });

    // A rating only means something with reviews behind it. The bar drops a
    // notch when the area is small, rather than returning nothing.
    const trusted = all.filter((place) => (place.rating ?? 0) >= 4.2 && (place.reviews_count ?? 0) >= 50);
    const pool = trusted.length >= 6 ? trusted : all.filter((place) => (place.rating ?? 0) >= 4.0 && (place.reviews_count ?? 0) >= 20);
    const places = pool
      .sort((left, right) => placeScore(right) - placeScore(left))
      .slice(0, MAX_PLACES);

    const data = { places, area, cached };
    return places.length ? ok(source, data, url) : degraded(source, data, ["Google Maps returned no trusted restaurant"], url);
  } catch (error) {
    return errored(source, `Restaurant search error: ${(error as Error).message}`);
  }
}

// 4.6 with 800 reviews beats 4.9 with 12: the review count is what makes the
// rating credible, on a log scale so a chain does not crush a good taverna.
function placeScore(place: PlaceResult): number {
  const base = (place.rating ?? 0) + Math.log10((place.reviews_count ?? 0) + 1) / 4;
  // A guide sends people to the local table, not to the best-rated burger in
  // town: imported cuisines and chains drop below comparable local places.
  const penalty = IMPORTED_CUISINE.test(place.cuisine ?? "") ? 0.8 : 0;
  // A table with a view is what the traveler remembers: a modest boost, so
  // it wins ties against an equally good place without one.
  const view = SCENIC.test(`${place.name} ${place.description ?? ""}`) ? 0.25 : 0;
  return base - penalty + view;
}

const SCENIC = /\b(vue|view|terrasse|terrace|rooftop|panoram|bord de mer|seaside|sea ?front|beach|plage|port|harbou?r|marina|sunset|coucher)/i;

const IMPORTED_CUISINE =
  /mexic|steak|burger|pizz|fast.?food|sushi|japon|japan|chin|indi|thaï|thai|kebab|américain|american|tex.?mex|snack|café|coffee|bar\b|pub\b/i;

function normalizePrice(value: unknown): PlaceResult["price"] {
  if (typeof value !== "string") return null;
  const level = (value.match(/[€$£]/g) ?? []).length;
  return level >= 1 && level <= 4 ? ("€".repeat(level) as PlaceResult["price"]) : null;
}

export interface ForumInput {
  destination: string;
  locale?: "fr" | "en";
  /** Optional focus ("Knossos", "Balos boat trip") for a narrower thread search. */
  topic?: string | null;
}

/**
 * Real forum threads about the destination — TripAdvisor, Routard and Reddit —
 * with their snippets, so the guide's tips are grounded in what travelers
 * wrote and link to the threads themselves.
 */
export async function searchForumThreads(ctx: ToolContext, input: ForumInput): Promise<ToolResult<unknown>> {
  const source = "serpapi-google-forums";
  if (!ctx.config.SERPAPI_API_KEY) {
    return degraded(source, { findings: [] }, ["SERPAPI_API_KEY is missing"], null);
  }
  const destination = input.destination?.trim();
  if (!destination) return degraded(source, { findings: [] }, ["Destination is missing"], null);

  const locale = input.locale ?? "fr";
  const sites = locale === "fr" ? "site:tripadvisor.fr OR site:routard.com OR site:reddit.com" : "site:tripadvisor.com OR site:reddit.com";
  const focus = input.topic?.trim() ? `${input.topic.trim()} ` : "";
  const words = locale === "fr" ? "conseils bons plans à éviter" : "tips advice avoid";
  const params = new URLSearchParams({
    engine: "google",
    q: `(${sites}) ${focus}${destination} ${words}`,
    hl: locale,
    gl: "fr",
    num: "10"
  });

  try {
    const { json, url, cached } = await query(ctx, params, PLACES_TTL_MS);
    if (json.error) return degraded(source, { findings: [] }, [describeError(json.error)], url);

    const findings = ((json.organic_results ?? []) as any[])
      // Third-party data: only web links may reach a href.
      .filter((result) => result?.title && /^https?:\/\//i.test(String(result?.link ?? "")))
      .map((result) => ({
        title: String(result.title),
        url: String(result.link),
        snippet: String(result.snippet ?? "").trim(),
        source: forumSource(String(result.link))
      }))
      .slice(0, MAX_FINDINGS);

    const data = { findings, cached };
    return findings.length ? ok(source, data, url) : degraded(source, data, ["No forum thread found"], url);
  } catch (error) {
    return errored(source, `Forum search error: ${(error as Error).message}`);
  }
}

function forumSource(link: string): string {
  if (/tripadvisor\./i.test(link)) return "TripAdvisor";
  if (/routard\.com/i.test(link)) return "Routard";
  if (/reddit\.com/i.test(link)) return "Reddit";
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// GetYourGuide offers. Their API is partners-only, but one web search scoped
// to their site lists the destination's activity pages with "from X €" in the
// snippet: real links and real prices for the popular activities, one credit
// per destination, kept a week.
// ---------------------------------------------------------------------------

export interface GygOffer {
  title: string;
  url: string;
  price_from_eur: number | null;
  snippet: string;
}

export async function searchGetYourGuideOffers(
  ctx: ToolContext,
  input: { destination: string; locale?: "fr" | "en" }
): Promise<ToolResult<unknown>> {
  const source = "serpapi-getyourguide";
  if (!ctx.config.SERPAPI_API_KEY) {
    return degraded(source, { offers: [] }, ["SERPAPI_API_KEY is missing"], null);
  }
  const destination = input.destination?.trim();
  if (!destination) return degraded(source, { offers: [] }, ["Destination is missing"], null);

  const locale = input.locale ?? "fr";
  const host = locale === "fr" ? "getyourguide.fr" : "getyourguide.com";
  const params = new URLSearchParams({
    engine: "google",
    q: `site:${host} ${destination}`,
    hl: locale,
    gl: "fr",
    num: "20"
  });

  try {
    const { json, url, cached } = await query(ctx, params, PLACES_TTL_MS);
    if (json.error) return degraded(source, { offers: [] }, [describeError(json.error)], url);

    const offers: GygOffer[] = ((json.organic_results ?? []) as any[])
      .filter((result) => result?.title && /^https?:\/\/(www\.)?getyourguide\./i.test(String(result?.link ?? "")))
      .map((result) => {
        const snippet = String(result.snippet ?? "");
        return {
          title: String(result.title).replace(/\s*\|\s*GetYourGuide.*$/i, "").trim(),
          url: String(result.link),
          price_from_eur: parseEuroPrice(`${snippet} ${result.rich_snippet?.top?.detected_extensions?.price ?? ""}`),
          snippet
        };
      });

    const data = { offers, cached };
    return offers.length ? ok(source, data, url) : degraded(source, data, ["No GetYourGuide page found"], url);
  } catch (error) {
    return errored(source, `GetYourGuide search error: ${(error as Error).message}`);
  }
}

/** "À partir de 45,00 € par personne" → 45; "€25" → 25; nothing → null. */
export function parseEuroPrice(text: string): number | null {
  const match = text.match(/(\d{1,4}(?:[.,]\d{1,2})?)\s?€|€\s?(\d{1,4}(?:[.,]\d{1,2})?)/);
  if (!match) return null;
  const value = Number((match[1] ?? match[2]).replace(",", "."));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}
