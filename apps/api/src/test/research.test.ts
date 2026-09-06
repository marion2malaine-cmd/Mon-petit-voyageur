import { describe, expect, it } from "vitest";
import { completeBriefDates, runFlightHotelResearch } from "../skills/handlers";
import { degraded, ok } from "../tools/types";

const BRIEF = {
  departure_city: "Paris",
  destination: "Héraklion, Crète",
  alternative_destinations: [],
  date_window: "septembre",
  exact_dates: { start: "2026-09-05", end: "2026-09-10" },
  duration_days: 5,
  budget_total: 2500,
  currency: "EUR",
  travelers_count: 4,
  traveler_types: ["family"],
  interests: [],
  dislikes: [],
  pace: "moderate" as const,
  accommodation_preferences: [],
  transport_preferences: [],
  climate_preferences: [],
  must_have: [],
  must_avoid: [],
  constraints: [],
  confidence_notes: []
};

// Live tools stand-ins that record what they were asked and answer at once.
function fakeTools() {
  const calls: { flights: any[]; hotels: any[] } = { flights: [], hotels: [] };
  const tools = {
    search_flights: async (input: any) => {
      calls.flights.push(input);
      return ok("serpapi-google-flights", {
        offers: [
          { label: "Paris -> Héraklion, Crète", price: 716, currency: "EUR", total_duration: "3h15", stops: 0, notes: ["Carrier: SKY express", "Direct"], link: "https://www.google.com/travel/flights?q=x" },
          { label: "Paris -> Héraklion, Crète", price: 1100, currency: "EUR", total_duration: "6h", stops: 1, notes: [] }
        ],
        origin_code: "CDG",
        destination_code: "HER",
        price_insights: { price_level: "low", typical_price_range: [550, 1100] }
      });
    },
    search_hotels: async (input: any) => {
      calls.hotels.push(input);
      return ok("serpapi-google-hotels", {
        stays: [{ name: "Pension Maria", price_per_night: 93, currency: "EUR", rating: 4.4, area: "Héraklion", notes: ["120 avis"], link: "https://hotel.example/maria" }]
      });
    }
  } as any;
  return { tools, calls };
}

describe("runFlightHotelResearch", () => {
  it("runs both live searches at once and keeps the engine's own booking links", async () => {
    const { tools, calls } = fakeTools();
    const result = await runFlightHotelResearch({ brief: BRIEF }, { locale: "fr", tools });

    expect(calls.flights[0]).toMatchObject({ originCity: "Paris", destinationCity: "Héraklion, Crète", departureDate: "2026-09-05", returnDate: "2026-09-10", adults: 4, locale: "fr" });
    expect(calls.hotels[0]).toMatchObject({ city: "Héraklion, Crète", checkInDate: "2026-09-05", adults: 4 });

    const { output, meta } = result;
    expect(output.live_data_status).toBe("ok");
    expect(meta.toolStatuses).toEqual({ search_flights: "ok", search_hotels: "ok" });
    // 35% of 2500 = 875: the 716 fare fits, the 1100 one does not.
    expect(output.recommended_flights.map((f) => [f.price, f.budget_fit])).toEqual([[716, "within_budget"], [1100, "over_budget"]]);
    expect(output.recommended_flights[0].booking_url).toBe("https://www.google.com/travel/flights?q=x");
    expect(output.recommended_flights[1].booking_url).toContain("skyscanner");
    expect(output.recommended_stays[0].booking_url).toBe("https://hotel.example/maria");
    expect(output.recommended_stays[0].budget_fit).toBe("within_budget");
    expect(output.tradeoff_notes.some((note) => note.includes("Google Flights juge le prix actuel bas"))).toBe(true);
    expect(output.search_links.find((link) => link.provider === "skyscanner")?.url).toContain("/cdg/her/");
  });

  it("prices the coming months when no date at all was given, and says so", async () => {
    const { tools, calls } = fakeTools();
    const brief = { ...BRIEF, date_window: null, exact_dates: { start: null, end: null } };
    const { output } = await runFlightHotelResearch({ brief }, { locale: "fr", tools, flexDateSamples: 3 });

    expect(calls.flights).toHaveLength(3);
    expect(calls.flights.map((c) => c.departureDate)).toEqual(calls.flights.map((c) => c.departureDate).filter((d) => /-15$/.test(d)));
    expect(calls.hotels).toHaveLength(1);
    expect(output.chosen_dates?.reason).toContain("sur les prochains mois");
    expect(output.live_data_status).toBe("ok");
    expect(decodeURIComponent(output.search_links.find((link) => link.provider === "booking")?.url ?? "")).toContain("Crète");
  });

  it("still searches hotels when only the airport is unknown", async () => {
    const { tools, calls } = fakeTools();
    const brief = { ...BRIEF, destination: "Trifouillis-les-Oies" };
    const { output } = await runFlightHotelResearch({ brief }, { locale: "en", tools });

    expect(calls.flights).toHaveLength(0);
    expect(calls.hotels).toHaveLength(1);
    expect(output.live_data_status).toBe("partial");
    expect(output.tradeoff_notes[0]).toContain("No airport known for Trifouillis-les-Oies");
  });

  it("reports an exhausted quota in the traveler's language", async () => {
    const tools = {
      search_flights: async () => degraded("serpapi-google-flights", { offers: [] }, ["SerpApi quota exhausted: cap"]),
      search_hotels: async () => degraded("serpapi-google-hotels", { stays: [] }, ["SerpApi quota exhausted: cap"])
    } as any;
    const { output } = await runFlightHotelResearch({ brief: BRIEF }, { locale: "fr", tools });
    expect(output.live_data_status).toBe("unavailable");
    expect(output.tradeoff_notes[0]).toContain("Quota de recherches live épuisé");
  });
});

