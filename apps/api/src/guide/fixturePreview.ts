/**
 * Renders the guide from a made-up plan, with no network call at all.
 *
 *   npx tsx src/guide/fixturePreview.ts out.html
 *
 * Checking the layout must never cost a live search credit, so this fixture
 * carries hotels, cars, coordinates and a boat and a plane leg by hand.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderGuideHtml } from "./renderGuide";

const photo = (query: string, seed: number) => ({
  query,
  url: `https://picsum.photos/seed/${seed}/520/360`,
  thumb_url: null,
  credit: "Fixture",
  source_url: null,
  license: null
});

const places: [string, number, number][] = [
  ["Hanoï", 21.03, 105.85],
  ["Hạ Long", 20.95, 107.07],
  ["Huế", 16.46, 107.59],
  ["Hội An", 15.88, 108.33]
];

const days = places.flatMap(([name, lat, lon], index) => [
  {
    day: index + 1,
    date: `2026-03-${String(10 + index * 2).padStart(2, "0")}`,
    title: `Jour ${index + 1} — ${name}`,
    theme: name,
    area: name,
    narrative: `Une journée à ${name}.`,
    morning: "", afternoon: "", evening: "",
    timeline: [{ time: "09:00", label: `Marché de ${name}`, detail: "Petit-déjeuner sur place." }],
    free_visits: [
      { name: `Vieux quartier de ${name}`, description: "À pied, sans billet.", category: "old_town", free_note: "Gratuit", duration: "2 h", coordinates: { lat, lon }, map_url: "https://maps.google.com", photo: photo(`${name} vieux quartier`, index * 10 + 1) }
    ],
    paid_options: [], restaurants: [],
    travel_note: null,
    stage: name,
    route: index === 0 ? null : { from: places[index - 1][0], to: name, duration: "3 h", distance_km: 160, mode: ["car", "boat", "plane", "car"][index], road_note: "", departure_time: "08:00", stops: [] },
    lodging: { name: `Hôtel ${name}`, town: name, price_per_night_eur: 60 + index * 10, price_max_per_night_eur: 90 + index * 10, price_note: null, kind: "hotel", why: "Central, calme, petit-déjeuner inclus.", is_change: true, nights: 2, rating: 4.4, address: null, coordinates: { lat, lon }, booking_links: [{ provider: "booking", label: "Voir sur Booking", url: "https://booking.com" }], photo: photo(`Hôtel ${name}`, index * 10 + 2) },
    center: { lat, lon },
    practical_tips: [], free_day_cost_eur: 0, luggage_storage: null,
    photo: photo(name, index * 10 + 3), backup_option: null
  }
]);

const plan: any = {
  final_trip_plan: { destination: "Vietnam" },
  trace: [],
  structured_json: {
    brief: { destination: "Vietnam", travelers_count: 2, date_window: "mars 2026", traveler_types: ["culture", "nature"] },
    itinerary: { itinerary_by_day: days, suggested_excursions: [], free_culture_highlights: [], forum_findings: [] },
    research: {
      car_rental: {
        needed: true,
        why: "Le programme relie quatre régions.",
        budget_envelope_eur: { min: 200, max: 600 },
        recommended: { category: "Compacte 5 portes", pickup: "in_terminal", pickup_note: "Comptoir dans le terminal." },
        options: [
          { category: "Citadine (2 portes)", seats: 4, transmission: "manual", price_per_day_eur: 28, total_estimate_eur: 224, pickup: "in_terminal", pickup_note: "", fits_budget: true, notes: ["Option la moins chère"], booking_links: [{ provider: "rentalcars", label: "Comparer", url: "https://rentalcars.com" }], example_model: "Fiat Panda", photo: photo("Fiat Panda", 91) },
          { category: "Compacte 5 portes", seats: 5, transmission: "manual", price_per_day_eur: 38, total_estimate_eur: 304, pickup: "in_terminal", pickup_note: "", fits_budget: true, notes: [], booking_links: [], example_model: "Toyota Yaris", photo: photo("Toyota Yaris", 92) },
          { category: "SUV compact", seats: 5, transmission: "automatic", price_per_day_eur: 62, total_estimate_eur: 496, pickup: "shuttle", pickup_note: "", fits_budget: false, notes: [], booking_links: [], example_model: "Nissan Juke", photo: photo("Nissan Juke", 93) }
        ],
        alerts: ["Caution bloquée sur la carte."],
        documents: ["Permis, passeport, carte de crédit."],
        search_links: [],
        pickup_date: "2026-03-10", return_date: "2026-03-18", rental_days: 8
      }
    },
    budget_estimate: null
  }
};

const out = resolve(process.argv[2] ?? "guide-fixture.html");
writeFileSync(out, renderGuideHtml(plan, { locale: "fr", title: "Vietnam", mapboxToken: null, staticMapSrc: null }), "utf8");
console.log(out);
