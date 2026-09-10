import type {
  BudgetEstimate,
  DestinationMatcherOutput,
  EntryRequirements,
  FlightHotelResearch,
  FreeVisitCategory,
  ItineraryByDay,
  PackingChecklist,
  StructuredTripBrief,
  TravelBriefOutput,
  TravelStyle,
  TripPreferences,
  TripSummaryExport
} from "@mlt/contracts";
import type { LiveTools } from "../tools";
import { buildExperienceLinks, buildSearchLinks } from "../tools/links";
import { resolveAirportCodes } from "../tools/serpapi";
import { type CalendarDay } from "../tools/travelpayouts";
import { degraded } from "../tools/types";
import type { SkillRunResult } from "./types";

export interface HandlerContext {
  locale: "fr" | "en";
  tools: LiveTools;
  /** Departure dates to price when the traveler gave a month or no date. */
  flexDateSamples?: number;
  /** Travelpayouts affiliate marker for Aviasales links, when configured. */
  aviasalesMarker?: string | null;
}

const monthWords = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "janvier",
  "fevrier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
  "décembre"
];

// The questionnaire answers are authoritative: whatever the brief skill (LLM
// or fallback) produced, explicit traveler choices win.
export function mergePreferencesIntoBrief(
  brief: StructuredTripBrief,
  prefs: TripPreferences | null | undefined,
  locale: "fr" | "en"
): StructuredTripBrief {
  if (!prefs) return brief;

  const merged: StructuredTripBrief = { ...brief };

  if (prefs.budget_total) merged.budget_total = prefs.budget_total;
  // An explicitly chosen destination is authoritative: it overrides whatever
  // was guessed from the free-text message.
  if (prefs.destination?.trim()) merged.destination = prefs.destination.trim();
  if (prefs.duration_days) merged.duration_days = prefs.duration_days;
  if (prefs.travelers_count) merged.travelers_count = prefs.travelers_count;
  if (prefs.pace) merged.pace = prefs.pace;
  if (prefs.departure_city) merged.departure_city = prefs.departure_city;
  if (prefs.month) merged.date_window = prefs.month;
  if (prefs.trip_shape) merged.trip_shape = prefs.trip_shape;
  if (prefs.states_count) {
    merged.states_to_visit = prefs.states_count;
    // Several states is a route by definition, whatever the shape field says.
    if (prefs.states_count > 1) merged.trip_shape = "roadtrip";
    const note =
      locale === "fr"
        ? `Voyage aux États-Unis à travers ${prefs.states_count} État${prefs.states_count > 1 ? "s" : ""}`
        : `Trip across ${prefs.states_count} US state${prefs.states_count > 1 ? "s" : ""}`;
    if (!merged.constraints.includes(note)) merged.constraints = [...merged.constraints, note];
  }


  if (prefs.travel_styles.length) {
    const styles = new Set<TravelStyle>([
      ...prefs.travel_styles,
      ...(merged.traveler_types.filter((s) => s in TEMPLATE_EXCURSIONS) as TravelStyle[])
    ]);
    merged.traveler_types = [...styles];
    merged.interests = [...styles].map((style) => styleLabel(style, locale));
  }

  if (!merged.exact_dates.start && merged.date_window) {
    merged.exact_dates = deriveExactDates(merged.date_window, merged.duration_days);
  }

  return merged;
}

const MONTH_INDEX: Record<string, number> = {
  january: 0, janvier: 0,
  february: 1, fevrier: 1, "février": 1,
  march: 2, mars: 2,
  april: 3, avril: 3,
  may: 4, mai: 4,
  june: 5, juin: 5,
  july: 6, juillet: 6,
  august: 7, aout: 7, "août": 7,
  september: 8, septembre: 8,
  october: 9, octobre: 9,
  november: 10, novembre: 10,
  december: 11, decembre: 11, "décembre": 11
};

export async function runTravelBriefParser(
  input: { message: string; preferences?: TripPreferences | null },
  ctx: HandlerContext
): Promise<SkillRunResult<TravelBriefOutput>> {
  const message = input.message;
  const prefs = input.preferences ?? null;
  const normalized = message.toLowerCase();
  const budgetMatch = normalized.match(/(\d{1,3}(?:[  .]\d{3})+|\d{3,6})\s*(€|eur|euros?)/i);
  const daysMatch = normalized.match(/(\d{1,2})\s*(jours?|days?)/i);
  const travelersMatch = normalized.match(/(\d{1,2})\s*(personnes?|people|voyageurs?)/i);
  const departureMatch = normalized.match(/(?:depart|départ|from)\s+(?:de\s+)?([a-zA-Z\-\s]+)/i);

  const destinationHint = extractDestination(message);
  const dateWindow = prefs?.month ?? extractDateWindow(message);
  const durationDays = prefs?.duration_days ?? (daysMatch ? Number(daysMatch[1]) : null);
  const exactDates = deriveExactDates(dateWindow, durationDays);

  // Styles from the questionnaire come first, message keywords complete them.
  const styles = new Set<TravelStyle>(prefs?.travel_styles ?? []);
  if (containsOne(normalized, ["mer", "plage", "beach", "ocean"])) styles.add("beach");
  if (containsOne(normalized, ["nature", "hiking", "randonnée", "rando"])) styles.add("nature");
  if (containsOne(normalized, ["food", "gastronomie", "manger", "cuisine"])) styles.add("food");
  if (containsOne(normalized, ["culture", "musée", "museum", "histoire", "patrimoine"])) styles.add("culture");
  if (containsOne(normalized, ["fête", "soirée", "nightlife", "party", "club"])) styles.add("nightlife");
  if (containsOne(normalized, ["famille", "enfants", "family", "kids"])) styles.add("family");
  if (containsOne(normalized, ["romantique", "romantic", "amoureux", "couple", "lune de miel", "honeymoon"])) styles.add("romantic");
  if (containsOne(normalized, ["aventure", "adventure", "sensations", "sport"])) styles.add("adventure");

  const interests = [...styles].map((style) => styleLabel(style, ctx.locale));

  const mustAvoid: string[] = [];
  if (containsOne(normalized, ["pas trop touristique", "not too tourist", "avoid crowds", "foule"])) {
    mustAvoid.push(ctx.locale === "fr" ? "zones très touristiques" : "very crowded areas");
  }

  const structured: StructuredTripBrief = {
    departure_city: prefs?.departure_city ?? departureMatch?.[1]?.trim() ?? null,
    destination: destinationHint,
    alternative_destinations: [],
    date_window: dateWindow,
    exact_dates: exactDates,
    duration_days: durationDays,
    budget_total: prefs?.budget_total ?? (budgetMatch ? Number(budgetMatch[1].replace(/[  .]/g, "")) : null),
    currency: "EUR",
    travelers_count: prefs?.travelers_count ?? (travelersMatch ? Number(travelersMatch[1]) : 1),
    traveler_types: [...styles],
    interests,
    dislikes: [],
    pace: prefs?.pace ?? (containsOne(normalized, ["slow", "calme", "relax"]) ? "slow" : "moderate"),
    accommodation_preferences: [],
    transport_preferences: [],
    climate_preferences: [],
    must_have: [],
    must_avoid: mustAvoid,
    constraints: [],
    confidence_notes: []
  };

  const missingInformation = [];
  if (!structured.destination) missingInformation.push(ctx.locale === "fr" ? "destination" : "destination");
  if (!structured.duration_days) missingInformation.push(ctx.locale === "fr" ? "durée" : "duration");
  if (!structured.budget_total) missingInformation.push(ctx.locale === "fr" ? "budget" : "budget");

  return {
    output: {
      brief_summary:
        ctx.locale === "fr"
          ? `Brief extrait: ${structured.destination ?? "destination à préciser"}, ${structured.duration_days ?? "durée à préciser"} jours, budget ${structured.budget_total ?? "à préciser"} EUR.`
          : `Brief extracted: ${structured.destination ?? "destination missing"}, ${structured.duration_days ?? "duration missing"} days, budget ${structured.budget_total ?? "missing"} EUR.`,
      structured_trip_brief: structured,
      missing_information: missingInformation,
      assumptions: exactDates.start
        ? [
            ctx.locale === "fr"
              ? `Dates estimées ${exactDates.start} → ${exactDates.end} à partir de "${dateWindow}", à ajuster.`
              : `Dates estimated ${exactDates.start} → ${exactDates.end} from "${dateWindow}", adjust as needed.`
          ]
        : [],
      confidence_scores: {
        destination: structured.destination ? 0.7 : 0.2,
        budget: structured.budget_total ? 0.8 : 0.2,
        duration_days: structured.duration_days ? 0.8 : 0.2
      }
    },
    meta: { toolStatuses: {} }
  };
}

export async function runDestinationMatcher(
  input: { brief: StructuredTripBrief },
  ctx: HandlerContext
): Promise<SkillRunResult<DestinationMatcherOutput>> {
  const brief = input.brief;

  const predefined = suggestDestinations(brief, ctx.locale);
  const top = predefined.slice(0, 3);

  if (brief.destination) {
    top.unshift({
      destination: brief.destination,
      score: 0.9,
      why: ctx.locale === "fr" ? "Destination mentionnée explicitement" : "User already mentioned this destination",
      tradeoffs: [],
      budget_fit: brief.budget_total ? "depends_on_live_prices" : "unknown"
    });
  }

  return {
    output: {
      top_destinations: top.slice(0, 5),
      fit_rationale:
        ctx.locale === "fr"
          ? "Classement basé sur le style, la saison estimée et le budget disponible."
          : "Ranking based on style, estimated season, and available budget.",
      tradeoffs: ctx.locale === "fr" ? ["Prix variables selon la saison"] : ["Seasonal prices may vary"],
      budget_fit: brief.budget_total ? "estimated-fit" : "unknown",
      best_for: ctx.locale === "fr" ? ["voyage équilibré"] : ["balanced trip"],
      watchouts: ctx.locale === "fr" ? ["Vérifier la météo exacte"] : ["Check exact weather conditions"]
    },
    meta: { toolStatuses: {} }
  };
}

export async function runBudgetEstimator(
  input: { brief: StructuredTripBrief },
  ctx: HandlerContext
): Promise<SkillRunResult<BudgetEstimate>> {
  const brief = input.brief;
  const days = brief.duration_days ?? 7;
  const travelers = brief.travelers_count || 1;

  const baseTransport = 180 * travelers;
  const baseLodging = 70 * days;
  const baseFood = 35 * days;
  const baseActivities = 25 * days;
  const baseLocal = 12 * days;
  const baseContingency = 120;

  const estimateMin = baseTransport + baseLodging + baseFood + baseActivities + baseLocal + baseContingency;
  const estimateMax = Math.round(estimateMin * 1.35);

  const providedBudget = brief.budget_total;
  let feasibility: BudgetEstimate["feasibility"] = "tight";
  if (!providedBudget || providedBudget >= estimateMax) feasibility = "good";
  else if (providedBudget < estimateMin) feasibility = "risky";

  return {
    output: {
      feasibility,
      estimated_total: {
        min: estimateMin,
        max: estimateMax,
        currency: brief.currency ?? "EUR"
      },
      budget_breakdown: {
        transport: [Math.round(baseTransport * 0.9), Math.round(baseTransport * 1.4)],
        lodging: [Math.round(baseLodging * 0.9), Math.round(baseLodging * 1.4)],
        food: [Math.round(baseFood * 0.8), Math.round(baseFood * 1.3)],
        local_transit: [Math.round(baseLocal * 0.8), Math.round(baseLocal * 1.3)],
        activities: [Math.round(baseActivities * 0.8), Math.round(baseActivities * 1.5)],
        contingency: [100, 250]
      },
      pressure_points: ctx.locale === "fr" ? ["hébergement", "transport"] : ["lodging", "transport"],
      optimization_options:
        ctx.locale === "fr"
          ? ["Réserver en avance", "Privilégier des quartiers hors hyper-centre"]
          : ["Book early", "Stay slightly outside city center"],
      confidence_notes: ctx.locale === "fr" ? ["Estimation non contractuelle"] : ["Estimate only, not a booking quote"]
    },
    meta: { toolStatuses: {} }
  };
}

