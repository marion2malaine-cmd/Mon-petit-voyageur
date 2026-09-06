import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { resetSerpApiCache, resolveAirportCodes, searchFlights, searchHotels, searchesLeft } from "../tools/serpapi";

const config = { NODE_ENV: "test", SQLITE_PATH: ":memory:", SERPAPI_API_KEY: "test-key", SERPAPI_MONTHLY_CAP: 200 } as any;
const DATES = { departureDate: "2026-09-05", returnDate: "2026-09-10" };

// A fetch stand-in that answers with a fixed JSON body and records the URLs.
function fakeFetch(body: unknown, status = 200) {
  const calls: string[] = [];
  const fetchFn = (async (url: string) => {
    calls.push(url);
    return { ok: status < 400, status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

describe("resolveAirportCodes", () => {
  it("knows French departure cities and multi-airport metros", () => {
    expect(resolveAirportCodes("Paris")).toBe("CDG,ORY");
    expect(resolveAirportCodes("Lyon")).toBe("LYS");
  });

  it("reads a destination segment by segment, without accents", () => {
    expect(resolveAirportCodes("Héraklion, Crète")).toBe("HER");
    expect(resolveAirportCodes("Crète")).toBe("HER,CHQ");
    expect(resolveAirportCodes("Île de Crète")).toBe("HER,CHQ");
    expect(resolveAirportCodes("Séville")).toBe("SVQ");
  });

  it("accepts a bare IATA code and rejects the unknown", () => {
    expect(resolveAirportCodes("BCN")).toBe("BCN");
    expect(resolveAirportCodes("Trifouillis-les-Oies")).toBeNull();
    expect(resolveAirportCodes(null)).toBeNull();
  });
});

describe("searchFlights", () => {
  beforeEach(() => resetSerpApiCache());

  it("never searches without a key, exact dates or a known airport", async () => {
    const { fetchFn, calls } = fakeFetch({});
    const noKey = await searchFlights({ config: { ...config, SERPAPI_API_KEY: undefined }, fetchFn }, { originCity: "Paris", destinationCity: "Crète", ...DATES });
    expect(noKey.status).toBe("degraded");

    const noDates = await searchFlights({ config, fetchFn }, { originCity: "Paris", destinationCity: "Crète" });
    expect(noDates.status).toBe("degraded");
    expect(noDates.warnings[0]).toMatch(/dates/i);

    const unknown = await searchFlights({ config, fetchFn }, { originCity: "Paris", destinationCity: "Trifouillis", ...DATES });
    expect(unknown.status).toBe("degraded");
    expect(unknown.warnings[0]).toContain("Trifouillis");

    // None of those cost a search.
    expect(calls).toHaveLength(0);
    expect(searchesLeft({ config })).toBe(200);
  });

  it("maps Google Flights itineraries to deduplicated offers sorted by price", async () => {
    const { fetchFn, calls } = fakeFetch({
      best_flights: [
        {
          price: 210,
          total_duration: 200,
          flights: [{ airline: "Transavia", departure_airport: { id: "ORY", time: "2026-09-05 07:10" } }],
          layovers: []
        }
      ],
      other_flights: [
        {
          price: 150,
          total_duration: 395,
          flights: [{ airline: "Aegean", departure_airport: { time: "2026-09-05 10:40" } }, { airline: "Aegean" }],
          layovers: [{ id: "ATH", name: "Athens" }]
        },
        // Same fare paired with another return leg: one entry, not two.
        {
          price: 150,
          total_duration: 410,
          flights: [{ airline: "Aegean", departure_airport: { time: "2026-09-05 10:40" } }, { airline: "Aegean" }],
          layovers: [{ id: "ATH" }]
        }
      ],
      price_insights: { lowest_price: 150, price_level: "low", typical_price_range: [140, 320] }
    });

    const result = await searchFlights(
      { config, fetchFn },
      { originCity: "Paris", destinationCity: "Héraklion, Crète", ...DATES, adults: 4 }
    );

    expect(result.status).toBe("ok");
    const data = result.data as any;
    expect(data.offers.map((offer: any) => offer.price)).toEqual([150, 210]);
    expect(data.offers[0]).toMatchObject({ stops: 1, total_duration: "6h35", currency: "EUR" });
    expect(data.offers[0].notes).toEqual(["Carrier: Aegean", "Via ATH", "Départ 10:40"]);
    expect(data.offers[0].link).toContain("google.com/travel/flights");
    expect(data.offers[1]).toMatchObject({ stops: 0, total_duration: "3h20" });
    expect(data.origin_code).toBe("CDG");
    expect(data.destination_code).toBe("HER");
    expect(data.price_insights).toEqual({ lowest_price: 150, price_level: "low", typical_price_range: [140, 320] });

    const url = new URL(calls[0]);
    expect(url.searchParams.get("engine")).toBe("google_flights");
    expect(url.searchParams.get("departure_id")).toBe("CDG,ORY");
    expect(url.searchParams.get("arrival_id")).toBe("HER");
    expect(url.searchParams.get("adults")).toBe("4");
    expect(url.searchParams.get("hl")).toBe("fr");
    expect(url.searchParams.get("api_key")).toBe("test-key");
    // The key stays out of the reference stored with the trip.
    expect(result.raw_ref).not.toContain("test-key");
    expect(searchesLeft({ config })).toBe(199);
  });

  it("serves a repeated search from memory and never caches an error", async () => {
    const good = fakeFetch({ best_flights: [{ price: 99, total_duration: 60, flights: [{ airline: "X" }] }] });
    const input = { originCity: "Paris", destinationCity: "Rome", departureDate: "2026-10-01", returnDate: "2026-10-05" };
    await searchFlights({ config, fetchFn: good.fetchFn }, input);
    const second = await searchFlights({ config, fetchFn: good.fetchFn }, input);
    expect(good.calls).toHaveLength(1);
    expect((second.data as any).cached).toBe(true);

    resetSerpApiCache();
    const quota = fakeFetch({ error: "You have exhausted your searches for this month." });
    const exhausted = await searchFlights({ config, fetchFn: quota.fetchFn }, input);
    expect(exhausted.status).toBe("degraded");
    expect(exhausted.warnings[0]).toMatch(/quota/i);
    await searchFlights({ config, fetchFn: quota.fetchFn }, input);
    expect(quota.calls).toHaveLength(2);
  });

  it("persists the cache and the monthly count on disk, and stops at the local cap", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "mlt-serpapi-"));
    const diskConfig = { ...config, SERPAPI_CACHE_PATH: path.join(dir, "cache.json"), SERPAPI_MONTHLY_CAP: 2 };
    const input = { originCity: "Lyon", destinationCity: "Porto", departureDate: "2026-11-02", returnDate: "2026-11-06" };
    const { fetchFn, calls } = fakeFetch({ best_flights: [{ price: 80, total_duration: 120, flights: [{ airline: "Y" }] }] });

    await searchFlights({ config: diskConfig, fetchFn }, input);
    expect(JSON.parse(readFileSync(diskConfig.SERPAPI_CACHE_PATH, "utf8")).usage.searches).toBe(1);

    // A new process reads the file: the same search is free and counted once.
    resetSerpApiCache();
    const again = await searchFlights({ config: diskConfig, fetchFn }, input);
    expect((again.data as any).cached).toBe(true);
    expect(calls).toHaveLength(1);
    expect(searchesLeft({ config: diskConfig })).toBe(1);

    await searchFlights({ config: diskConfig, fetchFn }, { ...input, destinationCity: "Lisbonne" });
    expect(searchesLeft({ config: diskConfig })).toBe(0);
    const capped = await searchFlights({ config: diskConfig, fetchFn }, { ...input, destinationCity: "Madrid" });
    expect(capped.status).toBe("degraded");
    expect(capped.warnings[0]).toMatch(/quota/i);
    expect(calls).toHaveLength(2);
  });
});

describe("searchHotels", () => {
  beforeEach(() => resetSerpApiCache());

  it("requires dates and a destination", async () => {
    const { fetchFn, calls } = fakeFetch({});
    const noDates = await searchHotels({ config, fetchFn }, { city: "Porto" });
    expect(noDates.status).toBe("degraded");
    const noCity = await searchHotels({ config, fetchFn }, { city: " ", checkInDate: "2026-09-05", checkOutDate: "2026-09-10" });
    expect(noCity.status).toBe("degraded");
    expect(calls).toHaveLength(0);
  });

  it("ranks well-rated properties first, cheapest first among them, with their own link", async () => {
    const { fetchFn, calls } = fakeFetch({
      properties: [
        { name: "Cheap dump", rate_per_night: { extracted_lowest: 40 }, overall_rating: 3.1, reviews: 900 },
        { name: "Palace", rate_per_night: { extracted_lowest: 240 }, total_rate: { extracted_lowest: 1200 }, overall_rating: 4.7, reviews: 812, hotel_class: "5 étoiles", type: "hotel", link: "https://hotel.example/palace" },
        { name: "Pension Maria", rate_per_night: { extracted_lowest: 65 }, overall_rating: 4.4, reviews: 120, type: "vacation rental", nearby_places: [{ name: "Vieux port" }] },
        { name: "No price", overall_rating: 4.9 }
      ]
    });

    const result = await searchHotels(
      { config, fetchFn },
      { city: "Héraklion, Crète", checkInDate: "2026-09-05", checkOutDate: "2026-09-10", adults: 4 }
    );

    expect(result.status).toBe("ok");
    const stays = (result.data as any).stays;
    expect(stays.map((stay: any) => stay.name)).toEqual(["Pension Maria", "Palace", "Cheap dump"]);
    expect(stays[0]).toMatchObject({ price_per_night: 65, rating: 4.4, area: "Vieux port", link: null });
    expect(stays[1].notes).toEqual(["5 étoiles", "812 avis", "Séjour 1200 EUR"]);
    expect(stays[1].link).toBe("https://hotel.example/palace");

    const url = new URL(calls[0]);
    expect(url.searchParams.get("engine")).toBe("google_hotels");
    expect(url.searchParams.get("q")).toBe("Héraklion, Crète");
    expect(url.searchParams.get("check_in_date")).toBe("2026-09-05");
  });
});
