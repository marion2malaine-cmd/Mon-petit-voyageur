/** Apply a bounded edit to an existing plan, never accepting arbitrary plan JSON. */
export function editTrip(plan: any, edit: any): any {
  const next = structuredClone(plan);
  if (edit?.action === "undo") {
    if (!next.structured_json?.previous_itinerary) throw new Error("nothing_to_undo");
    next.structured_json.itinerary = next.structured_json.previous_itinerary;
    delete next.structured_json.previous_itinerary;
    return next;
  }
  const days = next.structured_json?.itinerary?.itinerary_by_day;
  if (!Array.isArray(days)) throw new Error("invalid_itinerary");
  if (edit?.action === "budget") {
    const b = edit.values;
    if (!b || !Number.isInteger(b.people) || b.people < 1 || b.people > 100 || !Number.isInteger(b.rooms) || b.rooms < 1 || b.rooms > 100 || !Number.isInteger(b.nights) || b.nights < 0 || b.nights > 365 || (b.transport !== null && (typeof b.transport !== "number" || !Number.isFinite(b.transport) || b.transport < 0 || b.transport > 1000000))) throw new Error("invalid_budget");
    next.structured_json.budget_choices = { people: b.people, rooms: b.rooms, nights: b.nights, transport: b.transport };
    return next;
  }
  const day = days.find((d: any) => d.day === edit.day);
  next.structured_json.previous_itinerary = structuredClone(plan.structured_json.itinerary);
  if (!day || !["free_visits", "paid_options", "restaurants"].includes(edit.collection)) throw new Error("invalid_edit");
  const list = day[edit.collection];
  if (!Array.isArray(list) || !Number.isInteger(edit.index) || !list[edit.index]) throw new Error("invalid_item");
  if (edit.action === "complete" && typeof edit.completed === "boolean") {
    list[edit.index].completed = edit.completed;
  } else if (edit.action === "select" && edit.collection === "paid_options" && typeof edit.selected === "boolean") {
    list[edit.index].selected = edit.selected;
  } else if (edit.action === "move") {
    const target = days.find((d: any) => d.day === edit.targetDay);
    if (!target || target === day) throw new Error("invalid_target");
    target[edit.collection] ??= [];
    target[edit.collection].push(list.splice(edit.index, 1)[0]);
  } else if (edit.action === "remove") {
    list.splice(edit.index, 1);
  } else if (edit.action === "rename" && edit.collection === "restaurants" && typeof edit.name === "string" && edit.name.trim().length > 0 && edit.name.length <= 200) {
    list[edit.index] = { name: edit.name.trim(), verified: false, meal: list[edit.index].meal, price_range: "€€", booking_links: [], coordinates: null, photo: null };
  } else throw new Error("invalid_action");
  day.user_edited = true;
  if (!["select", "complete"].includes(edit.action)) { day.timeline = []; day.morning = ""; day.afternoon = ""; day.evening = ""; day.narrative = ""; }
  if (edit.action === "move") {
    const target = days.find((d: any) => d.day === edit.targetDay);
    target.user_edited = true; target.timeline = []; target.morning = ""; target.afternoon = ""; target.evening = ""; target.narrative = "";
  }
  next.structured_json.user_modified_at = new Date().toISOString();
  return next;
}