export async function runFlightHotelResearch(
  input: { brief: StructuredTripBrief; destinationFallback?: string | null },
  ctx: HandlerContext
): Promise<SkillRunResult<FlightHotelResearch>> {
  const fr = ctx.locale === "fr";
  const destination = input.brief.destination ?? input.destinationFallback ?? null;
  if (!destination) {
    return {
      output: {
        recommended_flights: [],
        recommended_stays: [],
        search_links: [],
        tradeoff_notes: [fr ? "Destination manquante, impossible de lancer une recherche live." : "Destination missing, cannot perform live search."],
        best_choice_by_profile: [],
        live_data_status: "unavailable"
      },
      meta: { toolStatuses: {} }
    };
  }

  const origin = input.brief.departure_city ?? "Paris";
  const travelers = input.brief.travelers_count;
  const nights = Math.max(1, input.brief.duration_days ?? 7);

  // Dates the traveler wrote are searched as such. A month, or nothing, is
  // sampled: a few departure dates are priced and the cheapest wins, so the
  // trip is organised around the fare, not around a guessed 5th of the month.
  const written = !!input.brief.exact_dates.start && !!input.brief.exact_dates.end && !input.brief.exact_dates.estimated;
  // The month at a glance comes first (free): the cheapest known day of the
  // month — or of the cheapest coming month — is the one date the live search
  // is then spent on. Without a calendar, a few dates are sampled instead.
  const calendarPick = written ? null : await cheapestFromCalendar(ctx, input.brief, origin, destination);
  const candidates = written
    ? [{ start: input.brief.exact_dates.start!, end: input.brief.exact_dates.end! }]
    : (calendarPick?.candidates ?? sampleDepartureDates(input.brief, ctx.flexDateSamples ?? 3));
  let start: string | null = candidates[0]?.start ?? null;
  let end: string | null = candidates[0]?.end ?? null;

  // Every live search costs a credit of a small monthly plan, so none is made
  // on a guess: exact dates are required, and flights also need airports the
  // engine knows. What is missing is said in the notes so the traveler can
  // complete the brief instead of reading invented prices.
  const missing: string[] = [];
  if (!start || !end) missing.push(fr ? "dates exactes" : "exact dates");
  const originCode = resolveAirportCodes(origin);
  const destinationCode = resolveAirportCodes(destination);
  const unknownAirports = [!originCode && origin, !destinationCode && destination].filter(Boolean) as string[];

  const skipped = (what: string, data: unknown) => degraded("live-search-skipped", data, [what]);
  const canSearchHotels = missing.length === 0;
  const canSearchFlights = canSearchHotels && unknownAirports.length === 0;

  const searchFlightsOn = (dates: { start: string; end: string }) =>
    ctx.tools.search_flights({
      originCity: origin,
      destinationCity: destination,
      departureDate: dates.start,
      returnDate: dates.end,
      adults: travelers,
      currency: input.brief.currency,
      locale: ctx.locale
    });

  // Flights first, on every candidate date at once; the cheapest fare fixes
  // the dates the hotel is then searched on.
  const flightRuns = canSearchFlights
    ? await Promise.all(candidates.map(async (dates) => ({ dates, result: await searchFlightsOn(dates) })))
    : [];
  const dateOptions = flightRuns.map(({ dates, result }) => ({
    start: dates.start,
    end: dates.end,
    price: cheapestFare(result)
  }));
  const best = flightRuns
    .filter(({ result }) => cheapestFare(result) != null)
    .sort((left, right) => cheapestFare(left.result)! - cheapestFare(right.result)!)[0];
  let chosenDates: { start: string; end: string; reason: string } | null = null;
  if (best) {
    start = best.dates.start;
    end = best.dates.end;
    if (!written) {
      chosenDates = {
        start,
        end,
        reason: calendarPick
          ? calendarPick.reason
          : fr
            ? `Dates les moins chères parmi ${candidates.length} départs testés${input.brief.date_window ? ` en ${input.brief.date_window}` : " sur les prochains mois"}.`
            : `Cheapest dates among ${candidates.length} departures tried${input.brief.date_window ? ` in ${input.brief.date_window}` : " over the coming months"}.`
      };
    }
  }
  const flights = best?.result ?? flightRuns[0]?.result ?? skipped(missing[0] ?? `no airport code: ${unknownAirports.join(", ")}`, { offers: [] });

  const hotels = canSearchHotels && start && end
    ? await ctx.tools.search_hotels({
        city: destination,
        checkInDate: start,
        checkOutDate: end,
        adults: travelers,
        currency: input.brief.currency,
        locale: ctx.locale
      })
    : skipped(missing[0] ?? "no dates", { stays: [] });

  const flightsData = (flights.data as any) ?? {};
  const hotelsData = (hotels.data as any) ?? {};

  const searchLinks = buildSearchLinks({
    locale: ctx.locale,
    originCity: origin,
    originCode: flightsData.origin_code ?? originCode?.split(",")[0] ?? null,
    destinationCity: destination,
    destinationCode: flightsData.destination_code ?? destinationCode?.split(",")[0] ?? null,
    departureDate: start ?? null,
    returnDate: end ?? null,
    adults: travelers,
    originCodes: originCode ?? null,
    destinationCodes: destinationCode ?? null,
    aviasalesMarker: ctx.aviasalesMarker ?? null
  });
  const flightLink = searchLinks.find((l) => l.provider === "skyscanner")?.url ?? null;
  const stayLink = searchLinks.find((l) => l.provider === "booking")?.url ?? null;

  // Budget envelopes: rough shares of the total budget the traveler set upfront.
  // Live prices are totals for the whole party, like the budget itself.
  const budgetTotal = input.brief.budget_total;
  const flightBudget = budgetTotal ? budgetTotal * 0.35 : null;
  const nightBudget = budgetTotal ? (budgetTotal * 0.35) / nights : null;

  // What the cheapest real fare and the cheapest real stay leave of the
  // budget: the itinerary is organised inside that, not inside a percentage.
  const flightsCost = cheapestFare(flights);
  const cheapestNight = ((hotelsData.stays ?? []) as any[])
    .map((stay) => stay.price_per_night)
    .filter((price) => typeof price === "number" && price > 0)
    .sort((left, right) => left - right)[0] as number | undefined;
  const lodgingCost = cheapestNight != null ? Math.round(cheapestNight * nights) : null;
  const liveCosts = flightsCost != null || lodgingCost != null ? { flights: flightsCost, lodging: lodgingCost } : null;
  const remainingBudget =
    budgetTotal && liveCosts ? Math.round(budgetTotal - (flightsCost ?? 0) - (lodgingCost ?? 0)) : null;

  const recommendedFlights = (flightsData.offers ?? [])
    .map((offer: any) => ({
      label: offer.label,
      price: offer.price ?? null,
      currency: offer.currency ?? "EUR",
      total_duration: offer.total_duration ?? null,
      stops: offer.stops ?? null,
      budget_fit: budgetFit(offer.price, flightBudget),
      // The engine's own deep link opens this exact fare; the comparator is
      // the fallback.
      booking_url: offer.link ?? flightLink,
      notes: offer.notes ?? []
    }))
    .sort((a: any, b: any) => (a.price ?? Infinity) - (b.price ?? Infinity));

  const recommendedStays = (hotelsData.stays ?? [])
    .map((stay: any) => ({
      name: stay.name,
      price_per_night: stay.price_per_night ?? null,
      currency: stay.currency ?? "EUR",
      area: stay.area ?? null,
      rating: stay.rating ?? null,
      budget_fit: budgetFit(stay.price_per_night, nightBudget),
      booking_url: stay.link ?? stayLink,
      notes: (stay.notes ?? []).filter(Boolean),
      coordinates: stay.coordinates ?? null,
      photo_url: stay.photo_url ?? null
    }))
    .sort((a: any, b: any) => (a.price_per_night ?? Infinity) - (b.price_per_night ?? Infinity));

  const allStatuses = [flights.status, hotels.status];
  const liveStatus = allStatuses.every((s) => s === "ok")
    ? "ok"
    : allStatuses.some((s) => s === "ok")
      ? "partial"
      : "unavailable";

  const tradeoffNotes: string[] = [];
  if (chosenDates) tradeoffNotes.push(chosenDates.reason);
  if (missing.length) {
    tradeoffNotes.push(
      fr
        ? `Prix live non recherchés: ${missing.join(", ")} à préciser. Les liens ci-dessous sont pré-remplis avec ce qui est connu.`
        : `Live prices not searched: ${missing.join(", ")} needed. The links below are pre-filled with what is known.`
    );
  } else if (unknownAirports.length) {
    tradeoffNotes.push(
      fr
        ? `Aéroport inconnu pour ${unknownAirports.join(", ")}: prix des vols non recherchés, comparez via les liens.`
        : `No airport known for ${unknownAirports.join(", ")}: flight prices not searched, compare through the links.`
    );
  }
  if (remainingBudget != null && budgetTotal) {
    const share = Math.round(((budgetTotal - remainingBudget) / budgetTotal) * 100);
    const perDay = Math.round(Math.max(0, remainingBudget) / Math.max(1, travelers) / nights);
    tradeoffNotes.push(
      remainingBudget <= budgetTotal * 0.15
        ? fr
          ? `Attention : vols${lodgingCost != null ? " et hébergement" : ""} absorbent ${share} % du budget (${budgetTotal - remainingBudget} €). Il reste ${remainingBudget} € pour repas, activités et transports : budget très serré, le programme privilégie le gratuit.`
          : `Warning: flights${lodgingCost != null ? " and lodging" : ""} take ${share}% of the budget (${budgetTotal - remainingBudget} €). ${remainingBudget} € remain for meals, activities and transport: very tight, the program favours free visits.`
        : fr
          ? `Vols${lodgingCost != null ? " + hébergement" : ""} : ${budgetTotal - remainingBudget} € (${share} % du budget). Il reste ${remainingBudget} € pour repas, activités et transports, soit ~${perDay} € par personne et par jour.`
          : `Flights${lodgingCost != null ? " + lodging" : ""}: ${budgetTotal - remainingBudget} € (${share}% of the budget). ${remainingBudget} € remain for meals, activities and transport, ~${perDay} € per person per day.`
    );
  }
  for (const warning of [...flights.warnings, ...hotels.warnings]) {
    if (/quota/i.test(warning)) {
      tradeoffNotes.push(
        fr
          ? "Quota de recherches live épuisé ce mois-ci: prix à vérifier via les liens."
          : "Live search quota exhausted this month: check prices through the links."
      );
      break;
    }
  }
  const insights = flightsData.price_insights;
  if (insights?.price_level) {
    const level: Record<string, [string, string]> = {
      low: ["bas", "low"],
      typical: ["dans la moyenne", "typical"],
      high: ["élevé", "high"]
    };
    const label = level[insights.price_level]?.[fr ? 0 : 1] ?? insights.price_level;
    const range = Array.isArray(insights.typical_price_range) ? insights.typical_price_range : null;
    tradeoffNotes.push(
      fr
        ? `Google Flights juge le prix actuel ${label}${range ? ` (fourchette habituelle ${range[0]}–${range[1]} ${input.brief.currency})` : ""}.`
        : `Google Flights rates the current price as ${label}${range ? ` (usual range ${range[0]}–${range[1]} ${input.brief.currency})` : ""}.`
    );
  }
  tradeoffNotes.push(fr ? "Comparer durée totale et prix, pas seulement le tarif affiché" : "Compare total duration and pricing, not only headline fare");
  if (budgetTotal) {
    tradeoffNotes.push(
      fr
        ? `Enveloppe indicative: ~${Math.round(flightBudget!)} € pour les vols, ~${Math.round(nightBudget!)} €/nuit pour l'hébergement (35% du budget chacun).`
        : `Indicative envelope: ~€${Math.round(flightBudget!)} for flights, ~€${Math.round(nightBudget!)}/night for lodging (35% of budget each).`
    );
  }

  return {
    output: {
      recommended_flights: recommendedFlights,
      recommended_stays: recommendedStays,
      search_links: searchLinks,
      tradeoff_notes: tradeoffNotes,
      best_choice_by_profile: fr ? ["Choix valeur: option avec compromis prix + durée"] : ["Best value: option balancing price and duration"],
      live_data_status: liveStatus,
      chosen_dates: chosenDates,
      date_options: dateOptions,
      // Sampled prices are group totals; the calendar is per adult, like the schema says.
      price_calendar: calendarPick
        ? calendarPick.calendar.map((day) => ({ ...day, chosen: day.date === start }))
        : written
          ? []
          : dateOptions.filter((option) => option.price != null).map((option) => ({ date: option.start, price: Math.round(option.price! / Math.max(1, travelers)), transfers: null, chosen: option.start === start })),
      calendar_source: calendarPick ? ("travelpayouts" as const) : written ? null : ("sampled" as const),
      live_costs: liveCosts,
      remaining_budget_eur: remainingBudget
    },
    meta: {
      toolStatuses: {
        search_flights: flights.status,
        search_hotels: hotels.status
      }
    }
  };
}

/**
 * The cheapest departure of the month the traveler asked for — or of the
 * cheapest coming month when no date was given — from the Travelpayouts
 * calendar, as the single date to price live. Null when the calendar has
 * nothing, so the caller falls back to sampling.
 */
async function cheapestFromCalendar(
  ctx: HandlerContext,
  brief: StructuredTripBrief,
  origin: string,
  destination: string,
  now: Date = new Date()
): Promise<{ candidates: { start: string; end: string }[]; calendar: { date: string; price: number; transfers: number | null }[]; reason: string } | null> {
  const originCodes = resolveAirportCodes(origin);
  const destinationCodes = resolveAirportCodes(destination);
  if (!originCodes || !destinationCodes || !ctx.tools.get_price_calendar) return null;
  const fr = ctx.locale === "fr";
  const duration = Math.max(1, brief.duration_days ?? 7);
  const base = { originCodes, destinationCodes, tripDuration: duration, currency: brief.currency };

  const monthIndex = brief.date_window ? (MONTH_INDEX[brief.date_window.toLowerCase()] ?? -1) : -1;
  let month: string | null = null;
  if (monthIndex >= 0) {
    const year = monthIndex < now.getUTCMonth() ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
    month = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  } else {
    const months = await ctx.tools.get_cheapest_months({ ...base, months: 6 });
    month = ((months.data as any)?.months?.[0]?.month as string | undefined) ?? null;
  }
  if (!month) return null;

  const calendar = await ctx.tools.get_price_calendar({ ...base, month });
  const horizon = now.getTime() + 2 * 86400000;
  const days = (((calendar.data as any)?.days ?? []) as CalendarDay[]).filter((day) => new Date(`${day.date}T12:00:00Z`).getTime() > horizon);
  if (!days.length) return null;

  const cheapest = days.slice().sort((left, right) => left.price - right.price)[0];
  const end = cheapest.return_date ?? new Date(new Date(`${cheapest.date}T12:00:00Z`).getTime() + duration * 86400000).toISOString().slice(0, 10);
  const monthLabel = brief.date_window ?? month;
  return {
    candidates: [{ start: cheapest.date, end }],
    calendar: days.map((day) => ({ date: day.date, price: day.price, transfers: day.transfers })),
    reason: fr
      ? `Calendrier des prix ${monthIndex >= 0 ? `de ${monthLabel}` : `du mois le moins cher (${month})`} : départ le ${cheapest.date} au meilleur prix connu parmi ${days.length} jours (${cheapest.price} € par personne).`
      : `Price calendar ${monthIndex >= 0 ? `for ${monthLabel}` : `of the cheapest month (${month})`}: departing ${cheapest.date} is the best known fare of ${days.length} days (${cheapest.price} € per person).`
  };
}

/** The cheapest total fare of a flight search, or null when it found none. */
function cheapestFare(result: { data: unknown }): number | null {
  const offers = ((result.data as any)?.offers ?? []) as { price?: number | null }[];
  const prices = offers.map((offer) => offer.price).filter((price): price is number => typeof price === "number" && price > 0);
  return prices.length ? Math.min(...prices) : null;
}

