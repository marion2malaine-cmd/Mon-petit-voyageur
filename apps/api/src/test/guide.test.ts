import { describe, expect, it } from "vitest";
import { ItineraryByDaySchema, type PlanTripResponse } from "@mlt/contracts";
import { renderGuideHtml } from "../guide/renderGuide";
import { enrichItinerary } from "../orchestrator/enrichItinerary";
import { mergePreferencesIntoBrief, runItineraryBuilder } from "../skills/handlers";
import { createTools } from "../tools";
import { getConfig } from "../config";
import { buildCarRentalAdvice } from "../tools/carRental";
import { enforceUniqueness } from "../skills/itineraryPlanner";
import { buildTicketLinks, toSearchQuery } from "../tools/links";

const BRIEF = {
  departure_city: "Paris",
  destination: "Crète",
  alternative_destinations: [],
  date_window: "août 2026",
  exact_dates: { start: "2026-08-10", end: "2026-08-16" },
  duration_days: 7,
  budget_total: 4000,
  currency: "EUR",
  travelers_count: 4,
  traveler_types: ["culture", "beach", "family"],
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

async function buildItinerary() {
  const tools = createTools(getConfig());
  const result = await runItineraryBuilder({ brief: BRIEF, selectedDestination: "Crète" }, { locale: "fr", tools });

  // withPhotos stays off so the suite never touches the network.
  const enriched = await enrichItinerary(result.output, tools, {
    destination: "Crète",
    locale: "fr",
    withPhotos: false
  });

  return ItineraryByDaySchema.parse(enriched);
}

describe("itinerary program", () => {
  it("gives every day free visits, alternative paid options and tables", async () => {
    const itinerary = await buildItinerary();

    expect(itinerary.itinerary_by_day).toHaveLength(7);

    for (const day of itinerary.itinerary_by_day) {
      expect(day.free_visits.length).toBeGreaterThanOrEqual(2);
      expect(day.restaurants.length).toBeGreaterThanOrEqual(2);
      expect(day.timeline.length).toBeGreaterThanOrEqual(3);
      // The departure day has no paid activity, every other day offers a choice.
      if (day.day !== itinerary.itinerary_by_day.length) {
        expect(day.paid_options.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("never repeats a free visit on two consecutive days", async () => {
    const itinerary = await buildItinerary();
    const days = itinerary.itinerary_by_day;

    for (let index = 1; index < days.length; index += 1) {
      const previous = new Set(days[index - 1].free_visits.map((visit) => visit.name));
      const repeated = days[index].free_visits.filter((visit) => previous.has(visit.name));
      expect(repeated).toEqual([]);
    }
  });

  it("builds real booking links instead of trusting the model", async () => {
    const itinerary = await buildItinerary();
    const day = itinerary.itinerary_by_day[1];

    const providers = day.paid_options[0].booking_links.map((link) => link.provider);
    expect(providers).toContain("getyourguide");
    expect(providers).toContain("viator");

    for (const link of day.paid_options[0].booking_links) {
      expect(link.url).toMatch(/^https:\/\//);
    }

    expect(day.restaurants[0].booking_links.map((link) => link.provider)).toContain("thefork");
    expect(day.free_visits[0].map_url).toContain("google.com/maps");
  });

  it("offers the local and forum route before the platforms", async () => {
    const itinerary = await buildItinerary();
    const option = itinerary.itinerary_by_day[1].paid_options[0];
    const providers = option.booking_links.map((link) => link.provider);

    expect(providers).toContain("local-agency");
    expect(providers).toContain("forum");
    // Cheapest route first: the platforms come after the local ones.
    expect(providers.indexOf("local-agency")).toBeLessThan(providers.indexOf("getyourguide"));
    expect(option.local_alternative?.how_to_book).toBeTruthy();
  });
});

describe("trip preferences", () => {
  it("lets an explicitly chosen destination win over the one guessed from the text", () => {
    const guessed = { ...BRIEF, destination: "Crète" };

    const merged = mergePreferencesIntoBrief(
      guessed as any,
      {
        travel_styles: [],
        pace: null,
        budget_total: null,
        destination: "  Budapest  ",
        duration_days: null,
        travelers_count: null,
        departure_city: null,
        month: null
      } as any,
      "fr"
    );

    expect(merged.destination).toBe("Budapest");
  });

  it("keeps the guessed destination when none is chosen", () => {
    const merged = mergePreferencesIntoBrief(
      { ...BRIEF, destination: "Crète" } as any,
      {
        travel_styles: [],
        pace: null,
        budget_total: null,
        destination: null,
        duration_days: null,
        travelers_count: null,
        departure_city: null,
        month: null
      } as any,
      "fr"
    );

    expect(merged.destination).toBe("Crète");
  });

  it("plans trips far longer than two weeks", async () => {
    const tools = createTools(getConfig());
    const result = await runItineraryBuilder(
      { brief: { ...BRIEF, duration_days: 30 } as any, selectedDestination: "Crète" },
      { locale: "fr", tools }
    );

    expect(result.output.itinerary_by_day).toHaveLength(30);
    expect(result.output.itinerary_by_day.at(-1)?.day).toBe(30);
  });
});

describe("booking search queries", () => {
  // "Côte belge : Knokke et Zwin Bruges" returned nothing on GetYourGuide,
  // which then displayed Málaga instead.
  it("keeps the specific part of a guidebook-style title", () => {
    expect(toSearchQuery("Côte belge : Knokke et Zwin", "Bruges")).toBe("Knokke et Zwin");
  });

  it("drops the descriptive lead-in and anchors short queries on the city", () => {
    expect(toSearchQuery("Croisière sur les canaux", "Bruges")).toBe("canaux Bruges");
    expect(toSearchQuery("Montée du Beffroi", "Bruges")).toBe("Beffroi Bruges");
    expect(toSearchQuery("Dégustation de bières brugeoises", "Bruges")).toBe("bières brugeoises Bruges");
  });

  it("removes parentheses and never repeats the city", () => {
    expect(toSearchQuery("Musée du Chocolat (Choco-Story)", "Bruges")).toBe("Musée du Chocolat");
    expect(toSearchQuery("Palais de Cnossos Crète", "Crète")).toBe("Palais de Cnossos Crète");
  });

  it("falls back to the title when nothing survives cleaning", () => {
    expect(toSearchQuery("Excursion", "Bruges")).toBe("Excursion Bruges");
  });
});

describe("ticket vs experience links", () => {
  it("sends a museum to the official ticket office and Tiqets first", () => {
    const links = buildTicketLinks("Musée Groeninge", "Bruges", "fr");
    const providers = links.map((l) => l.provider);

    expect(providers[0]).toBe("official");
    expect(providers).toContain("tiqets");
    expect(links.find((l) => l.provider === "official")!.url).toContain("billetterie%20officielle");
    expect(links.find((l) => l.provider === "tiqets")!.url).toContain("tiqets.com");
  });

  it("routes a paid museum option through the ticket channel, a cruise through activities", async () => {
    const itinerary = ItineraryByDaySchema.parse({
      trip_summary: "x",
      itinerary_by_day: [
        {
          day: 1,
          title: "Jour 1",
          morning: "a",
          afternoon: "b",
          evening: "c",
          paid_options: [
            { option_label: "A", title: "Musée Groeninge", description: "", kind: "ticket", official_url: "https://www.museabrugge.be/", gyg_url: "https://www.getyourguide.fr/x" },
            { option_label: "B", title: "Croisière sur les canaux", description: "", kind: "experience", gyg_url: "https://www.getyourguide.fr/y" },
            { option_label: "C", title: "Béguinage", description: "", kind: "ticket", official_url: "https://www.getyourguide.fr/reseller" }
          ]
        }
      ]
    });

    const enriched = await enrichItinerary(itinerary, createTools(getConfig()), {
      destination: "Bruges",
      locale: "fr",
      withPhotos: false
    });

    const [museum, cruise, beguinage] = enriched.itinerary_by_day[0].paid_options;
    // The known official site leads, then GetYourGuide as the sold-out backup.
    expect(museum.booking_links[0]).toMatchObject({ provider: "official", url: "https://www.museabrugge.be/" });
    expect(museum.booking_links[1].provider).toBe("getyourguide");
    expect(museum.booking_links.some((l) => l.provider === "tiqets")).toBe(true);
    // An experience with a real offer leads with it.
    expect(cruise.booking_links[0].provider).toBe("getyourguide");
    expect(cruise.booking_links.some((l) => l.provider === "viator")).toBe(true);
    expect(cruise.booking_links.some((l) => l.provider === "tiqets")).toBe(false);
    // A reseller passed off as official is dropped: back to the ticket-office search.
    expect(beguinage.official_url).toBeNull();
    expect(beguinage.booking_links[0].url).toContain("google.com/search");
  });
});

describe("uniqueness guard", () => {
  // Reproduces a real Budapest plan where the model put the central market on
  // day 1 and again on day 5.
  it("removes a place the model repeated on a later day", () => {
    const days = [
      {
        day: 1,
        free_visits: [{ name: "Marché central de Budapest" }, { name: "Place Vörösmarty" }],
        paid_options: [{ title: "Croisière sur le Danube" }],
        restaurants: [{ name: "Menza" }]
      },
      {
        day: 5,
        free_visits: [{ name: "marché central de budapest" }, { name: "Parc Városliget" }],
        paid_options: [{ title: "Croisière sur le Danube" }],
        restaurants: [{ name: "Menza" }]
      }
    ] as any;

    enforceUniqueness(days);

    expect(days[0].free_visits.map((v: any) => v.name)).toEqual([
      "Marché central de Budapest",
      "Place Vörösmarty"
    ]);
    // The repeat is dropped, whatever its casing and accents.
    expect(days[1].free_visits.map((v: any) => v.name)).toEqual(["Parc Városliget"]);
    expect(days[1].paid_options).toEqual([]);
    expect(days[1].restaurants).toEqual([]);
  });
});

describe("car rental advice", () => {
  it("recommends the cheapest category that seats the group", () => {
    const advice = buildCarRentalAdvice({
      destinationCity: "Crète",
      locale: "fr",
      travelers: 6,
      durationDays: 10,
      envelope: { min: 400, max: 1200 },
      pickupDate: "2026-08-10",
      returnDate: "2026-08-20"
    });

    expect(advice.recommended).not.toBeNull();
    expect(advice.recommended!.seats).toBeGreaterThanOrEqual(6);
    // Nothing smaller than the recommendation may also seat the group.
    const cheaper = advice.options.filter(
      (option) => (option.price_per_day_eur ?? 0) < (advice.recommended!.price_per_day_eur ?? 0)
    );
    expect(cheaper.every((option) => (option.seats ?? 0) < 6)).toBe(true);
  });

  it("flags an option that blows the ground-transport envelope", () => {
    const advice = buildCarRentalAdvice({
      destinationCity: "Crète",
      locale: "fr",
      travelers: 2,
      durationDays: 10,
      envelope: { min: 100, max: 300 }
    });

    // 10 days at 38 €/day is over a 300 € envelope.
    expect(advice.options.some((option) => !option.fits_budget)).toBe(true);
  });

  it("always warns about the credit card and the shuttle", () => {
    const advice = buildCarRentalAdvice({
      destinationCity: "Crète",
      locale: "fr",
      travelers: 4,
      durationDays: 7,
      envelope: null
    });

    const alerts = advice.alerts.join(" ").toLowerCase();
    expect(alerts).toContain("carte de crédit");
    expect(alerts).toContain("assurance");
    expect(alerts).toContain("navette");
    expect(advice.documents.join(" ")).toContain("Carte de crédit");
    expect(advice.recommended!.booking_links.length).toBeGreaterThan(0);
  });
});

describe("guide rendering", () => {
  it("renders the day-by-day sections and escapes user content", async () => {
    const itinerary = await buildItinerary();
    itinerary.itinerary_by_day[0].title = 'Jour 1 — <script>alert("x")</script>';

    const plan = {
      traveler_summary: "Résumé",
      final_trip_plan: { destination: "Crète", duration_days: 7 },
      structured_json: { brief: BRIEF, itinerary },
      open_verifications: [],
      next_steps: [],
      trace: []
    } as unknown as PlanTripResponse;

    const html = renderGuideHtml(plan, { locale: "fr" });

    expect(html).toContain("Visites culturelles gratuites");
    expect(html).toContain("Activités au choix");
    expect(html).toContain("Où manger");
    expect(html).toContain("getyourguide");
    expect(html).toContain("viator");
    expect(html).toContain("Moins cher en direct");
    expect(html).toContain("Réserver moins cher");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");

    // One card per day, plus the calendar tiles.
    expect(html.match(/class="day-head"/g)).toHaveLength(7);
  });

  it("draws the map with Mapbox when a token is set, Leaflet otherwise", async () => {
    const itinerary = await buildItinerary();
    itinerary.itinerary_by_day[0].free_visits[0].coordinates = { lat: 35.34, lon: 25.13 };
    itinerary.itinerary_by_day[0].title = "Jour <1>";
    const plan = {
      traveler_summary: "Résumé",
      final_trip_plan: { destination: "Crète", duration_days: 7 },
      structured_json: { brief: BRIEF, itinerary },
      open_verifications: [],
      next_steps: [],
      trace: []
    } as unknown as PlanTripResponse;

    const withToken = renderGuideHtml(plan, { locale: "fr", mapboxToken: "pk.test</script>" });
    expect(withToken).toContain("mapbox-gl.js");
    expect(withToken).toContain("mapboxgl.accessToken");
    expect(withToken).not.toContain("leaflet.js");
    // The token and the routes are inlined in a script: no closing tag can leak out of it.
    expect(withToken).not.toContain("pk.test</script>");
    expect(withToken).not.toContain("Jour <1>");

    const withoutToken = renderGuideHtml(plan, { locale: "fr" });
    expect(withoutToken).toContain("leaflet.js");
    expect(withoutToken).not.toContain("mapbox-gl.js");
  });

  it("credits every photo and links back to Pexels when one of its photos is used", async () => {
    const itinerary = await buildItinerary();
    itinerary.itinerary_by_day[0].photo = {
      query: "Crète",
      url: "https://images.pexels.com/photos/1/x.jpeg",
      thumb_url: null,
      credit: "Jane <Doe> / Pexels",
      source_url: "https://www.pexels.com/photo/1/",
      license: "Pexels License"
    };
    const plan = {
      traveler_summary: "Résumé",
      final_trip_plan: { destination: "Crète", duration_days: 7 },
      structured_json: { brief: BRIEF, itinerary },
      open_verifications: [],
      next_steps: [],
      trace: []
    } as unknown as PlanTripResponse;

    const html = renderGuideHtml(plan, { locale: "fr" });
    expect(html).toContain("Crédits photos");
    if (itinerary.itinerary_by_day.some((day) => day.paid_options.some((option) => option.kind === "ticket"))) {
      expect(html).toContain("Complet sur le site officiel");
    }
    expect(html).toContain('href="https://www.pexels.com"');
    expect(html).toContain('href="https://www.pexels.com/photo/1/"');
    expect(html).toContain("Jane &lt;Doe&gt; / Pexels");
    expect(html).toContain("Pexels License");
  });
});