describe("completeBriefDates", () => {
  it("derives the dates from the month in the message when the parser left them empty", () => {
    const brief = { ...BRIEF, date_window: null, exact_dates: { start: null, end: null } };
    const completed = completeBriefDates(brief, "5 jours en Crète en famille en septembre, budget 2500 €");
    expect(completed.date_window).toBe("septembre");
    expect(completed.exact_dates.start).toMatch(/^\d{4}-09-05$/);
    expect(completed.exact_dates.end).toMatch(/^\d{4}-09-10$/);
  });

  it("leaves explicit dates and undated briefs alone", () => {
    expect(completeBriefDates(BRIEF, "n'importe quoi en mars")).toBe(BRIEF);
    const undated = { ...BRIEF, date_window: null, exact_dates: { start: null, end: null } };
    expect(completeBriefDates(undated, "un week-end quelque part")).toBe(undated);
  });
});

describe("flexible dates and remaining budget", () => {
  const NOW = new Date("2026-09-06T10:00:00Z");

  it("samples the month when only a month was given, and the coming months when nothing was", async () => {
    const { sampleDepartureDates } = await import("../skills/handlers");
    const month = sampleDepartureDates({ ...BRIEF, date_window: "octobre", exact_dates: { start: null, end: null } }, 3, NOW);
    expect(month.map((d) => d.start)).toEqual(["2026-10-04", "2026-10-15", "2026-10-26"]);
    expect(month[0].end).toBe("2026-10-09");
    // September is running: its remaining dates only, else next year's.
    const soon = sampleDepartureDates({ ...BRIEF, date_window: "septembre", exact_dates: { start: null, end: null } }, 3, NOW);
    expect(soon.map((d) => d.start)).toEqual(["2026-09-15", "2026-09-26"]);
    const nothing = sampleDepartureDates({ ...BRIEF, date_window: null, exact_dates: { start: null, end: null } }, 3, NOW);
    expect(nothing.map((d) => d.start)).toEqual(["2026-10-15", "2026-11-15", "2026-12-15"]);
    expect(sampleDepartureDates({ ...BRIEF, date_window: "mai", exact_dates: { start: null, end: null } }, 1, NOW).map((d) => d.start)).toEqual(["2027-05-15"]);
  });

  it("prices every sampled date, keeps the cheapest, searches the hotel on it and reports what is left", async () => {
    const fares: Record<string, number> = { "2026-10-04": 900, "2026-10-15": 640, "2026-10-26": 780 };
    const calls: { flights: any[]; hotels: any[] } = { flights: [], hotels: [] };
    const tools = {
      search_flights: async (input: any) => {
        calls.flights.push(input);
        return ok("serpapi-google-flights", { offers: [{ label: "x", price: fares[input.departureDate], currency: "EUR", stops: 0, notes: [] }], origin_code: "CDG", destination_code: "HER" });
      },
      search_hotels: async (input: any) => {
        calls.hotels.push(input);
        return ok("serpapi-google-hotels", { stays: [{ name: "Pension", price_per_night: 92, currency: "EUR", rating: 4.5, notes: [] }, { name: "Palace", price_per_night: 240, currency: "EUR", rating: 4.9, notes: [] }] });
      }
    } as any;
    // Dates derived from "octobre" are estimated: the month gets sampled.
    const brief = { ...BRIEF, date_window: "octobre", exact_dates: { start: "2026-10-05", end: "2026-10-10", estimated: true } };
    const { output } = await runFlightHotelResearch({ brief }, { locale: "fr", tools, flexDateSamples: 3 });

    expect(calls.flights.map((c) => c.departureDate).sort()).toEqual(["2026-10-04", "2026-10-15", "2026-10-26"]);
    expect(calls.hotels).toHaveLength(1);
    expect(calls.hotels[0]).toMatchObject({ checkInDate: "2026-10-15", checkOutDate: "2026-10-20" });
    expect(output.chosen_dates).toMatchObject({ start: "2026-10-15", end: "2026-10-20" });
    expect(output.date_options.map((d) => [d.start, d.price])).toEqual([["2026-10-04", 900], ["2026-10-15", 640], ["2026-10-26", 780]]);
    // 2500 − 640 − 5 × 92 = 1400 left.
    expect(output.live_costs).toEqual({ flights: 640, lodging: 460 });
    expect(output.remaining_budget_eur).toBe(1400);
    expect(output.tradeoff_notes[0]).toContain("3 départs testés en octobre");
    expect(output.tradeoff_notes[1]).toContain("Il reste 1400 €");
  });

  it("searches written dates once and warns when tickets eat the budget", async () => {
    const calls: any[] = [];
    const tools = {
      search_flights: async (input: any) => { calls.push(input); return ok("f", { offers: [{ label: "x", price: 1900, currency: "EUR", stops: 0, notes: [] }] }); },
      search_hotels: async () => ok("h", { stays: [{ name: "P", price_per_night: 100, currency: "EUR", rating: 4.5, notes: [] }] })
    } as any;
    const { output } = await runFlightHotelResearch({ brief: BRIEF }, { locale: "fr", tools, flexDateSamples: 3 });
    expect(calls).toHaveLength(1);
    expect(output.chosen_dates).toBeNull();
    expect(output.remaining_budget_eur).toBe(100);
    expect(output.tradeoff_notes[0]).toMatch(/^Attention/);
  });
});