/**
 * Departure dates worth pricing when the traveler gave a month or nothing:
 * spread across the month, or the 15th of each of the next months. Each one
 * is a flight search, so `samples` is small and configurable.
 */
export function sampleDepartureDates(
  brief: StructuredTripBrief,
  samples: number,
  now: Date = new Date()
): { start: string; end: string }[] {
  const duration = Math.max(1, brief.duration_days ?? 7);
  const count = Math.max(1, samples);
  const toIso = (date: Date) => date.toISOString().slice(0, 10);
  const withEnd = (start: Date) => ({ start: toIso(start), end: toIso(new Date(start.getTime() + duration * 86400000)) });
  const monthIndex = brief.date_window ? (MONTH_INDEX[brief.date_window.toLowerCase()] ?? -1) : -1;

  if (monthIndex >= 0) {
    let year = now.getUTCFullYear();
    if (monthIndex < now.getUTCMonth()) year += 1;
    const days = count === 1 ? [15] : Array.from({ length: count }, (_, index) => Math.round(4 + (22 * index) / (count - 1)));
    const dates = days
      .map((day) => new Date(Date.UTC(year, monthIndex, day)))
      .filter((date) => date.getTime() > now.getTime() + 2 * 86400000);
    if (dates.length) return dates.map(withEnd);
    // The month is nearly over: next year's.
    return days.map((day) => withEnd(new Date(Date.UTC(year + 1, monthIndex, day))));
  }

  // No month at all: the coming months, one date each, from next month on.
  return Array.from({ length: count }, (_, index) => withEnd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1 + index, 15))));
}

/**
 * Fills the exact dates from the month written in the message when the
 * parser left them empty ("en septembre" → the 5th of next September). Live
 * price searches refuse to run without dates, and this is the documented way
 * the app derives them.
 */
export function completeBriefDates(brief: StructuredTripBrief, message: string): StructuredTripBrief {
  if (brief.exact_dates?.start && brief.exact_dates?.end) return brief;
  const window = brief.date_window ?? extractDateWindow(message);
  if (!window) return brief;
  const dates = deriveExactDates(window, brief.duration_days);
  if (!dates.start) return brief;
  return { ...brief, date_window: brief.date_window ?? window, exact_dates: dates };
}

function budgetFit(price: number | null | undefined, envelope: number | null): "within_budget" | "over_budget" | "unknown" {
  if (typeof price !== "number" || price <= 0 || envelope === null) return "unknown";
  return price <= envelope ? "within_budget" : "over_budget";
}

export async function runEntryRequirementsChecker(
  input: {
    brief: StructuredTripBrief;
    nationality?: string;
    destinationFallback?: string | null;
  },
  ctx: HandlerContext
): Promise<SkillRunResult<EntryRequirements>> {
  const destination = input.brief.destination ?? input.destinationFallback ?? null;
  if (!destination) {
    return {
      output: {
        verification_status: "unknown",
        requirements_summary: [],
        required_actions: [],
        documents_to_prepare: [],
        unknowns: [ctx.locale === "fr" ? "Destination inconnue" : "Unknown destination"]
      },
      meta: { toolStatuses: {} }
    };
  }

  const nationality = input.nationality ?? "FR";
  const result = await ctx.tools.get_entry_requirements({
    nationality,
    destination,
    departureDate: input.brief.exact_dates.start,
    returnDate: input.brief.exact_dates.end
  });

  const verification = result.status === "ok" ? "verified" : result.status === "degraded" ? "unverified" : "unknown";

  return {
    output: {
      verification_status: verification,
      requirements_summary:
        result.status === "ok"
          ? [
              ctx.locale === "fr"
                ? "Exigences récupérées depuis le provider Sherpa."
                : "Requirements retrieved from Sherpa provider."
            ]
          : [ctx.locale === "fr" ? "Informations non confirmées." : "Information not confirmed."],
      required_actions:
        ctx.locale === "fr"
          ? ["Vérifier la validité du passeport", "Confirmer les règles officielles avant départ"]
          : ["Check passport validity", "Confirm official rules before departure"],
      documents_to_prepare: ctx.locale === "fr" ? ["Passeport", "Assurance voyage"] : ["Passport", "Travel insurance"],
      unknowns: result.status === "ok" ? [] : result.warnings
    },
    meta: {
      toolStatuses: {
        get_entry_requirements: result.status
      }
    }
  };
}

interface ActivityPool {
  fr: { mornings: string[]; afternoons: string[]; evenings: string[] };
  en: { mornings: string[]; afternoons: string[]; evenings: string[] };
}

// One pool per travel style; texts are templates where {d} is the destination.
const ACTIVITY_POOLS: Record<TravelStyle | "default", ActivityPool> = {
  beach: {
    fr: {
      mornings: ["Matinée sur la plage principale de {d}", "Baignade tôt le matin, avant la foule", "Balade côtière le long du littoral"],
      afternoons: ["Criques et plages sauvages à explorer", "Sortie snorkeling ou paddle", "Sieste à l'ombre puis baignade en fin d'après-midi"],
      evenings: ["Coucher de soleil les pieds dans le sable", "Dîner de poisson grillé face à la mer", "Apéritif dans un bar de plage"]
    },
    en: {
      mornings: ["Morning on {d}'s main beach", "Early swim before the crowds", "Coastal walk along the shoreline"],
      afternoons: ["Explore hidden coves and wild beaches", "Snorkeling or paddle session", "Shaded rest then late-afternoon swim"],
      evenings: ["Sunset with your feet in the sand", "Grilled fish dinner facing the sea", "Drinks at a beach bar"]
    }
  },
  culture: {
    fr: {
      mornings: ["Visite du musée incontournable de {d}", "Vieille ville et monuments historiques", "Visite guidée du quartier ancien"],
      afternoons: ["Palais, cathédrale ou site classé", "Galeries et ateliers d'artisans", "Quartier alternatif et street art"],
      evenings: ["Spectacle ou concert local", "Dîner dans une institution historique", "Promenade nocturne dans le centre illuminé"]
    },
    en: {
      mornings: ["Visit {d}'s must-see museum", "Old town and historic landmarks", "Guided tour of the ancient quarter"],
      afternoons: ["Palace, cathedral or listed site", "Galleries and artisan workshops", "Alternative district and street art"],
      evenings: ["Local show or concert", "Dinner at a historic institution", "Night walk through the lit-up center"]
    }
  },
  nature: {
    fr: {
      mornings: ["Randonnée avec point de vue sur {d}", "Parc naturel ou jardin botanique", "Lever de soleil depuis un belvédère"],
      afternoons: ["Sentier côtier ou forestier", "Sortie vélo dans la campagne environnante", "Observation de la faune locale"],
      evenings: ["Pique-nique au coucher du soleil", "Dîner champêtre en terrasse", "Observation des étoiles hors de la ville"]
    },
    en: {
      mornings: ["Hike with a viewpoint over {d}", "Natural park or botanical garden", "Sunrise from a lookout"],
      afternoons: ["Coastal or forest trail", "Bike ride in the surrounding countryside", "Local wildlife spotting"],
      evenings: ["Sunset picnic", "Countryside dinner on a terrace", "Stargazing away from the city"]
    }
  },
  food: {
    fr: {
      mornings: ["Marché central de {d} et dégustations", "Café et pâtisseries typiques", "Cours de cuisine locale"],
      afternoons: ["Food tour dans les quartiers gourmands", "Dégustation de vins ou produits régionaux", "Épiceries fines et adresses locales"],
      evenings: ["Dîner gastronomique réservé via TheFork", "Tapas / street food du soir", "Table locale recommandée par les habitants"]
    },
    en: {
      mornings: ["{d}'s central market and tastings", "Coffee and typical pastries", "Local cooking class"],
      afternoons: ["Food tour through gourmet districts", "Wine or regional produce tasting", "Fine grocers and local spots"],
      evenings: ["Gourmet dinner booked via TheFork", "Evening tapas / street food", "Local table recommended by residents"]
    }
  },
  nightlife: {
    fr: {
      mornings: ["Grasse matinée puis brunch à {d}", "Café en terrasse et quartier branché", "Shopping et concept stores"],
      afternoons: ["Rooftop ou bar avec vue", "Sieste stratégique avant la soirée", "Quartier animé en fin de journée"],
      evenings: ["Bars du quartier nocturne", "Concert puis club", "Soirée locale recommandée"]
    },
    en: {
      mornings: ["Sleep in then brunch in {d}", "Terrace coffee in a trendy district", "Shopping and concept stores"],
      afternoons: ["Rooftop or bar with a view", "Strategic nap before the night", "Lively district at dusk"],
      evenings: ["Bars in the nightlife district", "Concert then club", "Recommended local party"]
    }
  },
  family: {
    fr: {
      mornings: ["Activité famille emblématique de {d}", "Aquarium, zoo ou parc animalier", "Plage ou parc adapté aux enfants"],
      afternoons: ["Parc avec aires de jeux", "Musée interactif pour petits et grands", "Balade en petit train ou en bateau"],
      evenings: ["Dîner tôt dans un lieu kids-friendly", "Glace et promenade en famille", "Soirée calme à l'hébergement"]
    },
    en: {
      mornings: ["{d}'s iconic family activity", "Aquarium, zoo or wildlife park", "Kid-friendly beach or park"],
      afternoons: ["Park with playgrounds", "Interactive museum for all ages", "Mini-train or boat ride"],
      evenings: ["Early dinner at a kids-friendly spot", "Ice cream and family stroll", "Quiet evening at the accommodation"]
    }
  },
  romantic: {
    fr: {
      mornings: ["Petit-déjeuner en terrasse à {d}", "Balade main dans la main dans le quartier ancien", "Matinée spa ou hammam en duo"],
      afternoons: ["Point de vue romantique au-dessus de la ville", "Croisière ou balade en barque", "Jardins et ruelles secrètes"],
      evenings: ["Dîner aux chandelles réservé à l'avance", "Coucher de soleil avec une coupe", "Promenade nocturne au bord de l'eau"]
    },
    en: {
      mornings: ["Terrace breakfast in {d}", "Hand-in-hand stroll through the old quarter", "Couples spa morning"],
      afternoons: ["Romantic viewpoint over the city", "Cruise or rowboat ride", "Gardens and secret alleys"],
      evenings: ["Candlelit dinner booked ahead", "Sunset with a glass of wine", "Night walk along the water"]
    }
  },
  adventure: {
    fr: {
      mornings: ["Activité sensations autour de {d} (kayak, via ferrata...)", "Canyoning ou escalade encadrée", "Surf ou sports nautiques"],
      afternoons: ["Randonnée engagée avec dénivelé", "VTT ou quad sur pistes", "Tyrolienne ou parcours aventure"],
      evenings: ["Récupération : dîner copieux mérité", "Échange avec d'autres voyageurs", "Préparation de l'activité du lendemain"]
    },
    en: {
      mornings: ["Adrenaline activity around {d} (kayak, via ferrata...)", "Guided canyoning or climbing", "Surf or water sports"],
      afternoons: ["Demanding hike with elevation", "Mountain biking or quad trails", "Zipline or adventure course"],
      evenings: ["Recovery: a well-earned hearty dinner", "Swap stories with fellow travelers", "Prep for tomorrow's activity"]
    }
  },
  default: {
    fr: {
      mornings: ["Exploration du centre historique de {d}", "Marché local et vie de quartier", "Site emblématique à voir tôt"],
      afternoons: ["Quartier moins touristique à découvrir", "Point de vue panoramique sur {d}", "Temps libre : boutiques et cafés"],
      evenings: ["Dîner dans le quartier animé", "Promenade au bord de l'eau", "Terrasse avec vue pour finir la journée"]
    },
    en: {
      mornings: ["Explore {d}'s historic center", "Local market and neighborhood life", "Iconic site best seen early"],
      afternoons: ["Discover a less touristy district", "Panoramic viewpoint over {d}", "Free time: shops and cafés"],
      evenings: ["Dinner in the lively quarter", "Waterside stroll", "Rooftop terrace to end the day"]
    }
  }
};

interface ExcursionEntry {
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
  duration: { fr: string; en: string };
  price: number; // per person, EUR
  style: TravelStyle | "default";
}

