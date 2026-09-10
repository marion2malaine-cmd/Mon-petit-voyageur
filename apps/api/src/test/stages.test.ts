import { describe, expect, it } from "vitest";
import { ItineraryDaySchema, ItineraryOutlineSchema, type ItineraryDay, type ItineraryOutline } from "@mlt/contracts";
import { applyStayAsLodging, applyStayDetails, normalizeStages, stageSummary } from "../skills/itineraryPlanner";
import { renderGuideHtml } from "../guide/renderGuide";
import type { PlanTripResponse } from "@mlt/contracts";

// A four-night slice of the Hà Giang loop: two nights in one village, then a
// move. Written the way a model returns it — the stage named once, the lodging
// forgotten on the second night, the drive left out entirely.
const OUTLINE: ItineraryOutline = ItineraryOutlineSchema.parse({
  trip_summary: "Boucle du Nord",
  days: [
    { day: 1, title: "J1", theme: "Terrasses", area: "Hoàng Su Phì", stage: "Hoàng Su Phì", lodging_name: "Hoang Su Phi Bungalow", route_from: "Hanoï", route_duration: "7 h 30" },
    { day: 2, title: "J2", theme: "Marché", area: "Hoàng Su Phì", stage: "Hoàng Su Phì" },
    { day: 3, title: "J3", theme: "Chanvre", area: "Quản Bạ", stage: "Quản Bạ", lodging_name: "Dao Lodge", route_from: "Hoàng Su Phì", route_duration: "5 h" },
    { day: 4, title: "J4", theme: "Pisé", area: "Đồng Văn", stage: "Đồng Văn", lodging_name: "Lo Lo Ecolodge", route_from: "Quản Bạ", route_duration: "4 h" }
  ]
});

const day = (n: number, patch: Record<string, unknown> = {}): ItineraryDay =>
  ItineraryDaySchema.parse({ day: n, title: `J${n}`, morning: "m", afternoon: "a", evening: "e", ...patch });

describe("stages of a roadbook", () => {
  const days = [
    day(1, { lodging: { name: "Hoang Su Phi Bungalow", price_per_night_eur: 55, price_max_per_night_eur: 75 } }),
    day(2),
    day(3, { lodging: { name: "Dao Lodge", price_per_night_eur: 35 } }),
    day(4, { lodging: { name: "Lo Lo Ecolodge", price_per_night_eur: 40 } })
  ];
  normalizeStages(days, OUTLINE, "Vietnam", "fr");

  it("carries the night forward when the model forgot it", () => {
    expect(days[1].lodging?.name).toBe("Hoang Su Phi Bungalow");
    expect(days[1].stage).toBe("Hoàng Su Phì");
  });

  it("flags only the night the bags actually move", () => {
    expect(days.map((d) => d.lodging?.is_change)).toEqual([true, false, true, true]);
  });

  it("counts the nights of each stage", () => {
    expect(days[0].lodging?.nights).toBe(2);
    expect(days[2].lodging?.nights).toBe(1);
  });

  it("rebuilds the drive the model left out", () => {
    expect(days[2].route?.from).toBe("Hoàng Su Phì");
    expect(days[2].route?.to).toBe("Quản Bạ");
    expect(days[2].route?.duration).toBe("5 h");
    // A day that stays put has no drive to show.
    expect(days[1].route).toBeNull();
  });

  it("gives every night a way to book it", () => {
    const links = days[0].lodging?.booking_links ?? [];
    expect(links.map((l) => l.provider)).toContain("booking");
    expect(links[0].url).toContain("duckduckgo.com/?q=");
  });

  it("sums up the trip one row per stage", () => {
    expect(stageSummary(days)).toEqual([
      expect.objectContaining({ stage: "Hoàng Su Phì", lodging: "Hoang Su Phi Bungalow", nights: 2, price_from: 55, price_to: 75 }),
      expect.objectContaining({ stage: "Quản Bạ", lodging: "Dao Lodge", nights: 1 }),
      expect.objectContaining({ stage: "Đồng Văn", lodging: "Lo Lo Ecolodge", nights: 1 })
    ]);
  });
});

const guideFor = (days: ItineraryDay[]) =>
  renderGuideHtml(
    {
      traveler_summary: "",
      final_trip_plan: { destination: "Vietnam", duration_days: days.length },
      structured_json: { brief: { destination: "Vietnam" }, itinerary: { itinerary_by_day: days } },
      open_verifications: [],
      next_steps: [],
      trace: []
    } as unknown as PlanTripResponse,
    { locale: "fr" }
  );