describe("Viator affiliate links", () => {
  it("stamps the affiliate ids on every Viator link, for experiences, tickets and the destination", async () => {
    const { buildActivityLinks, buildTicketLinks, buildExperienceLinks, viatorUrl } = await import("../tools/links");
    const all = [
      ...buildActivityLinks("Croisière vers Balos", "Crète", "fr"),
      ...buildTicketLinks("Palais de Knossos", "Crète", "fr"),
      ...buildExperienceLinks("Crète", "en")
    ].filter((link) => link.provider === "viator");
    expect(all).toHaveLength(3);
    for (const link of all) {
      const url = new URL(link.url);
      expect(url.hostname).toBe("www.viator.com");
      expect(url.searchParams.get("pid")).toBe("P00277065");
      expect(url.searchParams.get("mcid")).toBe("42383");
      expect(url.searchParams.get("medium")).toBe("link");
      expect(url.searchParams.get("medium_version")).toBe("selector");
    }
    expect(new URL(all[0].url).searchParams.get("text")).toContain("Balos");
    expect(viatorUrl("/fr-FR/searchResults/all?text=Knossos")).toContain("pid=P00277065");
  });
});

describe("calendar-first dates", () => {
  const month = { ...BRIEF, date_window: "octobre", exact_dates: { start: "2026-10-05", end: "2026-10-10", estimated: true } };

  function calendarTools(days: { date: string; price: number; transfers?: number }[] | null) {
    const calls: { flights: any[]; hotels: any[]; calendar: any[]; months: any[] } = { flights: [], hotels: [], calendar: [], months: [] };
    const tools = {
      get_price_calendar: async (input: any) => { calls.calendar.push(input); return days ? ok("tp", { days: days.map((d) => ({ ...d, return_date: null, airline: null, link: null, transfers: d.transfers ?? null })) }) : degraded("tp", { days: [] }, ["no price"]); },
      get_cheapest_months: async (input: any) => { calls.months.push(input); return ok("tp", { months: [{ month: "2026-11", price: 99, date: "2026-11-03", return_date: null }] }); },
      search_flights: async (input: any) => { calls.flights.push(input); return ok("f", { offers: [{ label: "x", price: 600, currency: "EUR", stops: 0, notes: [] }], origin_code: "CDG", destination_code: "HER" }); },
      search_hotels: async (input: any) => { calls.hotels.push(input); return ok("h", { stays: [{ name: "P", price_per_night: 90, currency: "EUR", rating: 4.5, notes: [] }] }); }
    } as any;
    return { tools, calls };
  }

  it("spends one live search on the cheapest day of the month calendar and shows the whole month", async () => {
    const { tools, calls } = calendarTools([{ date: "2026-10-04", price: 210 }, { date: "2026-10-15", price: 148, transfers: 1 }, { date: "2026-10-26", price: 175 }]);
    const { output } = await runFlightHotelResearch({ brief: month }, { locale: "fr", tools, flexDateSamples: 3, aviasalesMarker: "mlt-42" });
    expect(calls.calendar[0]).toMatchObject({ originCodes: "CDG,ORY", destinationCodes: "HER", month: "2026-10", tripDuration: 5 });
    expect(calls.flights).toHaveLength(1);
    expect(calls.flights[0]).toMatchObject({ departureDate: "2026-10-15", returnDate: "2026-10-20" });
    expect(calls.hotels[0]).toMatchObject({ checkInDate: "2026-10-15" });
    expect(output.calendar_source).toBe("travelpayouts");
    expect(output.price_calendar.map((d) => [d.date, d.price, d.chosen])).toEqual([["2026-10-04", 210, false], ["2026-10-15", 148, true], ["2026-10-26", 175, false]]);
    expect(output.chosen_dates?.reason).toContain("Calendrier des prix de octobre");
    expect(output.search_links.find((l) => l.provider === "aviasales")?.url).toContain("marker=mlt-42");
  });

  it("looks up the cheapest coming month when no date was given", async () => {
    const { tools, calls } = calendarTools([{ date: "2026-11-03", price: 99 }, { date: "2026-11-20", price: 130 }]);
    const { output } = await runFlightHotelResearch({ brief: { ...BRIEF, date_window: null, exact_dates: { start: null, end: null } } }, { locale: "en", tools });
    expect(calls.months).toHaveLength(1);
    expect(calls.calendar[0].month).toBe("2026-11");
    expect(calls.flights).toHaveLength(1);
    expect(output.chosen_dates?.start).toBe("2026-11-03");
    expect(output.chosen_dates?.reason).toContain("cheapest month (2026-11)");
  });

  it("falls back to sampling when the calendar knows nothing", async () => {
    const { tools, calls } = calendarTools(null);
    const { output } = await runFlightHotelResearch({ brief: month }, { locale: "fr", tools, flexDateSamples: 3 });
    expect(calls.flights.length).toBeGreaterThanOrEqual(2);
    expect(output.calendar_source).toBe("sampled");
    expect(output.price_calendar.every((d) => d.price === 150)).toBe(true);
    expect(output.chosen_dates?.reason).toContain("départs testés en octobre");
  });
});