// Hand-picked signature excursions for popular destinations.
const CURATED_EXCURSIONS: Record<string, ExcursionEntry[]> = {
  lisbonne: [
    { titleFr: "Sintra et le palais de Pena", titleEn: "Sintra and Pena Palace", descFr: "Journée dans les palais colorés et jardins classés de Sintra, avec arrêt au Cabo da Roca.", descEn: "Full day among Sintra's colorful palaces and listed gardens, with a stop at Cabo da Roca.", duration: { fr: "Journée", en: "Full day" }, price: 75, style: "culture" },
    { titleFr: "Croisière sur le Tage au coucher du soleil", titleEn: "Tagus sunset cruise", descFr: "Voilier au fil du Tage, sous le pont du 25-Avril, verre à la main.", descEn: "Sailboat along the Tagus, under the 25 de Abril bridge, drink in hand.", duration: { fr: "2 h", en: "2 h" }, price: 45, style: "romantic" },
    { titleFr: "Food tour dans l'Alfama", titleEn: "Alfama food tour", descFr: "Pastéis, ginjinha et petiscos dans les ruelles du plus vieux quartier, avec fado en fin de balade.", descEn: "Pastéis, ginjinha and petiscos through the oldest district's alleys, ending with fado.", duration: { fr: "3 h 30", en: "3.5 h" }, price: 65, style: "food" }
  ],
  porto: [
    { titleFr: "Vallée du Douro et vignobles", titleEn: "Douro Valley and vineyards", descFr: "Journée dans les vignobles en terrasses, dégustations et croisière courte sur le fleuve.", descEn: "Day among terraced vineyards, tastings and a short river cruise.", duration: { fr: "Journée", en: "Full day" }, price: 95, style: "food" },
    { titleFr: "Caves de vin de Porto à Gaia", titleEn: "Port wine cellars in Gaia", descFr: "Visite guidée d'une cave centenaire et dégustation commentée de portos.", descEn: "Guided tour of a century-old cellar with a curated port tasting.", duration: { fr: "2 h", en: "2 h" }, price: 35, style: "food" },
    { titleFr: "Croisière des six ponts", titleEn: "Six bridges cruise", descFr: "Le Douro depuis l'eau, au pied de la Ribeira classée UNESCO.", descEn: "The Douro from the water, below the UNESCO-listed Ribeira.", duration: { fr: "1 h", en: "1 h" }, price: 18, style: "default" }
  ],
  "crete": [
    { titleFr: "Lagon de Balos et île de Gramvousa", titleEn: "Balos lagoon and Gramvousa island", descFr: "Croisière vers le lagon turquoise et la forteresse pirate de Gramvousa.", descEn: "Cruise to the turquoise lagoon and Gramvousa's pirate fortress.", duration: { fr: "Journée", en: "Full day" }, price: 40, style: "beach" },
    { titleFr: "Gorges de Samaria", titleEn: "Samaria Gorge", descFr: "Randonnée mythique de 16 km jusqu'à la mer de Libye, retour en bateau.", descEn: "Iconic 16 km hike down to the Libyan Sea, boat ride back.", duration: { fr: "Journée", en: "Full day" }, price: 45, style: "nature" },
    { titleFr: "Palais de Knossos et musée d'Héraklion", titleEn: "Knossos Palace and Heraklion museum", descFr: "Le berceau de la civilisation minoenne avec un guide archéologue.", descEn: "The cradle of Minoan civilization with an archaeologist guide.", duration: { fr: "Demi-journée", en: "Half day" }, price: 55, style: "culture" }
  ],
  algarve: [
    { titleFr: "Grotte de Benagil en kayak", titleEn: "Benagil cave by kayak", descFr: "Pagayez jusqu'à la grotte marine la plus célèbre du Portugal.", descEn: "Paddle into Portugal's most famous sea cave.", duration: { fr: "2 h 30", en: "2.5 h" }, price: 35, style: "adventure" },
    { titleFr: "Croisière dauphins depuis Lagos", titleEn: "Dolphin cruise from Lagos", descFr: "Observation des dauphins au large de la côte dorée.", descEn: "Dolphin watching off the golden coast.", duration: { fr: "1 h 30", en: "1.5 h" }, price: 45, style: "family" },
    { titleFr: "Falaises de la Ponta da Piedade", titleEn: "Ponta da Piedade cliffs", descFr: "Balade en bateau entre arches et criques secrètes au coucher du soleil.", descEn: "Boat ride through arches and hidden coves at sunset.", duration: { fr: "2 h", en: "2 h" }, price: 30, style: "romantic" }
  ],
  rome: [
    { titleFr: "Colisée et Forum romain coupe-file", titleEn: "Skip-the-line Colosseum and Roman Forum", descFr: "Accès prioritaire et guide historien pour l'arène et le cœur antique.", descEn: "Priority access and historian guide for the arena and ancient heart.", duration: { fr: "3 h", en: "3 h" }, price: 60, style: "culture" },
    { titleFr: "Vatican tôt le matin", titleEn: "Early-morning Vatican", descFr: "Musées et chapelle Sixtine avant l'ouverture au public.", descEn: "Museums and Sistine Chapel before public opening.", duration: { fr: "3 h", en: "3 h" }, price: 70, style: "culture" },
    { titleFr: "Cours de pâtes fraîches dans le Trastevere", titleEn: "Fresh pasta class in Trastevere", descFr: "Fettuccine et tiramisu faits main, dégustés avec un verre de vin.", descEn: "Handmade fettuccine and tiramisu, enjoyed with a glass of wine.", duration: { fr: "3 h", en: "3 h" }, price: 65, style: "food" }
  ],
  barcelone: [
    { titleFr: "Sagrada Família avec accès aux tours", titleEn: "Sagrada Família with tower access", descFr: "Billet coupe-file et montée dans les tours de Gaudí.", descEn: "Skip-the-line ticket and climb into Gaudí's towers.", duration: { fr: "2 h", en: "2 h" }, price: 55, style: "culture" },
    { titleFr: "Montserrat en demi-journée", titleEn: "Half-day Montserrat", descFr: "Monastère perché, crémaillère et dégustation de liqueurs locales.", descEn: "Clifftop monastery, rack railway and local liqueur tasting.", duration: { fr: "Demi-journée", en: "Half day" }, price: 55, style: "nature" },
    { titleFr: "Croisière tapas au coucher du soleil", titleEn: "Sunset tapas cruise", descFr: "Voilier le long du front de mer, tapas et cava à bord.", descEn: "Sail along the seafront with tapas and cava on board.", duration: { fr: "2 h", en: "2 h" }, price: 60, style: "nightlife" }
  ],
  "seville": [
    { titleFr: "Alcázar et cathédrale coupe-file", titleEn: "Skip-the-line Alcázar and cathedral", descFr: "Les joyaux mudéjars et la Giralda avec un guide local.", descEn: "Mudéjar jewels and the Giralda with a local guide.", duration: { fr: "3 h", en: "3 h" }, price: 55, style: "culture" },
    { titleFr: "Spectacle de flamenco à Triana", titleEn: "Flamenco show in Triana", descFr: "Tablao intimiste dans le berceau du flamenco.", descEn: "Intimate tablao in flamenco's birthplace.", duration: { fr: "1 h 30", en: "1.5 h" }, price: 25, style: "nightlife" },
    { titleFr: "Tapas tour nocturne", titleEn: "Evening tapas tour", descFr: "Bars historiques et spécialités andalouses de quartier en quartier.", descEn: "Historic bars and Andalusian bites from district to district.", duration: { fr: "3 h", en: "3 h" }, price: 70, style: "food" }
  ],
  "madere": [
    { titleFr: "Levada des 25 Fontaines", titleEn: "25 Fontes levada walk", descFr: "Randonnée le long des canaux jusqu'aux cascades de la forêt laurifère.", descEn: "Hike along the water channels to laurel-forest waterfalls.", duration: { fr: "Journée", en: "Full day" }, price: 40, style: "nature" },
    { titleFr: "Observation des baleines et dauphins", titleEn: "Whale and dolphin watching", descFr: "Sortie en catamaran à la rencontre des cétacés de l'Atlantique.", descEn: "Catamaran trip to meet Atlantic cetaceans.", duration: { fr: "3 h", en: "3 h" }, price: 45, style: "family" },
    { titleFr: "Pico do Arieiro au lever du soleil", titleEn: "Sunrise at Pico do Arieiro", descFr: "Au-dessus de la mer de nuages à 1 818 m, petit-déjeuner inclus.", descEn: "Above the sea of clouds at 1,818 m, breakfast included.", duration: { fr: "Demi-journée", en: "Half day" }, price: 50, style: "romantic" }
  ],
  santorin: [
    { titleFr: "Croisière caldeira et sources chaudes", titleEn: "Caldera cruise and hot springs", descFr: "Catamaran autour du volcan, baignade et barbecue à bord.", descEn: "Catamaran around the volcano, swim stops and onboard barbecue.", duration: { fr: "Demi-journée", en: "Half day" }, price: 90, style: "romantic" },
    { titleFr: "Randonnée Fira - Oia", titleEn: "Fira to Oia hike", descFr: "Le sentier de la caldeira, entre villages blancs et panoramas.", descEn: "The caldera trail between white villages and panoramas.", duration: { fr: "4 h", en: "4 h" }, price: 0, style: "nature" },
    { titleFr: "Dégustation dans les vignobles volcaniques", titleEn: "Volcanic vineyard tasting", descFr: "Assyrtiko et vins de sable dans trois domaines de l'île.", descEn: "Assyrtiko and sand-grown wines across three island estates.", duration: { fr: "4 h", en: "4 h" }, price: 120, style: "food" }
  ],
  sardaigne: [
    { titleFr: "Archipel de la Maddalena en bateau", titleEn: "La Maddalena archipelago by boat", descFr: "Eaux caraïbes et îles granitiques du nord de la Sardaigne.", descEn: "Caribbean-like waters and granite isles of northern Sardinia.", duration: { fr: "Journée", en: "Full day" }, price: 60, style: "beach" },
    { titleFr: "Gorge de Gorropu", titleEn: "Gorropu gorge", descFr: "Randonnée dans l'un des canyons les plus profonds d'Europe.", descEn: "Hike one of Europe's deepest canyons.", duration: { fr: "Journée", en: "Full day" }, price: 45, style: "adventure" },
    { titleFr: "Village nuragique et dégustation locale", titleEn: "Nuragic village and local tasting", descFr: "Civilisation mystérieuse des nuraghes puis pecorino et cannonau.", descEn: "The mysterious nuraghe civilization, then pecorino and cannonau.", duration: { fr: "Demi-journée", en: "Half day" }, price: 50, style: "culture" }
  ],
  athenes: [
    { titleFr: "Acropole et musée au lever du jour", titleEn: "Acropolis and museum at daybreak", descFr: "Le Parthénon avant la chaleur et la foule, avec guide archéologue.", descEn: "The Parthenon before heat and crowds, with an archaeologist guide.", duration: { fr: "3 h", en: "3 h" }, price: 50, style: "culture" },
    { titleFr: "Cap Sounion au coucher du soleil", titleEn: "Cape Sounion at sunset", descFr: "Le temple de Poséidon face à la mer Égée embrasée.", descEn: "Poseidon's temple facing the blazing Aegean.", duration: { fr: "Demi-journée", en: "Half day" }, price: 55, style: "romantic" },
    { titleFr: "Street food tour de Monastiraki", titleEn: "Monastiraki street food tour", descFr: "Souvlaki, loukoumades et marchés dans l'Athènes populaire.", descEn: "Souvlaki, loukoumades and markets in working-class Athens.", duration: { fr: "3 h", en: "3 h" }, price: 45, style: "food" }
  ],
  slovenie: [
    { titleFr: "Lac de Bled et gorges de Vintgar", titleEn: "Lake Bled and Vintgar gorge", descFr: "Barque vers l'île de Bled puis passerelles au fil de l'eau émeraude.", descEn: "Row to Bled island, then boardwalks over emerald water.", duration: { fr: "Journée", en: "Full day" }, price: 65, style: "nature" },
    { titleFr: "Grottes de Postojna et château de Predjama", titleEn: "Postojna caves and Predjama castle", descFr: "Train souterrain dans un monde de stalactites, château troglodyte.", descEn: "Underground train through stalactites, cliff-built castle.", duration: { fr: "Demi-journée", en: "Half day" }, price: 70, style: "family" },
    { titleFr: "Rafting sur la Soča", titleEn: "Soča river rafting", descFr: "Descente de la rivière turquoise des Alpes juliennes.", descEn: "Ride the turquoise river of the Julian Alps.", duration: { fr: "Demi-journée", en: "Half day" }, price: 55, style: "adventure" }
  ],
  acores: [
    { titleFr: "Observation des baleines à São Miguel", titleEn: "Whale watching in São Miguel", descFr: "Cachalots et dauphins dans l'un des meilleurs spots au monde.", descEn: "Sperm whales and dolphins at one of the world's best spots.", duration: { fr: "3 h", en: "3 h" }, price: 60, style: "family" },
    { titleFr: "Lagoa das Sete Cidades", titleEn: "Sete Cidades twin lakes", descFr: "Randonnée sur la crête du cratère aux lacs bleu et vert.", descEn: "Crater-rim hike over the blue and green lakes.", duration: { fr: "Demi-journée", en: "Half day" }, price: 40, style: "nature" },
    { titleFr: "Bain thermal à Furnas et cozido volcanique", titleEn: "Furnas hot springs and volcanic cozido", descFr: "Sources chaudes puis ragoût cuit dans la terre du volcan.", descEn: "Hot springs, then stew slow-cooked in volcanic soil.", duration: { fr: "Journée", en: "Full day" }, price: 75, style: "food" }
  ],
  bologne: [
    { titleFr: "Atelier pâtes fraîches avec une nonna", titleEn: "Fresh pasta workshop with a nonna", descFr: "Tortellini et tagliatelles roulés à la main, puis dégustation.", descEn: "Hand-rolled tortellini and tagliatelle, then tasting.", duration: { fr: "3 h", en: "3 h" }, price: 70, style: "food" },
    { titleFr: "Route du parmesan et du vinaigre balsamique", titleEn: "Parmesan and balsamic route", descFr: "Caseificio à l'aube, acetaia centenaire et déjeuner de produits.", descEn: "Dawn dairy visit, century-old acetaia and producers' lunch.", duration: { fr: "Journée", en: "Full day" }, price: 95, style: "food" },
    { titleFr: "Tours médiévales et portiques UNESCO", titleEn: "Medieval towers and UNESCO porticoes", descFr: "Montée de l'Asinelli et balade sous les 40 km d'arcades.", descEn: "Climb the Asinelli and stroll beneath 40 km of arcades.", duration: { fr: "2 h 30", en: "2.5 h" }, price: 20, style: "culture" }
  ],
  "san sebastian": [
    { titleFr: "Tournée des bars à pintxos de la vieille ville", titleEn: "Old town pintxos crawl", descFr: "Les comptoirs mythiques de la Parte Vieja avec un gourmet local.", descEn: "The legendary counters of the Parte Vieja with a local foodie.", duration: { fr: "3 h", en: "3 h" }, price: 85, style: "food" },
    { titleFr: "Surf sur la plage de Zurriola", titleEn: "Surf at Zurriola beach", descFr: "Cours pour tous niveaux sur la vague urbaine du Pays basque.", descEn: "All-level lessons on the Basque Country's urban wave.", duration: { fr: "2 h", en: "2 h" }, price: 45, style: "adventure" },
    { titleFr: "Monte Igueldo et baie de la Concha", titleEn: "Monte Igueldo and La Concha bay", descFr: "Funiculaire centenaire et le plus beau panorama de la ville.", descEn: "Century-old funicular and the city's finest panorama.", duration: { fr: "2 h", en: "2 h" }, price: 10, style: "romantic" }
  ],
  lyon: [
    { titleFr: "Traboules du Vieux Lyon et Croix-Rousse", titleEn: "Vieux Lyon and Croix-Rousse traboules", descFr: "Passages secrets des canuts avec un guide conteur.", descEn: "The silk workers' secret passages with a storytelling guide.", duration: { fr: "2 h 30", en: "2.5 h" }, price: 25, style: "culture" },
    { titleFr: "Bouchons et halles Paul Bocuse", titleEn: "Bouchons and Paul Bocuse market hall", descFr: "Quenelles, cervelle de canut et praline chez les artisans.", descEn: "Quenelles, cervelle de canut and praline at artisan stalls.", duration: { fr: "3 h", en: "3 h" }, price: 75, style: "food" },
    { titleFr: "Beaujolais et pierres dorées", titleEn: "Beaujolais and golden-stone villages", descFr: "Villages toscans du Rhône et dégustations chez les vignerons.", descEn: "The Rhône's Tuscan-like villages with winegrower tastings.", duration: { fr: "Demi-journée", en: "Half day" }, price: 75, style: "nature" }
  ],
  berlin: [
    { titleFr: "Berlin de la guerre froide à vélo", titleEn: "Cold War Berlin by bike", descFr: "Mur, Checkpoint Charlie et histoires d'évasions avec un guide.", descEn: "Wall, Checkpoint Charlie and escape stories with a guide.", duration: { fr: "3 h 30", en: "3.5 h" }, price: 35, style: "culture" },
    { titleFr: "Street art et friches de Kreuzberg", titleEn: "Kreuzberg street art and wastelands", descFr: "Fresques géantes et lieux alternatifs de la scène berlinoise.", descEn: "Giant murals and alternative venues of the Berlin scene.", duration: { fr: "3 h", en: "3 h" }, price: 25, style: "nightlife" },
    { titleFr: "Croisière sur la Spree", titleEn: "Spree river cruise", descFr: "L'île aux Musées et le Reichstag depuis l'eau.", descEn: "Museum Island and the Reichstag from the water.", duration: { fr: "1 h", en: "1 h" }, price: 22, style: "default" }
  ],
  valence: [
    { titleFr: "Cité des Arts et des Sciences", titleEn: "City of Arts and Sciences", descFr: "Océanographique et architecture futuriste de Calatrava.", descEn: "Oceanogràfic and Calatrava's futuristic architecture.", duration: { fr: "Demi-journée", en: "Half day" }, price: 40, style: "family" },
    { titleFr: "Paella chez l'habitant à l'Albufera", titleEn: "Home-cooked paella at the Albufera", descFr: "Balade en barque sur la lagune puis paella au feu de bois.", descEn: "Lagoon boat ride, then wood-fired paella.", duration: { fr: "Demi-journée", en: "Half day" }, price: 65, style: "food" },
    { titleFr: "Vélo dans le jardin du Turia", titleEn: "Bike ride through the Turia gardens", descFr: "9 km de parc dans l'ancien lit du fleuve, de tour en tour.", descEn: "9 km of park in the old riverbed, tower to tower.", duration: { fr: "2 h 30", en: "2.5 h" }, price: 20, style: "nature" }
  ],
  copenhague: [
    { titleFr: "Canaux en bateau et Nyhavn", titleEn: "Canal cruise and Nyhavn", descFr: "Les façades colorées et la Petite Sirène depuis l'eau.", descEn: "Colorful facades and the Little Mermaid from the water.", duration: { fr: "1 h", en: "1 h" }, price: 18, style: "default" },
    { titleFr: "Jardins de Tivoli en soirée", titleEn: "Tivoli gardens by night", descFr: "Manèges centenaires et illuminations féériques.", descEn: "Century-old rides and fairy-tale illuminations.", duration: { fr: "3 h", en: "3 h" }, price: 30, style: "family" },
    { titleFr: "Food tour de Torvehallerne", titleEn: "Torvehallerne food tour", descFr: "Smørrebrød, harengs et nouvelle cuisine nordique au marché.", descEn: "Smørrebrød, herring and new Nordic bites at the market.", duration: { fr: "3 h", en: "3 h" }, price: 80, style: "food" }
  ],
  venise: [
    { titleFr: "Murano, Burano et Torcello", titleEn: "Murano, Burano and Torcello", descFr: "Souffleurs de verre et maisons arc-en-ciel de la lagune.", descEn: "Glassblowers and rainbow houses of the lagoon.", duration: { fr: "Demi-journée", en: "Half day" }, price: 25, style: "culture" },
    { titleFr: "Gondole au crépuscule", titleEn: "Twilight gondola ride", descFr: "Petits canaux loin de la foule à l'heure dorée.", descEn: "Quiet back canals at golden hour.", duration: { fr: "30 min", en: "30 min" }, price: 90, style: "romantic" },
    { titleFr: "Cicchetti et bacari cachés", titleEn: "Cicchetti and hidden bacari", descFr: "Tapas vénitiennes et spritz dans les bars à vin historiques.", descEn: "Venetian tapas and spritz in historic wine bars.", duration: { fr: "2 h 30", en: "2.5 h" }, price: 55, style: "food" }
  ],
  bruges: [
    { titleFr: "Canaux et béguinage en barque", titleEn: "Canals and beguinage by boat", descFr: "La Venise du Nord au fil de l'eau, ponts et cygnes.", descEn: "The Venice of the North from the water, bridges and swans.", duration: { fr: "35 min", en: "35 min" }, price: 12, style: "romantic" },
    { titleFr: "Atelier chocolat belge", titleEn: "Belgian chocolate workshop", descFr: "Pralines faites main avec un maître chocolatier.", descEn: "Handmade pralines with a master chocolatier.", duration: { fr: "2 h", en: "2 h" }, price: 40, style: "food" },
    { titleFr: "Beffroi et places médiévales", titleEn: "Belfry and medieval squares", descFr: "366 marches pour la plus belle vue de Flandre.", descEn: "366 steps to Flanders' finest view.", duration: { fr: "2 h", en: "2 h" }, price: 15, style: "culture" }
  ],
  interlaken: [
    { titleFr: "Parapente au-dessus des lacs", titleEn: "Paragliding over the lakes", descFr: "Vol biplace entre Thoune et Brienz face à l'Eiger.", descEn: "Tandem flight between Thun and Brienz facing the Eiger.", duration: { fr: "1 h 30", en: "1.5 h" }, price: 180, style: "adventure" },
    { titleFr: "Jungfraujoch, le toit de l'Europe", titleEn: "Jungfraujoch, Top of Europe", descFr: "Train à crémaillère jusqu'à 3 454 m, glacier et palais de glace.", descEn: "Rack railway to 3,454 m, glacier and ice palace.", duration: { fr: "Journée", en: "Full day" }, price: 210, style: "nature" },
    { titleFr: "Canyoning dans les gorges de Grimsel", titleEn: "Canyoning in the Grimsel gorges", descFr: "Sauts, toboggans naturels et rappels dans l'eau alpine.", descEn: "Jumps, natural slides and abseils in alpine water.", duration: { fr: "Demi-journée", en: "Half day" }, price: 130, style: "adventure" }
  ],
  montenegro: [
    { titleFr: "Bouches de Kotor en bateau", titleEn: "Bay of Kotor by boat", descFr: "Notre-Dame-du-Rocher et la grotte bleue du fjord des Balkans.", descEn: "Our Lady of the Rocks and the blue cave of the Balkan fjord.", duration: { fr: "Demi-journée", en: "Half day" }, price: 45, style: "beach" },
    { titleFr: "Rafting dans le canyon de la Tara", titleEn: "Tara canyon rafting", descFr: "Le canyon le plus profond d'Europe, eaux cristallines.", descEn: "Europe's deepest canyon, crystal-clear water.", duration: { fr: "Journée", en: "Full day" }, price: 80, style: "adventure" },
    { titleFr: "Remparts de Kotor au coucher du soleil", titleEn: "Kotor ramparts at sunset", descFr: "1 350 marches jusqu'à la forteresse Saint-Jean.", descEn: "1,350 steps up to St John's fortress.", duration: { fr: "2 h 30", en: "2.5 h" }, price: 8, style: "culture" }
  ],
  paris: [
    { titleFr: "Louvre : chefs-d'œuvre coupe-file", titleEn: "Louvre masterpieces, skip the line", descFr: "La Joconde et les incontournables en 2 h avec un guide.", descEn: "The Mona Lisa and the highlights in 2 h with a guide.", duration: { fr: "2 h", en: "2 h" }, price: 65, style: "culture" },
    { titleFr: "Croisière sur la Seine au dîner", titleEn: "Seine dinner cruise", descFr: "Paris illuminé depuis l'eau, menu français à bord.", descEn: "Illuminated Paris from the water, French menu on board.", duration: { fr: "2 h 30", en: "2.5 h" }, price: 100, style: "romantic" },
    { titleFr: "Montmartre gourmand", titleEn: "Gourmet Montmartre", descFr: "Fromages, baguette tradition et vin naturel sur la butte.", descEn: "Cheese, artisan baguette and natural wine on the hill.", duration: { fr: "3 h", en: "3 h" }, price: 70, style: "food" }
  ],
  marrakech: [
    { titleFr: "Désert d'Agafay au coucher du soleil", titleEn: "Agafay desert at sunset", descFr: "Dromadaire, thé à la menthe et dîner berbère sous les étoiles.", descEn: "Camel ride, mint tea and Berber dinner under the stars.", duration: { fr: "Demi-journée", en: "Half day" }, price: 60, style: "romantic" },
    { titleFr: "Médina, souks et palais secrets", titleEn: "Medina, souks and secret palaces", descFr: "Bahia, tombeaux saadiens et artisans avec un guide local.", descEn: "Bahia, Saadian tombs and artisans with a local guide.", duration: { fr: "Demi-journée", en: "Half day" }, price: 35, style: "culture" },
    { titleFr: "Vallée de l'Ourika et villages berbères", titleEn: "Ourika valley and Berber villages", descFr: "Cascades de l'Atlas et déjeuner au bord de l'oued.", descEn: "Atlas waterfalls and lunch by the river.", duration: { fr: "Journée", en: "Full day" }, price: 45, style: "nature" }
  ],
  "tenerife": [
    { titleFr: "Téléphérique du Teide et coucher de soleil", titleEn: "Teide cable car and sunset", descFr: "Le plus haut sommet d'Espagne, puis étoiles au parc national.", descEn: "Spain's highest peak, then stargazing in the national park.", duration: { fr: "Demi-journée", en: "Half day" }, price: 60, style: "nature" },
    { titleFr: "Whale watching à Los Gigantes", titleEn: "Whale watching at Los Gigantes", descFr: "Pilotes et dauphins au pied des falaises géantes.", descEn: "Pilot whales and dolphins beneath the giant cliffs.", duration: { fr: "3 h", en: "3 h" }, price: 40, style: "family" },
    { titleFr: "Quad sur les pistes du volcan", titleEn: "Volcano quad tour", descFr: "Sensations sur les chemins de lave autour du Teide.", descEn: "Thrills on the lava tracks around Mount Teide.", duration: { fr: "3 h", en: "3 h" }, price: 70, style: "adventure" }
  ]
};

