import type { InternalFlight, ItineraryDay } from "@mlt/contracts";
import { buildSearchLinks } from "./links";
import { resolveAirportCodes } from "./serpapi";

const FLIGHT_MODE = /plane|avion|vol\b|flight|fly/i;
// A leg the program drives, rides or sails stays that way: Miami to Key West
// has two airports and is still a three-hour road, and offering a flight there
// would send the traveler to buy something they do not need.
const GROUND_MODE = /car|voiture|route|road|drive|train|bus|boat|bateau|ferry|walk|marche|velo|bike/i;


/**
 * The domestic legs of a multi-stage trip, each with the comparators
 * pre-filled for that exact one-way flight.
 *
 * A leg is a day whose route the model marked as flown, or — when the trip
 * crosses several states — a change of stage between two towns that both
 * have an airport of their own (Miami to Las Vegas is a flight whatever the
 * model wrote as the mode; Miami to Key West is a drive). No live search is
 * spent on them: the links open the comparator on the right leg and date.
 */
export function buildInternalFlights(
  days: ItineraryDay[],
  options: { locale: "fr" | "en"; travelers?: number | null; multiState: boolean }
): InternalFlight[] {
  const legs: InternalFlight[] = [];

  for (const day of days) {
    const route = day.route;
    const from = route?.from?.trim();
    const to = route?.to?.trim();
    if (!from || !to || sameTown(from, to)) continue;

    const fromCode = firstCode(resolveAirportCodes(from));
    const toCode = firstCode(resolveAirportCodes(to));
    const mode = route?.mode ?? "";
    const flown = FLIGHT_MODE.test(mode);
    const distinctAirports = !!fromCode && !!toCode && fromCode !== toCode;
    if (!flown && (GROUND_MODE.test(mode) || !(options.multiState && distinctAirports))) continue;


    const searchLinks = buildSearchLinks({
      locale: options.locale,
      originCity: from,
      originCode: fromCode,
      destinationCity: to,
      destinationCode: toCode,
      departureDate: day.date ?? null,
      returnDate: null,
      adults: options.travelers ?? 1
    }).filter((link) => link.category === "flights");

    legs.push({ day: day.day, date: day.date ?? null, from, to, from_code: fromCode, to_code: toCode, search_links: searchLinks });
  }

  return legs;
}

function firstCode(codes: string | null): string | null {
  return codes?.split(",")[0]?.trim() || null;
}

function sameTown(left: string, right: string): boolean {
  const key = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, " ").trim();
  return key(left) === key(right);
}
