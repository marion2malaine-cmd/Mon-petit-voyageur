import { beforeEach, describe, expect, it } from "vitest";
import type { ItineraryOutline } from "@mlt/contracts";
import { allowedPriceTiers, assignRestaurants, attachRestaurantData } from "../skills/itineraryPlanner";
import { resetSerpApiCache, searchForumThreads, searchRestaurants, type PlaceResult } from "../tools/serpapi";

const config = { NODE_ENV: "test", SQLITE_PATH: ":memory:", SERPAPI_API_KEY: "test-key", SERPAPI_MONTHLY_CAP: 200 } as any;

function fakeFetch(body: unknown) {
  const calls: string[] = [];
  const fetchFn = (async (url: string) => {
    calls.push(url);
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

function place(name: string, rating: number, reviews: number, price: PlaceResult["price"] = "€€"): PlaceResult {
  return { name, rating, reviews_count: reviews, price, cuisine: "Taverne", address: `${name} street`, phone: null, website: null, maps_url: `https://maps/${name}`, place_id: null, coordinates: { lat: 35.3, lon: 25.1 }, thumbnail: null, description: null };
}

const BRIEF = {
  departure_city: "Paris", destination: "Crète", alternative_destinations: [], date_window: null,
  exact_dates: { start: "2026-09-05", end: "2026-09-10" }, duration_days: 5, budget_total: 2500, currency: "EUR",
  travelers_count: 4, traveler_types: [], interests: [], dislikes: [], pace: "moderate" as const,
  accommodation_preferences: [], transport_preferences: [], climate_preferences: [], must_have: [], must_avoid: [],
  constraints: [], confidence_notes: []
};

describe("searchRestaurants", () => {
  beforeEach(() => resetSerpApiCache());

  it("keeps only trusted, rated places and ranks them credibly", async () => {
    const { fetchFn, calls } = fakeFetch({
      local_results: [
        { title: "Peskesi", rating: 4.6, reviews: 3200, price: "€€", type: "Restaurant crétois", address: "Kapetan Charalampi 6", phone: "+30 281", website: "https://peskesi.gr", place_id: "abc" },
        { title: "Tourist Trap", rating: 3.9, reviews: 900, price: "€€€" },
        { title: "New place", rating: 5, reviews: 4 },
        { title: "Ippokambos", rating: 4.5, reviews: 2100, price: "$$", types: ["Seafood restaurant"] },
        { title: "Kritamon", rating: 4.8, reviews: 60, price: "€€" },
        { title: "Merastri", rating: 4.4, reviews: 700 },
        { title: "Ligo Krasi", rating: 4.5, reviews: 400 },
        { title: "Thalassa", rating: 4.3, reviews: 90 },
        { title: "El Puerto Mexican & Steak Bar", rating: 4.8, reviews: 4400, type: "Mexican restaurant" }
      ]
    });

    const result = await searchRestaurants({ config, fetchFn }, { area: "Héraklion", destination: "Crète", locale: "fr" });
    expect(result.status).toBe("ok");
    const places = (result.data as any).places as PlaceResult[];
    // The Mexican place outranks everyone on numbers alone; local tables come first.
    expect(places.map((p) => p.name)).toEqual(["Peskesi", "Ippokambos", "Kritamon", "Ligo Krasi", "Merastri", "El Puerto Mexican & Steak Bar", "Thalassa"]);
    expect(places[0]).toMatchObject({ price: "€€", cuisine: "Restaurant crétois", website: "https://peskesi.gr" });
    expect(places[0].maps_url).toContain("query_place_id=abc");
    // "$" is read as €€.
    expect(places[1].price).toBe("€€");

    const url = new URL(calls[0]);
    expect(url.searchParams.get("engine")).toBe("google_maps");
    expect(url.searchParams.get("q")).toBe("restaurants Héraklion, Crète");
  });

  it("lowers the bar in a small village rather than returning nothing", async () => {
    const { fetchFn } = fakeFetch({
      local_results: [
        { title: "Taverna A", rating: 4.1, reviews: 30 },
        { title: "Taverna B", rating: 4.4, reviews: 25 },
        { title: "Kiosk", rating: 4.9, reviews: 3 }
      ]
    });
    const result = await searchRestaurants({ config, fetchFn }, { area: "Omalos", destination: "Crète" });
    expect((result.data as any).places.map((p: PlaceResult) => p.name)).toEqual(["Taverna B", "Taverna A"]);
  });
});

describe("searchForumThreads", () => {
  beforeEach(() => resetSerpApiCache());

  it("returns real threads with their source", async () => {
    const { fetchFn, calls } = fakeFetch({
      organic_results: [
        { title: "Crète en famille : conseils", link: "https://www.tripadvisor.fr/ShowTopic-g1", snippet: "Partez à Balos tôt le matin…" },
        { title: "Crète : bons plans", link: "https://www.routard.com/forum_message/1", snippet: "Le bus pour Knossos coûte 2 €." },
        { title: "Crete tips", link: "https://www.reddit.com/r/travel/1" },
        { title: "Evil", link: "javascript:alert(1)", snippet: "x" }
      ]
    });
    const result = await searchForumThreads({ config, fetchFn }, { destination: "Crète", locale: "fr" });
    expect(result.status).toBe("ok");
    const findings = (result.data as any).findings;
    expect(findings.map((f: any) => f.source)).toEqual(["TripAdvisor", "Routard", "Reddit"]);
    expect(findings[1].snippet).toContain("2 €");
    const url = new URL(calls[0]);
    expect(url.searchParams.get("q")).toContain("site:routard.com");
    expect(url.searchParams.get("q")).toContain("Crète");
  });
});

describe("assignRestaurants", () => {
  const outline = (): ItineraryOutline => ({
    trip_summary: "",
    car_needed: true,
    car_rationale: "",
    days: [
      { day: 1, date: null, title: "J1", theme: "a", area: "Héraklion", free_visit_names: [], paid_option_titles: [], restaurant_names: ["Taverna Knossos", "To Stachi"] },
      { day: 2, date: null, title: "J2", theme: "b", area: "Archanes", free_visit_names: [], paid_option_titles: [], restaurant_names: ["Taverna Archanes", "X", "Y"] },
      { day: 3, date: null, title: "J3", theme: "c", area: "Héraklion et environs", free_visit_names: [], paid_option_titles: [], restaurant_names: ["Taverna Fodele", "Z"] }
    ],
    suggested_excursions: [],
    free_culture_highlights: [],
    pacing_notes: [],
    alternatives: [],
    verification_needed: []
  });

  it("replaces invented names with rated places, never the same table twice, within budget", () => {
    const byArea = new Map<string, PlaceResult[]>([
      ["heraklion", [place("Peskesi", 4.6, 3200), place("Ippokambos", 4.5, 2100), place("Palace Grill", 4.7, 500, "€€€€"), place("Merastri", 4.4, 700), place("Ligo Krasi", 4.5, 400)]],
      ["archanes", [place("Kritamon", 4.8, 60)]]
    ]);
    const out = outline();
    const placesByName = assignRestaurants(out, byArea, BRIEF);

    // 2500 € / 4 / 5 = 125 €/day/person → up to €€€, so the €€€€ grill is skipped; three tables a day.
    expect(out.days[0].restaurant_names).toEqual(["Peskesi", "Ippokambos", "Merastri"]);
    // One real candidate beats three invented names: the model completes the day.
    expect(out.days[1].restaurant_names).toEqual(["Kritamon"]);
    // "Héraklion et environs" reuses the Héraklion pool, minus the tables already used.
    expect(out.days[2].restaurant_names).toEqual(["Ligo Krasi"]);
    expect([...placesByName.keys()]).toEqual(["peskesi", "ippokambos", "merastri", "kritamon", "ligo krasi"]);
  });

  it("derives the price tiers from the daily budget per person", () => {
    // Without live prices, 30 % of 2500 € for meals → 37 €/day/person → up to €€.
    expect([...allowedPriceTiers(BRIEF)]).toEqual(["€", "€€"]);
    expect([...allowedPriceTiers({ ...BRIEF, budget_total: 800 })]).toEqual(["€"]);
    expect([...allowedPriceTiers({ ...BRIEF, budget_total: null })]).toEqual(["€", "€€", "€€€"]);
  });

  it("writes the Google Maps facts onto the expanded days", () => {
    const placesByName = new Map<string, PlaceResult>([["peskesi", { ...place("Peskesi", 4.6, 3200), website: "https://peskesi.gr", phone: "+30 281" }]]);
    const days: any[] = [{ day: 1, restaurants: [{ name: "PESKESI", price_range: "€€€", cuisine: "" }, { name: "Taverna X", price_range: "€€" }] }];
    attachRestaurantData(days, placesByName);
    expect(days[0].restaurants[0]).toMatchObject({ name: "Peskesi", verified: true, rating: 4.6, reviews_count: 3200, price_range: "€€", website: "https://peskesi.gr", cuisine: "Taverne" });
    expect(days[0].restaurants[1].verified).toBe(false);
  });
});

describe("mealSearchTerms", () => {
  it("prefers the meal town, then the area, then the last part of a composite area", async () => {
    const { mealSearchTerms } = await import("../skills/itineraryPlanner");
    expect(mealSearchTerms({ area: "Gorges de Samaria et Omalos", meal_town: "Omalos" })).toEqual(["Omalos", "Gorges de Samaria et Omalos"]);
    expect(mealSearchTerms({ area: "Baie de Mirabello et Elounda", meal_town: null })).toEqual(["Baie de Mirabello et Elounda", "Elounda"]);
    expect(mealSearchTerms({ area: "Knossos / Héraklion" })).toEqual(["Knossos / Héraklion", "Héraklion"]);
    expect(mealSearchTerms({ area: "Héraklion", meal_town: "héraklion" })).toEqual(["héraklion"]);
  });
});

describe("activities: three priced options", () => {
  it("parses GetYourGuide prices from snippets", async () => {
    const { parseEuroPrice } = await import("../tools/serpapi");
    expect(parseEuroPrice("À partir de 45,00 € par personne")).toBe(45);
    expect(parseEuroPrice("from €25 per person")).toBe(25);
    expect(parseEuroPrice("Durée 3 heures")).toBeNull();
  });

  it("matches an option to the offer about the same place and prices it", async () => {
    const { matchOffer, attachActivityOffers, ensureThreeOptions, activityBudgetPerPerson } = await import("../skills/itineraryPlanner");
    const offers = [
      { title: "Héraklion : billet coupe-file pour le palais de Knossos", url: "https://www.getyourguide.fr/a/1", price_from_eur: 20, snippet: "" },
      { title: "Crète : croisière vers Balos et Gramvousa", url: "https://www.getyourguide.fr/a/2", price_from_eur: 38, snippet: "" },
      { title: "Crète : les meilleures activités 2026", url: "https://www.getyourguide.fr/l/crete", price_from_eur: null, snippet: "" }
    ];
    expect(matchOffer("Visite guidée du palais de Knossos", offers)?.url).toBe("https://www.getyourguide.fr/a/1");
    expect(matchOffer("Lagon de Balos et île de Gramvousa en bateau", offers)?.url).toBe("https://www.getyourguide.fr/a/2");
    expect(matchOffer("Dégustation d'huile d'olive", offers)).toBeNull();

    const option = (title: string, price: number | null): any => ({ option_label: "Option A", title, description: "", price_from_eur: price, price_note: price != null ? `${price} € par adulte` : null, kind: "experience", suited_for: [], intensity: "easy", budget_fit: "unknown", price_source: "estimate", gyg_url: null, local_alternative: null, booking_links: [], photo: null });
    const days: any[] = [{ day: 1, paid_options: [option("Visite guidée du palais de Knossos", 25), option("Dégustation d'huile d'olive", 15), option("Hélicoptère au-dessus de la Crète", 400)] }];
    const budget = activityBudgetPerPerson(BRIEF); // 2500 × 0.2 / 4 / 5 = 25
    expect(budget).toBe(25);
    attachActivityOffers(days, offers as any, budget, "fr");
    expect(days[0].paid_options[0]).toMatchObject({ gyg_url: "https://www.getyourguide.fr/a/1", price_from_eur: 20, price_source: "getyourguide", budget_fit: "within_budget" });
    expect(days[0].paid_options[0].price_note).toContain("dès 20 €");
    expect(days[0].paid_options[1]).toMatchObject({ gyg_url: null, price_source: "estimate", budget_fit: "within_budget" });
    expect(days[0].paid_options[1].price_note).toContain("tarif indicatif");
    expect(days[0].paid_options[2].budget_fit).toBe("over_budget");

    // A short day is completed from the unused headline excursions, and relabelled A/B/C.
    const outline: any = { days: [], suggested_excursions: [{ title: "Gorges de Samaria", description: "Rando", duration: "1 jour", price_estimate_eur: 30, style: "nature", photo: null }, { title: "Visite guidée du palais de Knossos", description: "", duration: null, price_estimate_eur: null, style: null, photo: null }] };
    const short: any[] = [{ day: 2, paid_options: [option("Plage", 0), option("Musée", 10)] }];
    ensureThreeOptions(short, outline, "fr");
    expect(short[0].paid_options.map((o: any) => o.option_label)).toEqual(["Option A", "Option B", "Option C"]);
    expect(short[0].paid_options[2].title).toBe("Gorges de Samaria");
    expect(short[0].paid_options[2].price_note).toContain("indicatif");
  });

  it("ranks a table with a view above an equal one without", async () => {
    const { fetchFn } = fakeFetch({
      local_results: [
        { title: "Taverna Plain", rating: 4.6, reviews: 500 },
        { title: "Taverna Thalassa", rating: 4.6, reviews: 500, description: "Terrasse avec vue sur le port", thumbnail: "https://lh5.googleusercontent.com/p/x" }
      ]
    });
    resetSerpApiCache();
    const result = await searchRestaurants({ config, fetchFn }, { area: "Chania", destination: "Crète" });
    const places = (result.data as any).places as PlaceResult[];
    expect(places.map((p) => p.name)).toEqual(["Taverna Thalassa", "Taverna Plain"]);
    expect(places[0].thumbnail).toBe("https://lh5.googleusercontent.com/p/x");
  });
});

describe("activity mix", () => {
  it("derives the categories from the questionnaire styles, most wanted first", async () => {
    const { preferredCategories } = await import("../skills/itineraryPlanner");
    expect(preferredCategories({ ...BRIEF, traveler_types: ["beach", "adventure"] })).toEqual(["discovery", "sport", "relax", "culture"]);
    expect(preferredCategories({ ...BRIEF, traveler_types: ["culture", "food"] })).toEqual(["culture", "food", "discovery", "relax"]);
    expect(preferredCategories({ ...BRIEF, traveler_types: [] })).toEqual(["culture", "discovery", "relax", "sport"]);
  });

  it("reads a category from the text and makes each day three different kinds", async () => {
    const { categoryOf, balanceOptionCategories } = await import("../skills/itineraryPlanner");
    expect(categoryOf("Randonnée dans les gorges de Samaria")).toBe("sport");
    expect(categoryOf("Plage de Vaï et palmeraie")).toBe("relax");
    expect(categoryOf("Dégustation d'huile d'olive")).toBe("food");
    expect(categoryOf("Palais de Knossos")).toBe("culture");
    expect(categoryOf("Croisière vers Spinalonga")).toBe("discovery");

    const option = (title: string, category: string): any => ({ option_label: "", title, description: "", category, price_from_eur: 10, price_note: null, kind: "experience", suited_for: [], intensity: "easy", budget_fit: "unknown", price_source: "estimate", gyg_url: null, local_alternative: null, booking_links: [], photo: null });
    const outline: any = { days: [], suggested_excursions: [{ title: "Kayak à Elounda", description: "", duration: null, price_estimate_eur: 40, style: "sport", photo: null }] };
    const days: any[] = [
      { day: 1, paid_options: [option("Palais de Knossos", "culture"), option("Musée archéologique", "culture"), option("Plage d'Ammoudara", "relax")] },
      { day: 2, paid_options: [option("Monastère d'Arkadi", "discovery"), option("Baignade à Balos", "relax"), option("Cours de cuisine", "food")] }
    ];
    balanceOptionCategories(days, outline, { ...BRIEF, traveler_types: ["beach", "adventure"] });
    // The second museum (duplicate culture) became the spare kayak, the most wanted missing kind.
    expect(days[0].paid_options.map((o: any) => [o.title, o.category])).toEqual([["Palais de Knossos", "culture"], ["Kayak à Elounda", "sport"], ["Plage d'Ammoudara", "relax"]]);
    // A mislabeled monastery is corrected from its text.
    expect(days[1].paid_options[0].category).toBe("culture");
  });
});

describe("envelopes from the remaining budget", () => {
  it("derives meal tiers and the activity envelope from what tickets leave", async () => {
    const { allowedPriceTiers, activityBudgetPerPerson } = await import("../skills/itineraryPlanner");
    // 1400 € left, 4 people, 5 days: meals 45 % → 31.5 €/day → up to €€; activities 35 % → 24 €/day.
    expect([...allowedPriceTiers(BRIEF, 1400)]).toEqual(["€", "€€"]);
    expect(activityBudgetPerPerson(BRIEF, 1400)).toBe(24);
    // Almost nothing left: € only, 2 €/day of activities.
    expect([...allowedPriceTiers(BRIEF, 100)]).toEqual(["€"]);
    expect(activityBudgetPerPerson(BRIEF, 100)).toBe(2);
    // Without live prices the whole-budget shares still apply.
    expect(activityBudgetPerPerson(BRIEF)).toBe(25);
  });
});