// Generic per-style templates for destinations without a curated list ({d} = destination).
const TEMPLATE_EXCURSIONS: Record<TravelStyle | "default", ExcursionEntry[]> = {
  beach: [{ titleFr: "Croisière baignade et snorkeling autour de {d}", titleEn: "Swim and snorkel cruise around {d}", descFr: "Journée en bateau vers les plus belles criques accessibles uniquement par la mer.", descEn: "Boat day to the finest coves only reachable from the sea.", duration: { fr: "Journée", en: "Full day" }, price: 55, style: "beach" }],
  culture: [{ titleFr: "Visite guidée du centre historique de {d}", titleEn: "Guided tour of {d}'s historic center", descFr: "Deux heures avec un guide local pour comprendre l'histoire et les incontournables.", descEn: "Two hours with a local guide covering the history and highlights.", duration: { fr: "2 h", en: "2 h" }, price: 25, style: "culture" }],
  nature: [{ titleFr: "Randonnée guidée dans l'arrière-pays de {d}", titleEn: "Guided hike in {d}'s hinterland", descFr: "Sentiers panoramiques et pause pique-nique avec produits locaux.", descEn: "Scenic trails with a picnic of local produce.", duration: { fr: "Demi-journée", en: "Half day" }, price: 35, style: "nature" }],
  food: [{ titleFr: "Food tour des spécialités de {d}", titleEn: "{d} specialties food tour", descFr: "Dégustations guidées chez les artisans et adresses préférées des habitants.", descEn: "Guided tastings at artisan shops and local favorites.", duration: { fr: "3 h", en: "3 h" }, price: 60, style: "food" }],
  nightlife: [{ titleFr: "Tournée des bars avec un local à {d}", titleEn: "Bar crawl with a local in {d}", descFr: "Les meilleures adresses nocturnes, entrée incluse dans un club.", descEn: "The best night spots, club entry included.", duration: { fr: "4 h", en: "4 h" }, price: 25, style: "nightlife" }],
  family: [{ titleFr: "Journée famille : nature et animaux autour de {d}", titleEn: "Family day: nature and animals around {d}", descFr: "Parc animalier ou aquarium et activités adaptées aux enfants.", descEn: "Wildlife park or aquarium plus kid-friendly activities.", duration: { fr: "Journée", en: "Full day" }, price: 35, style: "family" }],
  romantic: [{ titleFr: "Croisière au coucher du soleil à {d}", titleEn: "Sunset cruise in {d}", descFr: "Une coupe à la main face au soleil couchant, en petit comité.", descEn: "A glass in hand facing the sunset, small group only.", duration: { fr: "2 h", en: "2 h" }, price: 50, style: "romantic" }],
  adventure: [{ titleFr: "Activité sensations autour de {d}", titleEn: "Adrenaline activity around {d}", descFr: "Canyoning, kayak ou via ferrata selon la saison, encadré par des pros.", descEn: "Canyoning, kayaking or via ferrata depending on season, with pro guides.", duration: { fr: "Demi-journée", en: "Half day" }, price: 65, style: "adventure" }],
  default: [{ titleFr: "Excursion d'une journée autour de {d}", titleEn: "Full-day excursion around {d}", descFr: "Les plus beaux environs de la destination avec transport inclus.", descEn: "The destination's finest surroundings, transport included.", duration: { fr: "Journée", en: "Full day" }, price: 60, style: "default" }]
};

