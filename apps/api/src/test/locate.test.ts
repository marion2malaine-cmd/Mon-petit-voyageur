import { describe, expect, it, vi } from "vitest";

// Nominatim is never called in tests: the geocoder is replaced by a counter.
const calls: string[] = [];
vi.mock("../tools/geocode", () => ({
  geocodeRequestCount: () => calls.length,
  geocodePlaces: async (places: string[], _destination: string, maxRequests = Infinity) => {
    const out = new Map<string, { lat: number; lon: number }>();
    let used = 0;
    for (const place of places) {
      if (used >= maxRequests) break;
      used += 1;
      calls.push(place);
      out.set(place, { lat: 35 + used, lon: 25 });
    }
    return out;
  }
}));

describe("locateItinerary", () => {
  it("places free visits and ticketed options, not cruises, within the request budget", async () => {
    const { locateItinerary } = await import("../orchestrator/enrichItinerary");
    const itinerary: any = {
      itinerary_by_day: [
        {
          day: 1,
          free_visits: [{ name: "Fontaine Morosini", coordinates: null }, { name: "Agios Titos", coordinates: { lat: 1, lon: 1 } }],
          paid_options: [
            { title: "Palais de Knossos", kind: "ticket", coordinates: null },
            { title: "Croisière vers Balos", kind: "experience", coordinates: null },
            { title: "Musée archéologique", kind: "ticket", coordinates: null }
          ],
          restaurants: [{ name: "Peskesi", address: "Kapetan Charalampi 6", coordinates: null }, { name: "Avli", coordinates: { lat: 2, lon: 2 } }]
        }
      ]
    };
    const changed = await locateItinerary(itinerary, "Crète", 2);
    expect(changed).toBe(true);
    // Budget of 2: the pending free visit, then one ticketed site; the cruise is never a
    // point, the unplaced restaurant waits for the next plan (its address would be used).
    expect(calls).toEqual(["Fontaine Morosini", "Palais de Knossos"]);
    const day = itinerary.itinerary_by_day[0];
    expect(day.free_visits[0].coordinates).toBeTruthy();
    expect(day.paid_options[0].coordinates).toBeTruthy();
    expect(day.paid_options[1].coordinates).toBeNull();
    expect(day.paid_options[2].coordinates).toBeNull();
    expect(day.center).toBeTruthy();
  });
});
