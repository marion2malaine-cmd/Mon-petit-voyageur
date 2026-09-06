import { beforeEach, describe, expect, it } from "vitest";
import { aviasalesSearchUrl, getCheapestMonths, getPriceCalendar, resetTravelpayoutsCache, toAviasalesCode } from "../tools/travelpayouts";

const config = { TRAVELPAYOUTS_TOKEN: "tp-token" } as any;

function fakeFetch(bodies: Record<string, unknown> | unknown) {
  const calls: { url: string; headers: any }[] = [];
  const fetchFn = (async (url: string, init: any) => {
    calls.push({ url, headers: init?.headers });
    const month = new URL(url).searchParams.get("departure_at") ?? "";
    const body = bodies && typeof bodies === "object" && !Array.isArray(bodies) && month in (bodies as any) ? (bodies as any)[month] : bodies;
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

describe("Travelpayouts price calendar", () => {
  beforeEach(() => resetTravelpayoutsCache());

  it("uses metro codes and reads the cheapest fare of every day of the month", async () => {
    const { fetchFn, calls } = fakeFetch({
      success: true,
      data: {
        "2026-10-04": { price: 210, transfers: 0, airline: "TO", return_at: "2026-10-09", link: "/search/PAR0410HER09101" },
        "2026-10-15": { price: 148, transfers: 1, airline: "A3" },
        "2026-10-26": { price: 175 }
      }
    });
    const result = await getPriceCalendar({ config, fetchFn }, { originCodes: "CDG,ORY", destinationCodes: "HER,CHQ", month: "2026-10", tripDuration: 5 });
    expect(result.status).toBe("ok");
    const days = (result.data as any).days;
    expect(days.map((d: any) => [d.date, d.price, d.transfers])).toEqual([["2026-10-04", 210, 0], ["2026-10-15", 148, 1], ["2026-10-26", 175, null]]);
    expect(days[0].link).toBe("https://www.aviasales.com/search/PAR0410HER09101");
    const url = new URL(calls[0].url);
    expect(url.searchParams.get("origin")).toBe("PAR");
    expect(url.searchParams.get("destination")).toBe("HER");
    expect(url.searchParams.get("trip_duration")).toBe("5");
    expect(url.searchParams.get("currency")).toBe("eur");
    // The token never appears in the URL kept with the trip.
    expect(calls[0].url).not.toContain("tp-token");
    expect(calls[0].headers["X-Access-Token"]).toBe("tp-token");
    expect(result.raw_ref).not.toContain("tp-token");
  });

  it("degrades without a token or without prices, and never caches an error", async () => {
    const none = await getPriceCalendar({ config: {} as any }, { originCodes: "CDG", destinationCodes: "HER", month: "2026-10", tripDuration: 5 });
    expect(none.status).toBe("degraded");
    const { fetchFn, calls } = fakeFetch({ success: false, error: "Unauthorized" });
    const refused = await getPriceCalendar({ config, fetchFn }, { originCodes: "CDG", destinationCodes: "HER", month: "2026-10", tripDuration: 5 });
    expect(refused.status).toBe("degraded");
    expect(refused.warnings[0]).toContain("Unauthorized");
    await getPriceCalendar({ config, fetchFn }, { originCodes: "CDG", destinationCodes: "HER", month: "2026-10", tripDuration: 5 });
    expect(calls).toHaveLength(2);
  });

  it("ranks the coming months by their cheapest known fare", async () => {
    const { fetchFn } = fakeFetch({
      "2026-10": { data: { "2026-10-15": { price: 148 } } },
      "2026-11": { data: { "2026-11-03": { price: 99 }, "2026-11-20": { price: 130 } } },
      "2026-12": { data: {} }
    });
    const result = await getCheapestMonths({ config, fetchFn }, { originCodes: "CDG,ORY", destinationCodes: "HER", tripDuration: 5, months: 3, now: new Date("2026-09-06T00:00:00Z") });
    expect((result.data as any).months).toEqual([
      { month: "2026-11", price: 99, date: "2026-11-03", return_date: null },
      { month: "2026-10", price: 148, date: "2026-10-15", return_date: null }
    ]);
  });

  it("builds the Aviasales search with the affiliate marker", () => {
    expect(toAviasalesCode("LHR,LGW,STN,LTN")).toBe("LON");
    expect(toAviasalesCode("LYS")).toBe("LYS");
    const url = new URL(aviasalesSearchUrl("CDG,ORY", "HER,CHQ", "2026-10-15", "2026-10-20", 4, "mlt-42"));
    expect(url.pathname).toBe("/search/PAR1510HER20104");
    expect(url.searchParams.get("marker")).toBe("mlt-42");
  });
});