function normalizeDestination(destination: string): string {
  return destination.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export function buildExcursions(
  destination: string,
  styles: TravelStyle[],
  locale: "fr" | "en"
): ItineraryByDay["suggested_excursions"] {
  const fr = locale === "fr";
  const curated = CURATED_EXCURSIONS[normalizeDestination(destination)] ?? [];

  // Curated picks matching the traveler's styles first, then the rest.
  const matching = styles.length ? curated.filter((e) => styles.includes(e.style as TravelStyle)) : curated;
  const others = curated.filter((e) => !matching.includes(e));
  let selected = [...matching, ...others];

  if (!selected.length) {
    const pools: (TravelStyle | "default")[] = styles.length ? styles : ["default"];
    selected = pools.flatMap((pool) => TEMPLATE_EXCURSIONS[pool]);
    if (styles.length) selected.push(...TEMPLATE_EXCURSIONS.default);
  }

  return selected.slice(0, 4).map((entry) => {
    const title = (fr ? entry.titleFr : entry.titleEn).replace(/\{d\}/g, destination);
    return {
      title,
      description: (fr ? entry.descFr : entry.descEn).replace(/\{d\}/g, destination),
      duration: entry.duration[locale],
      price_estimate_eur: entry.price,
      style: styleLabel(entry.style === "default" ? null : (entry.style as TravelStyle), locale),
      booking_url: `https://www.getyourguide.${fr ? "fr" : "com"}/s/?q=${encodeURIComponent(`${title} ${destination}`)}`
    };
  });
}

// Free cultural visits for the no-LLM fallback. They are deliberately generic
// categories rather than invented place names: a wrong monument name in a
// printed guide is worse than an honest "the old town of <destination>".
const FREE_VISIT_TEMPLATES: Array<{
  category: FreeVisitCategory;
  fr: { name: string; description: string; note: string };
  en: { name: string; description: string; note: string };
  duration: { fr: string; en: string };
}> = [
  {
    category: "old_town",
    fr: { name: "Vieille ville de {d}", description: "Ruelles historiques, places ombragées et façades anciennes, à parcourir sans itinéraire précis.", note: "Accès libre toute l'année" },
    en: { name: "Old town of {d}", description: "Historic lanes, shaded squares and old facades, best wandered without a plan.", note: "Free access all year" },
    duration: { fr: "1 h 30", en: "1.5 h" }
  },
  {
    category: "market",
    fr: { name: "Marché central de {d}", description: "Étals de producteurs, épices et spécialités locales : le meilleur endroit pour goûter avant d'acheter.", note: "Entrée libre, le matin de préférence" },
    en: { name: "Central market of {d}", description: "Producer stalls, spices and local specialties: taste before you buy.", note: "Free entry, mornings are best" },
    duration: { fr: "1 h", en: "1 h" }
  },
  {
    category: "religious",
    fr: { name: "Église principale de {d}", description: "Le grand édifice religieux du centre, souvent le plus ancien monument encore debout.", note: "Entrée libre hors offices" },
    en: { name: "Main church of {d}", description: "The central place of worship, often the oldest building still standing.", note: "Free entry outside services" },
    duration: { fr: "30 min", en: "30 min" }
  },
  {
    category: "viewpoint",
    fr: { name: "Point de vue panoramique sur {d}", description: "La vue d'ensemble sur la ville et son horizon, spectaculaire en fin d'après-midi.", note: "Gratuit, accès à pied" },
    en: { name: "Panoramic viewpoint over {d}", description: "The wide view over town and horizon, spectacular in late afternoon.", note: "Free, on foot" },
    duration: { fr: "45 min", en: "45 min" }
  },
  {
    category: "garden",
    fr: { name: "Jardin public de {d}", description: "Un parc pour souffler à l'ombre entre deux visites, avec aires de jeux et bancs.", note: "Entrée libre" },
    en: { name: "Public garden of {d}", description: "A shaded park to slow down between visits, with playgrounds and benches.", note: "Free entry" },
    duration: { fr: "45 min", en: "45 min" }
  },
  {
    category: "monument",
    fr: { name: "Quartier historique et remparts de {d}", description: "Fortifications, portes anciennes et chemin de ronde à longer librement.", note: "Extérieurs gratuits" },
    en: { name: "Historic quarter and walls of {d}", description: "Fortifications, old gates and a rampart walk you can follow freely.", note: "Exteriors free" },
    duration: { fr: "1 h", en: "1 h" }
  },
  {
    category: "beach",
    fr: { name: "Plage publique de {d}", description: "Baignade et pause au soleil sans transat payant, serviette suffit.", note: "Accès public gratuit" },
    en: { name: "Public beach of {d}", description: "A swim and a sunny break with no paid lounger needed.", note: "Free public access" },
    duration: { fr: "2 h", en: "2 h" }
  },
  {
    category: "street_art",
    fr: { name: "Quartier créatif de {d}", description: "Fresques murales, ateliers d'artisans et cafés indépendants à ciel ouvert.", note: "Balade gratuite" },
    en: { name: "Creative district of {d}", description: "Murals, artisan workshops and independent cafés, all open-air.", note: "Free walk" },
    duration: { fr: "1 h", en: "1 h" }
  },
  {
    category: "village",
    fr: { name: "Village traditionnel proche de {d}", description: "Vie locale authentique, place centrale et four à pain, loin des circuits touristiques.", note: "Visite libre" },
    en: { name: "Traditional village near {d}", description: "Authentic local life, a central square and a bread oven, away from the tourist trail.", note: "Free to visit" },
    duration: { fr: "1 h 30", en: "1.5 h" }
  },
  {
    category: "nature",
    fr: { name: "Sentier naturel autour de {d}", description: "Chemin balisé accessible en famille, avec vues dégagées sur la région.", note: "Sentier gratuit" },
    en: { name: "Nature trail around {d}", description: "A family-friendly marked path with open views over the region.", note: "Free trail" },
    duration: { fr: "1 h 30", en: "1.5 h" }
  },
  {
    category: "museum",
    fr: { name: "Musée municipal de {d} (jour gratuit)", description: "Collections locales : beaucoup de musées municipaux offrent une entrée gratuite un jour par mois.", note: "Vérifier le jour de gratuité sur place" },
    en: { name: "Municipal museum of {d} (free day)", description: "Local collections: many municipal museums are free one day a month.", note: "Check the free day locally" },
    duration: { fr: "1 h 30", en: "1.5 h" }
  },
  {
    category: "archaeology",
    fr: { name: "Vestiges antiques visibles de {d}", description: "Ruines et pierres anciennes accessibles depuis la voie publique, sans billet.", note: "Visibles librement" },
    en: { name: "Open-air ancient remains of {d}", description: "Ruins and old stones reachable from the public path, no ticket needed.", note: "Freely visible" },
    duration: { fr: "45 min", en: "45 min" }
  }
];

const RESTAURANT_TEMPLATES: Array<{
  meal: "lunch" | "dinner";
  priceRange: "€" | "€€" | "€€€";
  fr: { name: string; cuisine: string; why: string; tags: string[] };
  en: { name: string; cuisine: string; why: string; tags: string[] };
}> = [
  {
    meal: "lunch",
    priceRange: "€",
    fr: { name: "Cantine locale du marché de {d}", cuisine: "Cuisine du marché", why: "Plat du jour court et bon marché, là où déjeunent les habitants.", tags: ["Petit budget", "Rapide"] },
    en: { name: "Market canteen in {d}", cuisine: "Market cooking", why: "A short, cheap daily menu where locals actually eat.", tags: ["Budget", "Quick"] }
  },
  {
    meal: "dinner",
    priceRange: "€€",
    fr: { name: "Taverne traditionnelle de {d}", cuisine: "Cuisine régionale", why: "Recettes du terroir, portions généreuses et terrasse pour le soir.", tags: ["Terrasse", "Famille"] },
    en: { name: "Traditional tavern in {d}", cuisine: "Regional cooking", why: "Local recipes, generous portions and an evening terrace.", tags: ["Terrace", "Family"] }
  },
  {
    meal: "lunch",
    priceRange: "€€",
    fr: { name: "Table de bord de mer près de {d}", cuisine: "Poissons et fruits de mer", why: "Poisson du jour face à l'eau, idéal après une matinée de visites.", tags: ["Vue mer", "Poisson"] },
    en: { name: "Seaside table near {d}", cuisine: "Fish and seafood", why: "Catch of the day by the water, perfect after a morning of visits.", tags: ["Sea view", "Fish"] }
  },
  {
    meal: "dinner",
    priceRange: "€€€",
    fr: { name: "Restaurant gastronomique de {d}", cuisine: "Cuisine créative", why: "Une adresse plus travaillée pour marquer un soir du séjour.", tags: ["Soirée", "Réservation conseillée"] },
    en: { name: "Fine-dining spot in {d}", cuisine: "Creative cooking", why: "A more refined address to mark one evening of the trip.", tags: ["Evening", "Booking advised"] }
  },
  {
    meal: "lunch",
    priceRange: "€",
    fr: { name: "Street food du centre de {d}", cuisine: "Spécialités à emporter", why: "Manger sur le pouce entre deux visites, sans perdre une heure à table.", tags: ["Sur le pouce", "Petit budget"] },
    en: { name: "Street food in central {d}", cuisine: "Takeaway specialties", why: "Eat on the go between two visits without losing an hour.", tags: ["On the go", "Budget"] }
  },
  {
    meal: "dinner",
    priceRange: "€€",
    fr: { name: "Bistrot de quartier à {d}", cuisine: "Cuisine de bistrot", why: "Ambiance de voisinage, carte courte et vins de la région.", tags: ["Ambiance locale", "Vins"] },
    en: { name: "Neighbourhood bistro in {d}", cuisine: "Bistro cooking", why: "A neighbourhood feel, a short menu and regional wines.", tags: ["Local vibe", "Wine"] }
  }
];

export async function runItineraryBuilder(
  input: {
    brief: StructuredTripBrief;
    selectedDestination?: string | null;
  },
  ctx: HandlerContext
): Promise<SkillRunResult<ItineraryByDay>> {
  const fr = ctx.locale === "fr";
  const destination = input.brief.destination ?? input.selectedDestination ?? (fr ? "votre destination" : "your destination");
  // No practical cap on the trip length: a two-month journey is a legitimate
  // request. The upper bound only guards against absurd input.
  const days = Math.min(Math.max(input.brief.duration_days ?? 7, 2), 90);

  const styles = (input.brief.traveler_types as TravelStyle[]).filter((s) => s in ACTIVITY_POOLS);
  const activeStyles: (TravelStyle | "default")[] = styles.length ? styles : ["default"];

  const fill = (template: string) => template.replace(/\{d\}/g, destination);
  const pick = (pool: string[], index: number) => fill(pool[index % pool.length]);

  // Rotate across the chosen styles so each day has its own theme, honoring
  // itinerary_rules.md: max 2 major blocks/day, a lighter day every 3rd-4th
  // day, one full-day excursion, and a backup option per day.
  const counters = new Map<string, number>();
  const nextFrom = (style: TravelStyle | "default", slot: "mornings" | "afternoons" | "evenings") => {
    const key = `${style}:${slot}`;
    const index = counters.get(key) ?? 0;
    counters.set(key, index + 1);
    return pick(ACTIVITY_POOLS[style][ctx.locale][slot], index);
  };

  const backups = fr
    ? ["Musée ou galerie en cas de pluie", "Café couvert avec vue pour attendre l'éclaircie", "Marché couvert ou centre commercial local", "Spa ou hammam en solution replis"]
    : ["Museum or gallery if it rains", "Covered café with a view while waiting it out", "Covered market or local mall", "Spa or hammam as fallback"];

  const excursions = buildExcursions(destination, styles, ctx.locale);
  const topExcursion = excursions[0] ?? null;

  // Rotate with a stride so that consecutive days never share a free visit and
  // the trip covers as many different categories as the pool allows.
  const freeVisitsForDay = (index: number, count: number) =>
    Array.from({ length: count }, (_, slot) => {
      const template = FREE_VISIT_TEMPLATES[(index * 3 + slot) % FREE_VISIT_TEMPLATES.length];
      const text = template[ctx.locale];
      return {
        name: fill(text.name),
        category: template.category,
        description: fill(text.description),
        free_note: text.note,
        duration: template.duration[ctx.locale],
        best_time: null,
        address_hint: null,
        map_url: null,
        photo: null
      };
    });

  const restaurantsForDay = (index: number) =>
    Array.from({ length: 2 }, (_, slot) => {
      const template = RESTAURANT_TEMPLATES[(index * 2 + slot) % RESTAURANT_TEMPLATES.length];
      const text = template[ctx.locale];
      return {
        name: fill(text.name),
        meal: template.meal,
        cuisine: text.cuisine,
        price_range: template.priceRange,
        area: destination,
        why: text.why,
        tags: text.tags,
        budget_note: fr
          ? "Présélection par type de table : confirmez l'adresse exacte via le lien de réservation."
          : "Preselected by type of place: confirm the exact address through the booking link.",
        booking_links: [],
        photo: null
      };
    });

  // Paid activities are alternatives for the same day, never a to-do list.
  const paidOptionsForDay = (index: number) => {
    const labels = fr ? ["Option A", "Option B", "Option C"] : ["Option A", "Option B", "Option C"];
    const count = excursions.length >= 3 ? 3 : Math.max(excursions.length, 1);
    return Array.from({ length: count }, (_, slot) => {
      const excursion = excursions[(index + slot) % Math.max(excursions.length, 1)] ?? topExcursion;
      return {
        option_label: labels[slot],
        title: excursion?.title ?? (fr ? `Activité guidée à ${destination}` : `Guided activity in ${destination}`),
        description: excursion?.description ?? "",
        duration: excursion?.duration ?? null,
        price_from_eur: excursion?.price_estimate_eur ?? null,
        price_note: excursion?.price_estimate_eur
          ? fr
            ? `à partir de ~${excursion.price_estimate_eur} € par personne`
            : `from ~${excursion.price_estimate_eur} € per person`
          : null,
        suited_for: excursion?.style ? [excursion.style] : [],
        intensity: "easy" as const,
        kind: "experience" as const,
        local_alternative: {
          how_to_book: fr
            ? "Comparez avec les agences locales et le site officiel avant de réserver sur une plateforme : la même sortie s'y vend souvent moins cher."
            : "Compare with local agencies and the official site before booking on a platform: the same outing is often cheaper there.",
          typical_saving: fr ? "20 à 40 %" : "20-40 %",
          forum_tip: fr
            ? "Vérifiez sur les forums voyageurs l'heure de départ la moins fréquentée et les frais annexes (parking, taxe portuaire)."
            : "Check traveler forums for the least crowded departure time and the extra fees (parking, port tax)."
        },
        booking_links: [],
        photo: null
      };
    });
  };

  const startDate = input.brief.exact_dates.start;
  const dateForDay = (index: number): string | null => {
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
    const date = new Date(`${startDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  };

  const excursionDay = days >= 5 ? Math.ceil(days / 2) : null;
  const itinerary = Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    const style = activeStyles[index % activeStyles.length];
    const themeLabel = styleLabel(style === "default" ? null : (style as TravelStyle), ctx.locale);

    const base = {
      day,
      date: dateForDay(index),
      area: destination,
      free_visits: freeVisitsForDay(index, 3),
      paid_options: paidOptionsForDay(index),
      restaurants: restaurantsForDay(index),
      travel_note: null,
      practical_tips: fr
        ? ["Vérifier les horaires d'ouverture la veille", "Prévoir eau, chapeau et chaussures confortables"]
        : ["Check opening hours the day before", "Bring water, a hat and comfortable shoes"],
      free_day_cost_eur: 0,
      photo: null
    };

    if (day === 1) {
      return {
        ...base,
        title: fr ? `Jour 1 — Arrivée à ${destination}` : `Day 1 — Arrival in ${destination}`,
        theme: fr ? "Arrivée en douceur" : "Gentle arrival",
        narrative: fr
          ? `Première journée volontairement légère : le temps d'arriver, de poser les valises et de faire connaissance avec ${destination} à pied.`
          : `A deliberately light first day: time to arrive, drop the bags and get to know ${destination} on foot.`,
        morning: fr ? "Trajet et installation à l'hébergement" : "Travel and check-in at the accommodation",
        afternoon: fr
          ? `Première balade pour prendre le pouls de ${destination}`
          : `First stroll to get a feel for ${destination}`,
        evening: fr ? "Dîner simple près de l'hébergement" : "Easy dinner near the accommodation",
        timeline: fr
          ? [
              { time: "Matin", label: "Arrivée et transfert", detail: "Récupération du véhicule ou transfert vers l'hébergement" },
              { time: "14h00", label: "Installation", detail: "Check-in, repos et repérage du quartier" },
              { time: "17h00", label: "Première balade", detail: "Centre historique et front de mer à pied" },
              { time: "20h00", label: "Dîner", detail: "Table simple à proximité de l'hébergement" }
            ]
          : [
              { time: "Morning", label: "Arrival and transfer", detail: "Pick up the car or transfer to the accommodation" },
              { time: "2 pm", label: "Check-in", detail: "Settle in, rest and scout the area" },
              { time: "5 pm", label: "First stroll", detail: "Historic centre and waterfront on foot" },
              { time: "8 pm", label: "Dinner", detail: "Simple table near the accommodation" }
            ],
        backup_option: fr ? "Repos si le trajet a été long" : "Rest if the journey was long"
      };
    }

    if (day === days) {
      return {
        ...base,
        title: fr ? `Jour ${day} — Départ` : `Day ${day} — Departure`,
        theme: fr ? "Derniers instants" : "Last moments",
        narrative: fr
          ? "Journée courte : on garde le matin pour les souvenirs et un dernier café, puis place à la logistique du retour."
          : "A short day: the morning is for souvenirs and a last coffee, then it is all about getting home.",
        morning: fr ? "Derniers achats et souvenirs au marché" : "Last souvenirs at the market",
        afternoon: fr ? "Check-out et trajet retour" : "Check-out and journey home",
        evening: fr ? "Retour à la maison" : "Back home",
        paid_options: [],
        free_visits: freeVisitsForDay(index, 2),
        timeline: fr
          ? [
              { time: "9h00", label: "Derniers achats", detail: "Marché ou boutiques d'artisans du centre" },
              { time: "11h00", label: "Check-out", detail: "Libération de l'hébergement, bagages en consigne si besoin" },
              { time: "13h00", label: "Départ", detail: "Route vers l'aéroport ou la gare" }
            ]
          : [
              { time: "9 am", label: "Last shopping", detail: "Market or artisan shops in the centre" },
              { time: "11 am", label: "Check-out", detail: "Leave the accommodation, luggage storage if needed" },
              { time: "1 pm", label: "Departure", detail: "Head to the airport or station" }
            ],
        backup_option: fr ? "Consigne à bagages si vol tardif" : "Luggage storage if the flight is late"
      };
    }

    if (excursionDay !== null && day === excursionDay) {
      return {
        ...base,
        title: fr ? `Jour ${day} — Excursion à la journée` : `Day ${day} — Full-day excursion`,
        theme: fr ? "Grande excursion" : "Headline excursion",
        narrative: topExcursion
          ? fr
            ? `Le grand jour du séjour : ${topExcursion.title}. Départ tôt pour profiter du site avant l'affluence.`
            : `The highlight of the trip: ${topExcursion.title}. Leave early to enjoy the site before the crowds.`
          : fr
            ? "Une journée entière consacrée à la découverte des environs."
            : "A full day devoted to exploring the surroundings.",
        morning: topExcursion
          ? fr
            ? `Excursion recommandée : ${topExcursion.title}`
            : `Recommended excursion: ${topExcursion.title}`
          : fr
            ? `Départ pour une excursion autour de ${destination} (réservable via GetYourGuide)`
            : `Set off on a day trip around ${destination} (bookable via GetYourGuide)`,
        afternoon: fr ? "Suite de l'excursion, retour en fin de journée" : "Excursion continues, back by early evening",
        evening: nextFrom(style, "evenings"),
        timeline: fr
          ? [
              { time: "8h00", label: "Départ", detail: "Route vers le site, prévoir de l'eau et un en-cas" },
              { time: "10h00", label: "Visite principale", detail: topExcursion?.title ?? "Site principal de la journée" },
              { time: "13h00", label: "Déjeuner", detail: "Pause sur place ou pique-nique" },
              { time: "15h00", label: "Suite de l'excursion", detail: "Découverte des alentours à un rythme calme" },
              { time: "18h30", label: "Retour", detail: "Retour à l'hébergement, soirée libre" }
            ]
          : [
              { time: "8 am", label: "Departure", detail: "Drive to the site, bring water and a snack" },
              { time: "10 am", label: "Main visit", detail: topExcursion?.title ?? "Main site of the day" },
              { time: "1 pm", label: "Lunch", detail: "Break on site or picnic" },
              { time: "3 pm", label: "Excursion continues", detail: "Explore the surroundings at a calm pace" },
              { time: "6:30 pm", label: "Back", detail: "Return to the accommodation, free evening" }
            ],
        backup_option: fr ? "Excursion alternative plus courte si météo défavorable" : "Shorter alternative trip if weather turns"
      };
    }

    // Lighter day every 3rd-4th day: one major block only.
    const isLightDay = day % 4 === 0;
    if (isLightDay) {
      return {
        ...base,
        title: fr ? `Jour ${day} — Journée douce` : `Day ${day} — Slow day`,
        theme: fr ? "Repos et proximité" : "Rest and nearby",
        narrative: fr
          ? "Une journée sans route : on recharge les batteries et on explore uniquement ce qui se fait à pied."
          : "A day without driving: recharge and explore only what is walkable.",
        morning: fr ? "Grasse matinée et café en terrasse" : "Sleep in and terrace coffee",
        afternoon: nextFrom(style, "afternoons"),
        evening: nextFrom(style, "evenings"),
        free_visits: freeVisitsForDay(index, 2),
        paid_options: paidOptionsForDay(index).slice(0, 2),
        timeline: fr
          ? [
              { time: "10h00", label: "Réveil tardif", detail: "Petit-déjeuner sans contrainte d'horaire" },
              { time: "12h30", label: "Déjeuner", detail: "Table proche de l'hébergement" },
              { time: "15h00", label: "Visite libre à pied", detail: "Découverte du quartier sans voiture" },
              { time: "19h30", label: "Dîner", detail: "Soirée calme" }
            ]
          : [
              { time: "10 am", label: "Late start", detail: "Breakfast with no schedule" },
              { time: "12:30 pm", label: "Lunch", detail: "Table near the accommodation" },
              { time: "3 pm", label: "Free walk", detail: "Explore the neighbourhood car-free" },
              { time: "7:30 pm", label: "Dinner", detail: "Quiet evening" }
            ],
        backup_option: backups[index % backups.length]
      };
    }

    return {
      ...base,
      title: fr ? `Jour ${day} — ${themeLabel}` : `Day ${day} — ${themeLabel}`,
      theme: themeLabel,
      narrative: fr
        ? `Journée orientée ${themeLabel.toLowerCase()} : les visites gratuites du matin s'enchaînent à pied, l'après-midi laisse le choix entre plusieurs activités.`
        : `A ${themeLabel.toLowerCase()} day: the free morning visits chain together on foot, the afternoon offers a choice of activities.`,
      morning: nextFrom(style, "mornings"),
      afternoon: nextFrom(style, "afternoons"),
      evening: nextFrom(style, "evenings"),
      timeline: fr
        ? [
            { time: "9h00", label: "Visites gratuites", detail: "Enchaînement à pied des sites libres du jour" },
            { time: "12h30", label: "Déjeuner", detail: "Table présélectionnée du quartier" },
            { time: "14h30", label: "Activité au choix", detail: "Option A, B ou C selon l'envie et la météo" },
            { time: "18h00", label: "Fin d'après-midi libre", detail: "Point de vue ou baignade" },
            { time: "20h00", label: "Dîner", detail: "Table présélectionnée du soir" }
          ]
        : [
            { time: "9 am", label: "Free visits", detail: "Walk the day's free sites one after another" },
            { time: "12:30 pm", label: "Lunch", detail: "Preselected table in the area" },
            { time: "2:30 pm", label: "Activity of your choice", detail: "Option A, B or C depending on mood and weather" },
            { time: "6 pm", label: "Free late afternoon", detail: "Viewpoint or a swim" },
            { time: "8 pm", label: "Dinner", detail: "Preselected evening table" }
          ],
      backup_option: backups[index % backups.length]
    };
  });

  const styleNames = activeStyles.map((s) => styleLabel(s === "default" ? null : (s as TravelStyle), ctx.locale)).join(", ");

  return {
    output: {
      trip_summary: fr
        ? `Itinéraire ${days} jours à ${destination}, rythme ${input.brief.pace}, axé ${styleNames}.`
        : `${days}-day itinerary in ${destination}, ${input.brief.pace} pace, focused on ${styleNames}.`,
      itinerary_by_day: itinerary,
      suggested_excursions: excursions,
      experience_links: buildExperienceLinks(destination, ctx.locale),
      free_culture_highlights: [...new Set(itinerary.flatMap((day) => day.free_visits.map((visit) => visit.name)))].slice(0, 8),
      pacing_notes: fr
        ? ["Max 2 activités majeures par jour", "Une journée plus douce tous les 3-4 jours", "Chaque jour a une option de repli météo"]
        : ["Max 2 major activities per day", "A slower day every 3-4 days", "Every day has a weather backup option"],
      alternatives: activeStyles.length > 1
        ? [fr ? "Inverser les journées à thème selon la météo" : "Swap themed days based on weather"]
        : [fr ? "Ajouter une seconde excursion si l'énergie suit" : "Add a second excursion if energy allows"],
      verification_needed: fr
        ? [
            "Programme généré sans IA : les visites gratuites sont proposées par catégorie, à confirmer sur place",
            "Horaires d'ouverture des sites à vérifier",
            "Disponibilités des excursions à confirmer sur GetYourGuide ou Viator"
          ]
        : [
            "Program generated without AI: free visits are proposed by category, confirm them locally",
            "Opening hours should be verified",
            "Excursion availability should be confirmed on GetYourGuide or Viator"
          ]
    },
    meta: { toolStatuses: {} }
  };
}