describe("the roadbook page", () => {
  it("opens on the table of stages and puts the hotel inside each day", () => {
    const days = [
      day(1, { lodging: { name: "Hoang Su Phi Bungalow", price_per_night_eur: 55, price_max_per_night_eur: 75 } }),
      day(2),
      day(3, { lodging: { name: "Dao Lodge", price_per_night_eur: 35 } }),
      day(4, { lodging: { name: "Lo Lo Ecolodge", price_per_night_eur: 40 } })
    ];
    normalizeStages(days, OUTLINE, "Vietnam", "fr");
    const html = guideFor(days);

    expect(html).toContain('<table class="stages">');
    expect(html).toContain("55–75 €");
    // The hotel is read day by day, and the night the bags move is flagged.
    expect(html).toContain("lodging-change");
    expect(html).toContain("Changement d&#39;hôtel");
    expect(html).toContain("Même hôtel que la veille");
    // The drive opens the day it happens.
    expect(html).toContain("Hoàng Su Phì → Quản Bạ");
  });

  it("keeps the single base card for a trip that never moves", () => {
    const days = [day(1), day(2)];
    const outline = ItineraryOutlineSchema.parse({
      trip_summary: "Bruges",
      days: [
        { day: 1, title: "J1", theme: "t", area: "Bruges", stage: "Bruges", lodging_name: "Hotel Dukes' Palace" },
        { day: 2, title: "J2", theme: "t", area: "Bruges", stage: "Bruges" }
      ]
    });
    normalizeStages(days, outline, "Bruges", "fr");

    expect(stageSummary(days)).toHaveLength(1);
    expect(guideFor(days)).toContain("Votre base de séjour");
  });
});

describe("the hotel of a trip that never moves", () => {
  const stay = {
    name: "Peridot Grand Hotel",
    price_per_night: 88,
    currency: "EUR",
    area: "Hanoï",
    rating: 4.6,
    budget_fit: "within_budget" as const,
    booking_url: "https://www.booking.com/hotel/vn/peridot-grand.html",
    notes: [],
    coordinates: { lat: 21.03, lon: 105.85 },
    photo_url: "https://example.com/peridot.jpg"
  };

  it("puts the hotel the search actually priced into every day", () => {
    const days = [day(1, { area: "Hanoï" }), day(2, { area: "Hanoï" })];
    applyStayAsLodging(days, stay, "fr");

    expect(days.map((d) => d.lodging?.name)).toEqual(["Peridot Grand Hotel", "Peridot Grand Hotel"]);
    expect(days[0].lodging?.price_per_night_eur).toBe(88);
    expect(days[0].lodging?.photo?.url).toBe("https://example.com/peridot.jpg");
    // Arriving is the only move of the trip.
    expect(days.map((d) => d.lodging?.is_change)).toEqual([true, false]);
    expect(days[0].lodging?.booking_links[0].url).toBe(stay.booking_url);
  });

  it("never overwrites the named stages of a road trip", () => {
    const days = [day(1, { lodging: { name: "Dao Lodge" } }), day(2)];
    normalizeStages(days, OUTLINE, "Vietnam", "fr");
    applyStayAsLodging(days, stay, "fr");

    expect(days[0].lodging?.name).toBe("Dao Lodge");
  });
});

describe("the listing photo of a named stage hotel", () => {
  const stays = [
    {
      name: "Peridot Grand Hotel & Spa",
      price_per_night: 88,
      currency: "EUR",
      area: "Hanoï",
      rating: 4.6,
      budget_fit: "within_budget" as const,
      booking_url: "https://www.booking.com/hotel/vn/peridot-grand.html",
      notes: [],
      coordinates: { lat: 21.03, lon: 105.85 },
      photo_url: "https://example.com/peridot.jpg"
    }
  ];

  it("takes the real picture, price and link of the hotel the model named", () => {
    const days = [day(1, { lodging: { name: "Peridot Grand Hotel" } }), day(2, { lodging: { name: "Dao Lodge" } })];
    normalizeStages(days, OUTLINE, "Vietnam", "fr");
    applyStayDetails(days, stays as any, "fr");

    expect(days[0].lodging?.photo?.url).toBe("https://example.com/peridot.jpg");
    expect(days[0].lodging?.price_per_night_eur).toBe(88);
    expect(days[0].lodging?.rating).toBe(4.6);
    expect(days[0].lodging?.booking_links[0].url).toBe(stays[0].booking_url);
    // A hotel the search never saw keeps its own query for the photo libraries.
    expect(days[1].lodging?.photo?.url ?? null).toBeNull();
    expect(days[1].lodging?.photo?.query).toContain("Dao Lodge");
  });
});
