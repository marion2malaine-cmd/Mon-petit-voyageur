import { describe, expect, it } from "vitest";
import { editTrip } from "../tripEdits";
const plan = { structured_json: { itinerary: { itinerary_by_day: [
  { day: 1, free_visits: [{ name: "A" }], paid_options: [{ title: "Ticket" }], restaurants: [{ name: "Old", coordinates: { lat: 1, lon: 2 }, verified: true }] },
  { day: 2, free_visits: [], paid_options: [], restaurants: [] }
] } } };
describe("saved trip edits", () => {
  it("moves without mutating the original or duplicating a visit", () => {
    const updated = editTrip(plan, { action: "move", day: 1, collection: "free_visits", index: 0, targetDay: 2 });
    expect(updated.structured_json.itinerary.itinerary_by_day[0].free_visits).toHaveLength(0);
    expect(updated.structured_json.itinerary.itinerary_by_day[1].free_visits).toEqual([{ name: "A" }]);
    expect(plan.structured_json.itinerary.itinerary_by_day[0].free_visits).toHaveLength(1);
  });
  it("rejects arbitrary fields and invalid indices", () => {
    expect(() => editTrip(plan, { action: "remove", day: 1, collection: "__proto__", index: 0 })).toThrow();
    expect(() => editTrip(plan, { action: "remove", day: 1, collection: "free_visits", index: -1 })).toThrow();
  });
  it("clears old restaurant evidence when replacing it", () => {
    const updated = editTrip(plan, { action: "rename", day: 1, collection: "restaurants", index: 0, name: "New" });
    const restaurant = updated.structured_json.itinerary.itinerary_by_day[0].restaurants[0];
    expect(restaurant.coordinates).toBeNull(); expect(restaurant.verified).toBe(false);
  });
  it("validates budget values", () => {
    expect(() => editTrip(plan, { action: "budget", values: { people: 0 } })).toThrow();
    expect(editTrip(plan, { action: "budget", values: { people: 2, rooms: 1, nights: 3, transport: null } }).structured_json.budget_choices.people).toBe(2);
  });
});