function styleLabel(style: TravelStyle | null, locale: "fr" | "en"): string {
  const labels: Record<TravelStyle, { fr: string; en: string }> = {
    beach: { fr: "Plage & mer", en: "Beach & sea" },
    culture: { fr: "Culture & patrimoine", en: "Culture & heritage" },
    nature: { fr: "Nature & randonnée", en: "Nature & hiking" },
    food: { fr: "Gastronomie", en: "Food & dining" },
    nightlife: { fr: "Fête & vie nocturne", en: "Nightlife" },
    family: { fr: "Famille", en: "Family" },
    romantic: { fr: "Romantique", en: "Romantic" },
    adventure: { fr: "Aventure", en: "Adventure" }
  };
  if (!style) return locale === "fr" ? "Découverte" : "Discovery";
  return labels[style][locale];
}

export async function runPackingChecklist(
  input: { brief: StructuredTripBrief; destinationFallback?: string | null },
  ctx: HandlerContext
): Promise<SkillRunResult<PackingChecklist>> {
  const destination = input.brief.destination ?? input.destinationFallback ?? (ctx.locale === "fr" ? "destination" : "destination");

  return {
    output: {
      essentials: ctx.locale === "fr" ? ["Passeport", "Moyen de paiement", "Ordonnances"] : ["Passport", "Payment method", "Prescriptions"],
      clothing:
        ctx.locale === "fr"
          ? ["Tenues polyvalentes", "Chaussures confortables", "Veste légère"]
          : ["Versatile outfits", "Comfortable shoes", "Light jacket"],
      documents: ctx.locale === "fr" ? ["Billets", "Réservations", "Assurance"] : ["Tickets", "Bookings", "Insurance"],
      health_and_safety:
        ctx.locale === "fr"
          ? ["Trousse premiers secours", "Médicaments personnels"]
          : ["First-aid kit", "Personal medication"],
      electronics: ctx.locale === "fr" ? ["Chargeur", "Batterie externe", "Adaptateur"] : ["Chargers", "Power bank", "Adapter"],
      optional_items:
        ctx.locale === "fr"
          ? [`Guide local pour ${destination}`, "Masque de nuit"]
          : [`Local guide for ${destination}`, "Sleep mask"],
      final_reminders:
        ctx.locale === "fr"
          ? ["Vérifier météo 48h avant départ", "Scanner les documents importants"]
          : ["Check weather 48h before departure", "Scan important documents"]
    },
    meta: { toolStatuses: {} }
  };
}

export async function runTripSummaryExport(
  input: {
    brief: StructuredTripBrief;
    destination: DestinationMatcherOutput | null;
    budget: BudgetEstimate;
    research: FlightHotelResearch | null;
    entry: EntryRequirements | null;
    itinerary: ItineraryByDay;
    packing: PackingChecklist;
    openVerifications: string[];
  },
  ctx: HandlerContext
): Promise<SkillRunResult<TripSummaryExport>> {
  const selectedDestination = input.brief.destination ?? input.destination?.top_destinations[0]?.destination ?? null;
  const highlights = input.itinerary.itinerary_by_day.slice(0, 3).map((day) => day.title);

  const structuredJson = {
    brief: input.brief,
    destination_recommendations: input.destination?.top_destinations ?? [],
    budget_estimate: input.budget,
    research: input.research,
    entry_requirements: input.entry,
    itinerary: input.itinerary,
    packing_checklist: input.packing,
    open_verifications: input.openVerifications
  };

  return {
    output: {
      traveler_summary:
        ctx.locale === "fr"
          ? `Voyage prêt: ${selectedDestination ?? "destination à confirmer"}, budget estimé ${input.budget.estimated_total.min}-${input.budget.estimated_total.max} ${input.budget.estimated_total.currency}.`
          : `Trip draft ready: ${selectedDestination ?? "destination to confirm"}, estimated budget ${input.budget.estimated_total.min}-${input.budget.estimated_total.max} ${input.budget.estimated_total.currency}.`,
      final_trip_plan: {
        destination: selectedDestination,
        duration_days: input.brief.duration_days,
        budget: {
          min: input.budget.estimated_total.min,
          max: input.budget.estimated_total.max,
          currency: input.budget.estimated_total.currency
        },
        itinerary_highlights: highlights
      },
      structured_json: structuredJson,
      open_verifications: input.openVerifications,
      next_steps:
        ctx.locale === "fr"
          ? [
              "Valider la destination finale",
              "Réserver vols et hébergements via les liens Skyscanner / Booking proposés",
              "Réserver excursions et restaurants via les liens GetYourGuide / TheFork",
              "Re-vérifier formalités"
            ]
          : [
              "Confirm final destination",
              "Book flights and stays via the provided Skyscanner / Booking links",
              "Book tours and restaurants via the GetYourGuide / TheFork links",
              "Re-check entry requirements"
            ]
    },
    meta: { toolStatuses: {} }
  };
}

// The capture runs over letters and spaces, so "en Crète en famille en
// septembre" used to yield the whole tail as the destination — and that string
// then seeded every photo query and booking link. It is cut at the first word
// that starts a new clause: a connector, a month or a party description.
const DESTINATION_END =
  /\s+(?:en|pour|avec|sur|pendant|durant|for|with|during|from|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|january|february|march|april|may|june|july|august|september|october|november|december|famille|family|couple|amis|friends|enfants|kids|budget|jours?|days?|semaines?|weeks?|nuits?|nights?)\b.*$/iu;

export function extractDestination(message: string): string | null {
  const patterns = [
    /(?:destination|direction)\s*:?\s+([A-ZÀ-ÖØ-Ý][\p{L}\-\s]{2,})/iu,
    /(?:à|to)\s+([A-ZÀ-ÖØ-Ý][\p{L}\-\s]{2,})/u,
    /(?:in|au|en)\s+([A-ZÀ-ÖØ-Ý][\p{L}\-\s]{2,})/u
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const destination = match[1].replace(DESTINATION_END, "").trim().replace(/[,.!?]$/, "");
      if (destination.length >= 3) return destination;
    }
  }

  return null;
}

function extractDateWindow(message: string): string | null {
  const normalized = message.toLowerCase();
  const month = monthWords.find((m) => normalized.includes(m));
  return month ?? null;
}

// Turns "septembre" + 6 days into concrete dates (5th of the next occurrence of
// that month) so live price searches and booking links target a real window.
export function deriveExactDates(
  dateWindow: string | null,
  durationDays: number | null
): { start: string | null; end: string | null; estimated?: boolean } {
  if (!dateWindow) return { start: null, end: null };

  const monthIndex = MONTH_INDEX[dateWindow] ?? -1;
  if (monthIndex < 0) return { start: null, end: null };

  const now = new Date();
  let year = now.getFullYear();
  if (monthIndex < now.getMonth() || (monthIndex === now.getMonth() && now.getDate() > 5)) {
    year += 1;
  }

  const start = new Date(Date.UTC(year, monthIndex, 5));
  const end = new Date(start.getTime() + (durationDays ?? 7) * 86400000);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    estimated: true
  };
}

// Candidate destinations per travel style; scores follow destination_scoring.md
// (interest alignment + budget realism weigh more than novelty).
const DESTINATION_POOLS: Record<TravelStyle | "default", Array<{ destination: string; score: number; whyFr: string; whyEn: string; tradeoffFr: string; tradeoffEn: string; budget_fit: string }>> = {
  beach: [
    { destination: "Crète", score: 0.84, whyFr: "Mer limpide, villages et tavernes", whyEn: "Clear sea, villages and tavernas", tradeoffFr: "Vols chers en haute saison", tradeoffEn: "Pricey flights in peak season", budget_fit: "good" },
    { destination: "Algarve", score: 0.8, whyFr: "Côte spectaculaire, accès facile", whyEn: "Stunning coast, easy access", tradeoffFr: "Très fréquenté en été", tradeoffEn: "Crowded in summer", budget_fit: "good" },
    { destination: "Sardaigne", score: 0.74, whyFr: "Plages sauvages et authenticité", whyEn: "Wild beaches and authenticity", tradeoffFr: "Voiture quasi indispensable", tradeoffEn: "A car is almost required", budget_fit: "estimated-fit" }
  ],
  culture: [
    { destination: "Rome", score: 0.85, whyFr: "Densité patrimoniale inégalée", whyEn: "Unmatched heritage density", tradeoffFr: "Foule aux sites majeurs", tradeoffEn: "Crowds at major sites", budget_fit: "estimated-fit" },
    { destination: "Séville", score: 0.79, whyFr: "Andalousie, palais et flamenco", whyEn: "Andalusia, palaces and flamenco", tradeoffFr: "Très chaud en été", tradeoffEn: "Very hot in summer", budget_fit: "good" },
    { destination: "Athènes", score: 0.75, whyFr: "Antiquité + scène créative", whyEn: "Antiquity + creative scene", tradeoffFr: "Circulation dense", tradeoffEn: "Heavy traffic", budget_fit: "good" }
  ],
  nature: [
    { destination: "Madère", score: 0.83, whyFr: "Levadas, falaises et forêts", whyEn: "Levadas, cliffs and forests", tradeoffFr: "Relief exigeant", tradeoffEn: "Demanding terrain", budget_fit: "good" },
    { destination: "Slovénie", score: 0.78, whyFr: "Lacs alpins et gorges accessibles", whyEn: "Alpine lakes and accessible gorges", tradeoffFr: "Météo changeante en montagne", tradeoffEn: "Changeable mountain weather", budget_fit: "good" },
    { destination: "Açores", score: 0.74, whyFr: "Volcans, baleines, nature brute", whyEn: "Volcanoes, whales, raw nature", tradeoffFr: "Vols moins fréquents", tradeoffEn: "Fewer flight options", budget_fit: "estimated-fit" }
  ],
  food: [
    { destination: "Bologne", score: 0.84, whyFr: "Capitale gastronomique italienne", whyEn: "Italy's food capital", tradeoffFr: "Moins de « sites » célèbres", tradeoffEn: "Fewer famous landmarks", budget_fit: "good" },
    { destination: "San Sebastián", score: 0.8, whyFr: "Pintxos et tables étoilées", whyEn: "Pintxos and starred tables", tradeoffFr: "Addition qui grimpe vite", tradeoffEn: "Bills add up fast", budget_fit: "estimated-fit" },
    { destination: "Lyon", score: 0.76, whyFr: "Bouchons et marchés, sans avion", whyEn: "Bouchons and markets, no flight needed", tradeoffFr: "Moins dépaysant", tradeoffEn: "Less exotic", budget_fit: "good" }
  ],
  nightlife: [
    { destination: "Barcelone", score: 0.82, whyFr: "Scène nocturne + plage en ville", whyEn: "Nightlife + urban beach", tradeoffFr: "Très touristique", tradeoffEn: "Very touristy", budget_fit: "estimated-fit" },
    { destination: "Berlin", score: 0.79, whyFr: "Clubs légendaires, quartiers créatifs", whyEn: "Legendary clubs, creative districts", tradeoffFr: "Sélection à l'entrée des clubs", tradeoffEn: "Club door policies", budget_fit: "good" },
    { destination: "Lisbonne", score: 0.74, whyFr: "Bairro Alto et rooftops", whyEn: "Bairro Alto and rooftops", tradeoffFr: "Rues pentues", tradeoffEn: "Steep streets", budget_fit: "good" }
  ],
  family: [
    { destination: "Valence", score: 0.82, whyFr: "Cité des sciences, plages, parcs", whyEn: "Science city, beaches, parks", tradeoffFr: "Chaleur en plein été", tradeoffEn: "Midsummer heat", budget_fit: "good" },
    { destination: "Copenhague", score: 0.76, whyFr: "Tivoli et ville très sûre", whyEn: "Tivoli and a very safe city", tradeoffFr: "Budget élevé", tradeoffEn: "Expensive", budget_fit: "tight" },
    { destination: "Algarve", score: 0.74, whyFr: "Plages calmes et clubs enfants", whyEn: "Calm beaches and kids clubs", tradeoffFr: "Location de voiture conseillée", tradeoffEn: "Car rental advised", budget_fit: "good" }
  ],
  romantic: [
    { destination: "Venise", score: 0.83, whyFr: "Canaux et lumière unique", whyEn: "Canals and unique light", tradeoffFr: "Foule et prix au centre", tradeoffEn: "Crowds and central prices", budget_fit: "tight" },
    { destination: "Santorin", score: 0.79, whyFr: "Couchers de soleil célèbres", whyEn: "Famous sunsets", tradeoffFr: "Très demandé l'été", tradeoffEn: "In high demand in summer", budget_fit: "tight" },
    { destination: "Bruges", score: 0.74, whyFr: "Escapade cosy, accessible en train", whyEn: "Cosy getaway, reachable by train", tradeoffFr: "Petite ville vite parcourue", tradeoffEn: "Small city, quickly covered", budget_fit: "good" }
  ],
  adventure: [
    { destination: "Interlaken", score: 0.82, whyFr: "Capitale européenne des sensations", whyEn: "Europe's adrenaline capital", tradeoffFr: "Budget suisse", tradeoffEn: "Swiss prices", budget_fit: "tight" },
    { destination: "Ténérife", score: 0.78, whyFr: "Volcan, canyons et surf", whyEn: "Volcano, canyons and surf", tradeoffFr: "Zones touristiques à éviter", tradeoffEn: "Touristy areas to avoid", budget_fit: "good" },
    { destination: "Monténégro", score: 0.74, whyFr: "Rafting et montagnes préservées", whyEn: "Rafting and unspoiled mountains", tradeoffFr: "Infrastructures variables", tradeoffEn: "Variable infrastructure", budget_fit: "good" }
  ],
  default: [
    { destination: "Lisbonne", score: 0.76, whyFr: "Ville complète toute l'année", whyEn: "Well-rounded city all year", tradeoffFr: "Rues pentues", tradeoffEn: "Hilly walks", budget_fit: "good" },
    { destination: "Valence", score: 0.73, whyFr: "Excellent rapport qualité/prix", whyEn: "Great value for money", tradeoffFr: "Chaleur estivale", tradeoffEn: "Hot summers", budget_fit: "good" },
    { destination: "Porto", score: 0.71, whyFr: "Parfait pour un court séjour", whyEn: "Great for short stays", tradeoffFr: "Météo changeante", tradeoffEn: "Variable weather", budget_fit: "estimated-fit" }
  ]
};

function suggestDestinations(
  brief: StructuredTripBrief,
  locale: "fr" | "en"
): DestinationMatcherOutput["top_destinations"] {
  const styles = (brief.traveler_types as TravelStyle[]).filter((s) => s in DESTINATION_POOLS);
  const pools: (TravelStyle | "default")[] = styles.length ? styles : ["default"];
  const lowCrowds = brief.must_avoid.some((v) => v.toLowerCase().includes("tour") || v.toLowerCase().includes("crowd"));

  const seen = new Set<string>();
  const candidates: DestinationMatcherOutput["top_destinations"] = [];

  // Interleave pools so a multi-style traveler gets one pick per style first.
  for (let rank = 0; rank < 3; rank += 1) {
    for (const pool of pools) {
      const entry = DESTINATION_POOLS[pool][rank];
      if (!entry || seen.has(entry.destination)) continue;
      seen.add(entry.destination);
      const crowdPenalty = lowCrowds && (entry.tradeoffFr.includes("Foule") || entry.tradeoffFr.includes("touristique")) ? 0.06 : 0;
      candidates.push({
        destination: entry.destination,
        score: Math.max(0, Math.min(1, entry.score - crowdPenalty)),
        why: locale === "fr" ? entry.whyFr : entry.whyEn,
        tradeoffs: [locale === "fr" ? entry.tradeoffFr : entry.tradeoffEn],
        budget_fit: entry.budget_fit
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function containsOne(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}
