import {
  DayRouteSchema,
  ItineraryDaysBatchSchema,
  ItineraryOutlineSchema,
  LodgingSchema,
  type ForumFinding,
  type Lodging,
  type Photo,
  type StayOption,
  type ItineraryByDay,
  type ItineraryDay,
  type ItineraryOutline,
  type StructuredTripBrief
} from "@mlt/contracts";
import type { SkillExecutor } from "./executor";
import type { HandlerContext } from "./handlers";
import { buildLodgingLinks } from "../tools/links";
import type { SkillRunResult } from "./types";
import type { GygOffer, PlaceResult } from "../tools/serpapi";
import type { ActivityCategory, PaidOption } from "@mlt/contracts";

// Restaurants are looked up once per area of the outline; a trip rarely has
// more than a handful, and each lookup is a search credit.
const MAX_RESTAURANT_AREAS = 8;
const MAX_FORUM_FINDINGS_IN_PROMPT = 8;
// Every day offers exactly this many paid alternatives and this many tables.
export const OPTIONS_PER_DAY = 3;
export const RESTAURANTS_PER_DAY = 3;
// Share of the trip budget that pays for activities, per person and per day,
// once flights and lodging (35 % each) are set aside.
const ACTIVITY_BUDGET_SHARE = 0.2;

// A rich day (timeline, free visits, options, tables) costs roughly 800-1000
// output tokens. Two days per call keeps every response far below the model's
// output ceiling, which is what previously truncated whole itineraries.
// One day per call, not two.
//
// A full day is a big JSON object: a narrative, a timeline, 3 to 5 free
// visits, 3 paid options each carrying its cheaper local alternative, 3
// restaurants, the route and the hotel of the night. Two of them together run
// against the 8k output ceiling, and a truncated answer is the one failure a
// retry cannot fix — the same prompt truncates again at the same place. So the
// answer is made small enough that it always fits.
const DAYS_PER_BATCH = 1;
// More calls, so more of them run at once to keep the wait the same. Eight
// lets a one-week trip — the common case — go out in a single wave: with five,
// a 7-day program waited for two full rounds of the model.
const MAX_PARALLEL_BATCHES = 8;

// Beyond three weeks the outline itself no longer fits in one answer, so it is
// requested slice by slice.
// The outline of a whole trip does not fit in one answer: 21 days of names ran
// past the 8k output ceiling, the JSON came back cut in half, and the traveler
// got the local generator for the entire guide. Slicing keeps every call well
// inside the budget, and a slice that fails costs a few days, not the trip.
const OUTLINE_CHUNK_DAYS = 7;

export interface PlanItineraryInput {
  brief: StructuredTripBrief;
  destination: string | null;
  locale: "fr" | "en";
  /** Budget minus the real flights and stay, when they were priced. */
  remainingBudgetEur?: number | null;
  liveCosts?: { flights: number | null; lodging: number | null } | null;
}

/**
 * The program could not be written by the AI.
 *
 * The traveler is told, and gets nothing rather than a guide made of template
 * sentences: `message` is what the app shows them.
 */
export class ItineraryUnavailableError extends Error {
  constructor(
    readonly cause_: "no_llm" | "no_destination" | "outline" | "days",
    locale: "fr" | "en",
    readonly days: number[] = []
  ) {
    super(ITINERARY_ERRORS[locale][cause_](days));
    this.name = "ItineraryUnavailableError";
  }
}

const ITINERARY_ERRORS: Record<"fr" | "en", Record<"no_llm" | "no_destination" | "outline" | "days", (days: number[]) => string>> = {
  fr: {
    no_llm: () => "L'IA n'est pas configurée : impossible d'écrire le programme. Aucun guide générique n'est produit.",
    no_destination: () => "Aucune destination n'a pu être retenue : précisez-la et relancez.",
    outline: () => "L'IA n'a pas réussi à composer le déroulé du voyage. Relancez la génération dans un instant.",
    days: (days) => `L'IA n'a pas écrit ${days.length === 1 ? `la journée ${days[0]}` : `les journées ${days.join(", ")}`}. Relancez la génération plutôt que de partir avec un programme incomplet.`
  },
  en: {
    no_llm: () => "The AI is not configured: the program cannot be written. No generic guide is produced.",
    no_destination: () => "No destination could be settled on: name it and run again.",
    outline: () => "The AI could not lay out the trip. Run the generation again in a moment.",
    days: (days) => `The AI did not write ${days.length === 1 ? `day ${days[0]}` : `days ${days.join(", ")}`}. Run the generation again rather than travelling with an incomplete program.`
  }
};

/**
 * Builds the day-by-day program in two phases.
 *
 * Phase 1 produces an outline that assigns each day its theme, its area and
 * the exact names it may use — this is what makes every day different and
 * prevents a visit, a table or an activity from appearing twice in the trip.
 * Phase 2 expands those names into full days, in small parallel batches.
 *
 * There is no local fallback: a day the model did not write is asked for
 * again, and if it still does not come the plan fails loudly. A guide made of
 * template sentences — "Croisière autour de <destination>" — is worse than no
 * guide, because it looks finished.
 */
export async function planItinerary(
  executor: SkillExecutor,
  input: PlanItineraryInput,
  ctx: HandlerContext
): Promise<SkillRunResult<ItineraryByDay> & { source: "llm" }> {
  if (!executor.hasLlm) throw new ItineraryUnavailableError("no_llm", input.locale);
  if (!input.destination) throw new ItineraryUnavailableError("no_destination", input.locale);

  const outlineStartedAt = Date.now();
  const outline = await buildOutline(executor, input);
  if (!outline?.days?.length) throw new ItineraryUnavailableError("outline", input.locale);
  console.info(`[itinerary] outline: ${((Date.now() - outlineStartedAt) / 1000).toFixed(1)}s`);

  // Real data before the days are written: rated restaurants for every area
  // of the outline, and what travelers wrote on the forums. Left to itself the
  // model names a "Taverna <village>" per day and quotes forums from memory.
  // Both lookups are tools and may fail; the model's own names then stay,
  // flagged unverified.
  const lookupsStartedAt = Date.now();
  const [forum, restaurants, gyg] = await Promise.all([
    ctx.tools.search_forum_tips({ destination: input.destination, locale: input.locale }),
    fetchRestaurantsByArea(ctx, outline, input.destination, input.locale),
    ctx.tools.search_getyourguide({ destination: input.destination, locale: input.locale })
  ]);
  console.info(`[itinerary] forum + restaurants + activities lookups: ${((Date.now() - lookupsStartedAt) / 1000).toFixed(1)}s`);

  const findings = ((forum.data as any)?.findings ?? []) as ForumFinding[];
  const offers = ((gyg.data as any)?.offers ?? []) as GygOffer[];
  const placesByName = assignRestaurants(outline, restaurants.byArea, input.brief, input.remainingBudgetEur);
  const activityBudget = activityBudgetPerPerson(input.brief, input.remainingBudgetEur);
  const real = { findings, placesByName, activityBudget };

  const daysStartedAt = Date.now();
  let days = await expandDays(executor, outline, input, real);
  console.info(`[itinerary] ${days.length}/${outline.days.length} days written: ${((Date.now() - daysStartedAt) / 1000).toFixed(1)}s`);

  // A batch can fail for reasons that pass — a rate limit, an answer cut at
  // the token ceiling. The days it owed are asked for again, alone, before
  // anyone gives up on them.
  let missing = outline.days.filter((day) => !days.some((expanded) => expanded.day === day.day));
  if (missing.length) {
    console.warn(`[itinerary] ${missing.length}/${outline.days.length} days missing, asking again`);
    const retried = await expandDays(executor, { ...outline, days: missing }, input, real);
    days = [...days, ...retried].sort((left, right) => left.day - right.day);
    missing = outline.days.filter((day) => !days.some((expanded) => expanded.day === day.day));
  }

  if (missing.length) {
    throw new ItineraryUnavailableError("days", input.locale, missing.map((day) => day.day));
  }

  normalizeStages(days, outline, input.destination, input.locale);
  enforceUniqueness(days);
  attachRestaurantData(days, placesByName);
  ensureThreeOptions(days, outline, input.locale);
  balanceOptionCategories(days, outline, input.brief);
  attachActivityOffers(days, offers, activityBudget, input.locale);

  return {
    output: {
      trip_summary: outline.trip_summary,
      car_needed: outline.car_needed,
      car_rationale: outline.car_rationale,
      itinerary_by_day: days,
      suggested_excursions: outline.suggested_excursions,
      experience_links: [],
      free_culture_highlights: outline.free_culture_highlights,
      pacing_notes: outline.pacing_notes,
      alternatives: outline.alternatives,
      verification_needed: outline.verification_needed,
      forum_findings: findings
    },
    meta: { toolStatuses: { search_forum_tips: forum.status, search_restaurants: restaurants.status, search_getyourguide: gyg.status } },
    source: "llm"
  };
}

// ---------------------------------------------------------------------------
// Real restaurants
// ---------------------------------------------------------------------------

function nameKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Where to look for a day's restaurants, best guess first: the town the
 * outline named for meals, then the area itself, then — for a composite area
 * like "Gorges de Samaria et Omalos" — its last part, which is usually the
 * village where one actually eats.
 */
export function mealSearchTerms(day: { area?: string | null; meal_town?: string | null }): string[] {
  const terms: string[] = [];
  const push = (value: string | null | undefined) => {
    const clean = (value ?? "").trim();
    if (clean && !terms.some((term) => nameKey(term) === nameKey(clean))) terms.push(clean);
  };
  push(day.meal_town);
  push(day.area);
  const parts = (day.area ?? "").split(/\s+(?:et|and|&|\/|,)\s+|\s*[\/,]\s*/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) push(parts[parts.length - 1]);
  return terms;
}

/** The key a day's restaurant pool is filed under. */
function mealKey(day: { area?: string | null; meal_town?: string | null }): string {
  return nameKey(mealSearchTerms(day)[0] ?? day.area ?? "");
}

/**
 * One Google Maps lookup per distinct meal town of the outline, in parallel.
 * A town that yields nothing is retried once with the next search term, so a
 * composite area still finds the village's tables.
 */
async function fetchRestaurantsByArea(
  ctx: HandlerContext,
  outline: ItineraryOutline,
  destination: string,
  locale: "fr" | "en"
): Promise<{ byArea: Map<string, PlaceResult[]>; status: "ok" | "degraded" | "error" }> {
  const areas = new Map<string, string[]>();
  for (const day of outline.days) {
    const key = mealKey(day);
    if (key && !areas.has(key) && areas.size < MAX_RESTAURANT_AREAS) areas.set(key, mealSearchTerms(day));
  }

  const results = await Promise.all(
    [...areas.entries()].map(async ([key, terms]) => {
      let status: "ok" | "degraded" | "error" = "error";
      for (const term of terms.slice(0, 2)) {
        const result = await ctx.tools.search_restaurants({ area: term, destination, locale });
        status = result.status;
        const places = ((result.data as any)?.places ?? []) as PlaceResult[];
        if (places.length) return { key, status, places };
      }
      return { key, status, places: [] as PlaceResult[] };
    })
  );

  const byArea = new Map<string, PlaceResult[]>();
  for (const entry of results) byArea.set(entry.key, entry.places);
  const statuses = results.map((entry) => entry.status);
  const status = !statuses.length || statuses.every((s) => s === "error")
    ? "error"
    : statuses.every((s) => s === "ok")
      ? "ok"
      : "degraded";
  return { byArea, status };
}

/**
 * Price tiers the traveler's budget can absorb for a meal out, from the daily
 * amount per person once the trip budget is spread over the stay.
 */
export function allowedPriceTiers(brief: StructuredTripBrief, remainingBudgetEur: number | null = null): Set<string> {
  const days = Math.max(1, brief.duration_days ?? 7);
  const people = Math.max(1, brief.travelers_count);
  // Once flights and stay are paid, meals take about 45 % of what is left;
  // without live prices the old share of the whole budget is used.
  const perDay =
    remainingBudgetEur != null
      ? (Math.max(0, remainingBudgetEur) * MEALS_SHARE_OF_REMAINING) / people / days
      : brief.budget_total && brief.duration_days
        ? (brief.budget_total * 0.3) / people / days
        : null;
  if (perDay === null) return new Set(["€", "€€", "€€€"]);
  if (perDay < 18) return new Set(["€"]);
  if (perDay < 40) return new Set(["€", "€€"]);
  if (perDay < 80) return new Set(["€", "€€", "€€€"]);
  return new Set(["€", "€€", "€€€", "€€€€"]);
}

const MEALS_SHARE_OF_REMAINING = 0.45;
const ACTIVITIES_SHARE_OF_REMAINING = 0.35;

/**
 * Replaces the outline's restaurant names with real, rated places of each
 * day's area — never the same table twice, within the budget's price tiers.
 * A day whose area found too few places keeps the model's names.
 *
 * Returns the places by name so the expanded days can be enriched with the
 * rating, address and links.
 */
export function assignRestaurants(
  outline: ItineraryOutline,
  byArea: Map<string, PlaceResult[]>,
  brief: StructuredTripBrief,
  remainingBudgetEur: number | null = null
): Map<string, PlaceResult> {
  const allowed = allowedPriceTiers(brief, remainingBudgetEur);
  const used = new Set<string>();
  const placesByName = new Map<string, PlaceResult>();

  for (const day of outline.days) {
    const key = mealKey(day);
    // "Héraklion et environs" should still find "Héraklion".
    const candidates =
      byArea.get(key) ??
      [...byArea.entries()].find(([areaKey]) => {
        const head = areaKey.split(" ")[0];
        return head.length >= 4 && key.split(" ").includes(head);
      })?.[1] ??
      [];

    const pool = candidates.filter((place) => !used.has(nameKey(place.name)) && (!place.price || allowed.has(place.price)));
    // One verified table beats three invented ones; the model completes the day.
    if (!pool.length) continue;

    const picks = pool.slice(0, Math.min(RESTAURANTS_PER_DAY, pool.length));
    day.restaurant_names = picks.map((place) => place.name);
    for (const place of picks) {
      used.add(nameKey(place.name));
      placesByName.set(nameKey(place.name), place);
    }
  }

  return placesByName;
}

/** Writes the Google Maps facts onto the tables the model described. */
export function attachRestaurantData(days: ItineraryDay[], placesByName: Map<string, PlaceResult>): void {
  for (const day of days) {
    for (const restaurant of day.restaurants ?? []) {
      const place = placesByName.get(nameKey(restaurant.name));
      if (!place) {
        restaurant.verified = false;
        continue;
      }
      restaurant.verified = true;
      restaurant.name = place.name;
      restaurant.rating = place.rating;
      restaurant.reviews_count = place.reviews_count;
      restaurant.address = place.address;
      restaurant.phone = place.phone;
      restaurant.website = place.website;
      restaurant.maps_url = place.maps_url;
      restaurant.coordinates = place.coordinates ?? restaurant.coordinates ?? null;
      if (place.price) restaurant.price_range = place.price;
      if (!restaurant.cuisine && place.cuisine) restaurant.cuisine = place.cuisine;
      // The place's own Google Maps photo beats a generic plate.
      if (place.thumbnail) {
        restaurant.photo = {
          query: place.name,
          url: place.thumbnail,
          thumb_url: place.thumbnail,
          credit: "Google Maps",
          source_url: place.maps_url,
          license: null
        };
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Activities: three options a day, priced and linked
// ---------------------------------------------------------------------------

/** What one person can spend on activities in a day, or null without a budget. */
export function activityBudgetPerPerson(brief: StructuredTripBrief, remainingBudgetEur: number | null = null): number | null {
  const days = Math.max(1, brief.duration_days ?? 7);
  const people = Math.max(1, brief.travelers_count);
  if (remainingBudgetEur != null) {
    return Math.round((Math.max(0, remainingBudgetEur) * ACTIVITIES_SHARE_OF_REMAINING) / people / days);
  }
  if (!brief.budget_total || !brief.duration_days) return null;
  return Math.round((brief.budget_total * ACTIVITY_BUDGET_SHARE) / people / days);
}

const OPTION_LABELS = ["Option A", "Option B", "Option C"];

/**
 * Every day gets exactly three alternatives. A day the model left short is
 * completed with the trip's headline excursions that no day offers yet — they
 * are real, priced and already photo-queried; a day with more is trimmed to
 * its first three.
 */
export function ensureThreeOptions(days: ItineraryDay[], outline: ItineraryOutline, locale: "fr" | "en"): void {
  const used = new Set(days.flatMap((day) => (day.paid_options ?? []).map((option) => nameKey(option.title))));
  const spare = (outline.suggested_excursions ?? []).filter((excursion) => !used.has(nameKey(excursion.title)));

  for (const day of days) {
    const options = (day.paid_options ?? []).slice(0, OPTIONS_PER_DAY);
    while (options.length < OPTIONS_PER_DAY && spare.length) {
      const excursion = spare.shift()!;
      used.add(nameKey(excursion.title));
      options.push({
        option_label: "",
        title: excursion.title,
        description: excursion.description,
        duration: excursion.duration,
        price_from_eur: excursion.price_estimate_eur,
        price_note: excursion.price_estimate_eur != null ? `${excursion.price_estimate_eur} € ${locale === "fr" ? "par personne (indicatif)" : "per person (indicative)"}` : null,
        suited_for: excursion.style ? [excursion.style] : [],
        intensity: "moderate",
        kind: "experience",
        category: categoryOf(`${excursion.title} ${excursion.style ?? ""} ${excursion.description}`),
        budget_fit: "unknown",
        price_source: "estimate",
        gyg_url: null,
        local_alternative: null,
        booking_links: [],
        photo: excursion.photo ?? { query: excursion.title, url: null, thumb_url: null, credit: null, source_url: null, license: null }
      });
    }
    options.forEach((option, index) => (option.option_label = OPTION_LABELS[index] ?? option.option_label));
    day.paid_options = options;
  }
}

const OPTION_STOPWORDS = new Set(["visite", "guidee", "guide", "excursion", "journee", "demi", "tour", "billet", "entree", "croisiere", "bateau", "boat", "trip", "ticket", "depuis", "from", "avec", "with", "dans", "pour", "les", "des", "the", "and", "vers"]);

function offerTokens(value: string): string[] {
  return nameKey(value).split(" ").filter((token) => token.length >= 4 && !OPTION_STOPWORDS.has(token));
}

/** The GetYourGuide offer that is about the same thing as the option, if any. */
export function matchOffer(title: string, offers: GygOffer[]): GygOffer | null {
  const wanted = offerTokens(title);
  if (!wanted.length) return null;
  let best: { offer: GygOffer; score: number } | null = null;
  for (const offer of offers) {
    const have = new Set(offerTokens(offer.title));
    const shared = wanted.filter((token) => have.has(token) || [...have].some((other) => other.startsWith(token.slice(0, 6)) && token.length >= 6));
    // One long, distinctive word ("knossos", "spinalonga") is enough; short
    // ones need company.
    const score = shared.reduce((sum, token) => sum + (token.length >= 6 ? 2 : 1), 0);
    if (score >= 2 && (!best || score > best.score)) best = { offer, score };
  }
  return best?.offer ?? null;
}

/**
 * Gives every option its GetYourGuide link and price when a real offer
 * matches, and says where the price comes from; then judges each against the
 * traveler's activity budget.
 */
export function attachActivityOffers(
  days: ItineraryDay[],
  offers: GygOffer[],
  budgetPerPerson: number | null,
  locale: "fr" | "en"
): void {
  for (const day of days) {
    for (const option of day.paid_options ?? []) {
      const offer = matchOffer(option.title, offers);
      if (offer) {
        option.gyg_url = offer.url;
        if (offer.price_from_eur != null) {
          option.price_from_eur = offer.price_from_eur;
          option.price_note = locale === "fr" ? `dès ${offer.price_from_eur} € par personne sur GetYourGuide` : `from ${offer.price_from_eur} € per person on GetYourGuide`;
          option.price_source = "getyourguide";
        }
      }
      if (option.price_source !== "getyourguide" && option.price_from_eur != null && option.price_note && !/indicatif|indicative|estim/i.test(option.price_note)) {
        option.price_note = `${option.price_note} (${locale === "fr" ? "tarif indicatif" : "indicative price"})`;
      }
      option.budget_fit = budgetFitFor(option.price_from_eur, budgetPerPerson);
    }
  }
}

function budgetFitFor(price: number | null | undefined, envelope: number | null): PaidOption["budget_fit"] {
  if (price == null || envelope == null) return "unknown";
  return price <= envelope ? "within_budget" : "over_budget";
}

/**
 * Drops anything the model repeated across days.
 *
 * "Never the same visit twice" is the promise the guide is built on, and the
 * prompt asks for it, but a model will still slip a market in on day 1 and
 * again on day 5. Removing the later occurrence makes the promise structural.
 */
export function enforceUniqueness(days: ItineraryDay[]): void {
  const seenVisits = new Set<string>();
  const seenOptions = new Set<string>();
  const seenTables = new Set<string>();

  const key = (value: string) =>
    value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

  const keepFirst = <T>(items: T[], seen: Set<string>, name: (item: T) => string): T[] =>
    items.filter((item) => {
      const id = key(name(item));
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

  for (const day of days) {
    day.free_visits = keepFirst(day.free_visits ?? [], seenVisits, (visit) => visit.name);
    day.paid_options = keepFirst(day.paid_options ?? [], seenOptions, (option) => option.title);
    day.restaurants = keepFirst(day.restaurants ?? [], seenTables, (restaurant) => restaurant.name);
  }
}

/**
 * Produces the trip outline, in slices when the trip is long.
 *
 * A three-week outline still fits in one answer; a two-month one does not, and
 * a truncated outline loses the end of the trip entirely. Each slice therefore
 * receives the names the earlier slices already claimed, so uniqueness holds
 * across the whole journey.
 */
async function buildOutline(executor: SkillExecutor, input: PlanItineraryInput): Promise<ItineraryOutline | null> {
  const totalDays = input.brief.duration_days ?? 7;

  if (totalDays <= OUTLINE_CHUNK_DAYS) {
    const outline = await withOneRetry(() => executor.runLlmOnly(
      "itinerary-builder",
      ItineraryOutlineSchema,
      { task: "outline", brief: input.brief, destination: input.destination, total_days: totalDays, activity_mix: activityMix(input.brief), remaining_budget_eur: input.remainingBudgetEur ?? null, live_costs: input.liveCosts ?? null },
      input.locale
    ));
    if (outline) normalizeDayCount(outline, totalDays);
    return outline;
  }

  let merged: ItineraryOutline | null = null;
  const usedNames: string[] = [];

  for (let from = 1; from <= totalDays; from += OUTLINE_CHUNK_DAYS) {
    const to = Math.min(from + OUTLINE_CHUNK_DAYS - 1, totalDays);

    const slice = await withOneRetry(() => executor.runLlmOnly(
      "itinerary-builder",
      ItineraryOutlineSchema,
      {
        task: "outline",
        brief: input.brief,
        destination: input.destination,
        days_from: from,
        days_to: to,
        total_days: totalDays,
        already_used_names: usedNames,
        activity_mix: activityMix(input.brief),
        remaining_budget_eur: input.remainingBudgetEur ?? null,
        live_costs: input.liveCosts ?? null
      },
      input.locale
    ));

    const days = (slice?.days ?? []).filter((day) => day.day >= from && day.day <= to);
    // One dead slice must not truncate the trip: the days it owed are filled
    // by the local generator later, and the following slices still run.
    if (!days.length) {
      console.warn(`[itinerary] outline slice ${from}-${to} came back empty`);
      continue;
    }

    usedNames.push(
      ...days.flatMap((day) => [...day.free_visit_names, ...day.paid_option_titles, ...day.restaurant_names])
    );

    if (!merged) {
      merged = { ...slice!, days };
      continue;
    }

    merged.days.push(...days);
    merged.suggested_excursions = dedupeByTitle([
      ...merged.suggested_excursions,
      ...(slice?.suggested_excursions ?? [])
    ]);
    merged.free_culture_highlights = [
      ...new Set([...merged.free_culture_highlights, ...(slice?.free_culture_highlights ?? [])])
    ];
  }

  if (merged) {
    merged.days = merged.days.sort((left, right) => left.day - right.day);
    normalizeDayCount(merged, totalDays);
  }

  return merged;
}

/**
 * Makes the outline hold exactly the number of days the traveler asked for.
 *
 * Models drift — a 7-day request comes back with 8 days. The extra days are
 * dropped from the middle, never from the end, so the trip keeps its departure
 * day, and the remaining days are renumbered before they are expanded.
 */
export function normalizeDayCount(outline: ItineraryOutline, totalDays: number): void {
  if (outline.days.length <= totalDays) return;

  console.warn(`[itinerary] outline returned ${outline.days.length} days for a ${totalDays}-day trip, trimming`);

  const kept = [...outline.days.slice(0, totalDays - 1), outline.days[outline.days.length - 1]];
  outline.days = kept.map((day, index) => ({ ...day, day: index + 1 }));
}

function dedupeByTitle(items: ItineraryOutline["suggested_excursions"]): ItineraryOutline["suggested_excursions"] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = (item.title ?? "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

interface RealData {
  findings: ForumFinding[];
  placesByName: Map<string, PlaceResult>;
  activityBudget?: number | null;
}

async function expandDays(
  executor: SkillExecutor,
  outline: ItineraryOutline,
  input: PlanItineraryInput,
  real: RealData = { findings: [], placesByName: new Map(), activityBudget: null }
): Promise<ItineraryDay[]> {
  const forumFindings = real.findings.slice(0, MAX_FORUM_FINDINGS_IN_PROMPT).map((finding) => ({
    source: finding.source,
    title: finding.title,
    snippet: finding.snippet,
    url: finding.url
  }));
  const candidatesFor = (day: ItineraryOutline["days"][number]) =>
    day.restaurant_names
      .map((name) => real.placesByName.get(nameKey(name)))
      .filter((place): place is PlaceResult => !!place)
      .map((place) => ({
        name: place.name,
        rating: place.rating,
        reviews: place.reviews_count,
        price: place.price,
        cuisine: place.cuisine,
        address: place.address
      }));
  const batches: ItineraryOutline["days"][] = [];
  for (let index = 0; index < outline.days.length; index += DAYS_PER_BATCH) {
    batches.push(outline.days.slice(index, index + DAYS_PER_BATCH));
  }

  const expanded: ItineraryDay[] = [];

  for (let index = 0; index < batches.length; index += MAX_PARALLEL_BATCHES) {
    const wave = batches.slice(index, index + MAX_PARALLEL_BATCHES);
    const results = await Promise.all(
      wave.map((batch) =>
        withOneRetry(() => executor.runLlmOnly(
          "itinerary-builder",
          ItineraryDaysBatchSchema,
          {
            task: "expand_days",
            brief: input.brief,
            destination: input.destination,
            trip_summary: outline.trip_summary,
            // The whole outline travels with every batch so a day never
            // borrows a name that another day already owns.
            full_outline: outline.days.map((day) => ({
              day: day.day,
              theme: day.theme,
              area: day.area,
              free_visit_names: day.free_visit_names,
              restaurant_names: day.restaurant_names
            })),
            days_to_expand: batch.map((day) => ({ ...day, restaurant_candidates: candidatesFor(day) })),
            forum_findings: forumFindings,
            options_required: OPTIONS_PER_DAY,
            restaurants_required: RESTAURANTS_PER_DAY,
            activity_mix: activityMix(input.brief),
            activity_budget_per_person_eur: real.activityBudget ?? null,
            remaining_budget_eur: input.remainingBudgetEur ?? null,
            live_costs: input.liveCosts ?? null
          },
          input.locale
        ))
      )
    );

    for (const result of results) {
      if (result?.days?.length) expanded.push(...result.days);
    }
  }

  const seen = new Set<number>();
  return expanded
    .filter((day) => {
      if (seen.has(day.day)) return false;
      seen.add(day.day);
      return true;
    })
    .sort((left, right) => left.day - right.day);
}

// ---------------------------------------------------------------------------
// Activity mix: culture, sport, discovery, relax, food — different every day
// ---------------------------------------------------------------------------

const CATEGORIES: ActivityCategory[] = ["culture", "sport", "discovery", "relax", "food"];

// What each questionnaire style asks for, most wanted first.
const STYLE_CATEGORIES: Record<string, ActivityCategory[]> = {
  beach: ["relax", "discovery", "sport"],
  culture: ["culture", "discovery", "food"],
  nature: ["discovery", "sport", "relax"],
  food: ["food", "culture", "discovery"],
  nightlife: ["discovery", "relax", "food"],
  family: ["discovery", "relax", "culture"],
  romantic: ["relax", "food", "discovery"],
  adventure: ["sport", "discovery", "culture"]
};

/**
 * The categories the traveler's styles call for, most wanted first, always
 * at least three so every day can offer three different kinds.
 */
export function preferredCategories(brief: StructuredTripBrief): ActivityCategory[] {
  const score = new Map<ActivityCategory, number>();
  for (const style of brief.traveler_types ?? []) {
    (STYLE_CATEGORIES[style] ?? []).forEach((category, index) => score.set(category, (score.get(category) ?? 0) + (3 - index)));
  }
  const ranked = [...score.entries()].sort((left, right) => right[1] - left[1]).map(([category]) => category);
  for (const fallback of ["culture", "discovery", "relax", "sport", "food"] as ActivityCategory[]) {
    if (ranked.length >= 4) break;
    if (!ranked.includes(fallback)) ranked.push(fallback);
  }
  return ranked;
}

/** What the prompt receives: the mix to honour and the rule in words. */
export function activityMix(brief: StructuredTripBrief) {
  const preferred = preferredCategories(brief);
  return {
    preferred_categories: preferred,
    rule: `Each day's three paid options must belong to three different categories among ${preferred.join(", ")} (culture = museums, sites, guided heritage; sport = hiking, kayaking, cycling, diving; discovery = boat trips, villages, markets, wildlife, workshops; relax = beach, spa, pool, sunset, slow food; food = tastings, cooking classes). Rotate the trio from one day to the next so no two consecutive days offer the same combination, and never repeat an activity in the trip.`
  };
}

const CATEGORY_HINTS: Record<ActivityCategory, RegExp> = {
  sport: /rando|hik|trek|trail|kayak|paddle|vélo|velo|bike|cycl|plong|diving|snorkel|escalade|climb|canyon|surf|voile|sail|ski|rafting|jet|quad|vtt|marche|walk|course|run|yoga|équit|horse/i,
  relax: /plage|beach|farniente|spa|hammam|piscine|pool|détente|relax|coucher|sunset|baignade|swim|lagon|lagoon|sieste|thermes|bain/i,
  food: /dégust|degust|tasting|cuisine|cooking|gastronom|vin|wine|vignoble|vineyard|fromage|cheese|huile|olive|marché gourmand|food|bière|beer|chocolat|pâtiss/i,
  culture: /musée|museum|palais|palace|château|castle|monast|église|church|cathédrale|basilique|site archéo|archaeolog|ruines|ruins|fresque|histoire|history|patrimoine|heritage|temple|forteresse|fortress|remparts|galerie|opéra|théâtre|theatre|concert/i,
  discovery: /croisière|cruise|bateau|boat|excursion|village|marché|market|safari|grotte|cave|lac|lake|île|island|jardin|garden|atelier|workshop|ferme|farm|zoo|aquarium|observation|4x4|calèche|découverte|discovery|tour/i
};

/** Best guess of an option's category from its title and description. */
export function categoryOf(text: string): ActivityCategory {
  for (const category of ["sport", "food", "relax", "culture", "discovery"] as ActivityCategory[]) {
    if (CATEGORY_HINTS[category].test(text)) return category;
  }
  return "discovery";
}

/**
 * Makes each day's three options three different kinds, in the traveler's
 * mix. The model's own category is kept when plausible; a duplicate kind is
 * swapped for a spare headline excursion of a missing kind when one exists,
 * and the categories are re-read from the text otherwise so the label at
 * least tells the truth.
 */
export function balanceOptionCategories(days: ItineraryDay[], outline: ItineraryOutline, brief: StructuredTripBrief): void {
  const preferred = preferredCategories(brief);
  const used = new Set(days.flatMap((day) => (day.paid_options ?? []).map((option) => nameKey(option.title))));
  const spare = (outline.suggested_excursions ?? []).filter((excursion) => !used.has(nameKey(excursion.title)));
  let previousTrio = "";

  for (const day of days) {
    const options = day.paid_options ?? [];
    for (const option of options) {
      // A label that contradicts the text ("Plage de Vaï" filed as culture) is corrected.
      const guessed = categoryOf(`${option.title} ${option.description}`);
      if (!option.category || (option.category !== guessed && !CATEGORY_HINTS[option.category].test(`${option.title} ${option.description}`))) {
        option.category = guessed;
      }
    }

    const seen = new Set<ActivityCategory>();
    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      if (!seen.has(option.category)) {
        seen.add(option.category);
        continue;
      }
      // Duplicate kind: prefer a spare excursion of a kind this day lacks,
      // most wanted kind first.
      const wanted = [...preferred, ...CATEGORIES].filter((category) => !seen.has(category));
      const replacementIndex = spare.findIndex((excursion) => wanted.includes(categoryOf(`${excursion.title} ${excursion.style ?? ""} ${excursion.description}`)));
      if (replacementIndex >= 0) {
        const excursion = spare.splice(replacementIndex, 1)[0];
        const category = categoryOf(`${excursion.title} ${excursion.style ?? ""} ${excursion.description}`);
        options[index] = {
          ...option,
          title: excursion.title,
          description: excursion.description,
          duration: excursion.duration,
          price_from_eur: excursion.price_estimate_eur,
          price_note: excursion.price_estimate_eur != null ? `${excursion.price_estimate_eur} € par personne (indicatif)` : null,
          suited_for: excursion.style ? [excursion.style] : [],
          category,
          gyg_url: null,
          price_source: "estimate",
          local_alternative: null,
          booking_links: [],
          photo: excursion.photo ?? { query: excursion.title, url: null, thumb_url: null, credit: null, source_url: null, license: null }
        };
        used.add(nameKey(excursion.title));
        seen.add(category);
      }
    }

    // Two days in a row with the same trio read as a copy: the order of the
    // options is rotated so the emblematic Option A changes kind.
    const trio = options.map((option) => option.category).join("+");
    if (trio && trio === previousTrio && options.length > 1) {
      options.push(options.shift()!);
      options.forEach((option, index) => (option.option_label = OPTION_LABELS[index] ?? option.option_label));
    }
    previousTrio = options.map((option) => option.category).join("+");
    day.paid_options = options;
  }
}

// A batch the model returned malformed (a missing field, a rate limit, a
// truncated JSON) is asked again, with a pause so a rate limit has time to
// clear, before its days fall back to the local generator.
const RETRY_DELAYS_MS = [2000, 6000];

async function withOneRetry<T>(call: () => Promise<T | null>): Promise<T | null> {
  let result = await call();
  for (let attempt = 0; !result && attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    console.warn(`[itinerary] batch rejected, retrying (${attempt + 1}/${RETRY_DELAYS_MS.length}) in ${RETRY_DELAYS_MS[attempt] / 1000}s`);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    result = await call();
  }
  return result;
}

// ---------------------------------------------------------------------------
// Stages: the stage of every night, the drive that leads to it, the bed
// ---------------------------------------------------------------------------

/**
 * Makes the chain of nights coherent, whatever the model returned.
 *
 * A roadbook is read one night at a time: the traveler wants to know where
 * they sleep tonight, what it costs, and whether the bags move. Models fill
 * that unevenly — a stage named on day 3 and forgotten on day 4, a lodging on
 * the first night of a stage only. So the outline's stages are the truth, the
 * days inherit them, and what is still missing is carried forward from the
 * night before.
 *
 * `is_change` and `nights` are always recomputed here rather than trusted:
 * they are a property of the chain, not of one day.
 */
export function normalizeStages(
  days: ItineraryDay[],
  outline: ItineraryOutline,
  destination: string,
  locale: "fr" | "en"
): void {
  const outlineByDay = new Map(outline.days.map((day) => [day.day, day]));
  let previousStage: string | null = null;
  let previousLodging: Lodging | null = null;

  for (const day of days) {
    const planned = outlineByDay.get(day.day);
    const stage = firstText(day.stage, planned?.stage, day.area, previousStage, destination);
    day.stage = stage;

    // A drive the model forgot to write, on a day the stage changes, is worse
    // than no drive at all: the traveler has to guess how long the day is.
    if (day.route) {
      day.route.from = firstText(day.route.from, previousStage, destination) ?? "";
      day.route.to = firstText(day.route.to, stage, destination) ?? "";
      if (!day.route.duration && planned?.route_duration) day.route.duration = planned.route_duration;
    } else if (planned?.route_from || (previousStage && stage && previousStage !== stage)) {
      day.route = DayRouteSchema.parse({
        from: firstText(planned?.route_from, previousStage) ?? "",
        to: stage ?? "",
        duration: planned?.route_duration ?? null
      });
    }

    const name = firstText(day.lodging?.name, planned?.lodging_name);
    // A night with no named address at all repeats the night before rather
    // than showing the traveler a hole in the guide.
    day.lodging = name
      ? LodgingSchema.parse({ ...(day.lodging ?? {}), name, town: day.lodging?.town ?? stage })
      : previousLodging
        ? { ...previousLodging }
        : null;

    if (day.lodging) {
      day.lodging.is_change = !previousLodging || previousLodging.name !== day.lodging.name;
      day.lodging.booking_links = buildLodgingLinks(day.lodging.name, day.lodging.town ?? stage ?? destination, locale);
      if (!day.lodging.photo?.query) {
        day.lodging.photo = { ...(day.lodging.photo ?? EMPTY_PHOTO), query: `${day.lodging.name} ${day.lodging.town ?? destination} hotel` };
      }
    }

    previousStage = stage;
    previousLodging = day.lodging;
  }

  // How many nights each stage lasts is only knowable once the chain is whole.
  const nightsByName = new Map<string, number>();
  for (const day of days) {
    if (!day.lodging) continue;
    nightsByName.set(day.lodging.name, (nightsByName.get(day.lodging.name) ?? 0) + 1);
  }
  for (const day of days) {
    if (day.lodging) day.lodging.nights = nightsByName.get(day.lodging.name) ?? 1;
  }
}

/**
 * Puts the real, booked hotel into every day of a trip that has none.
 *
 * The named lodging of a stage comes from the model; the single stay of a
 * city break comes from the live hotel search, which knows its price, its
 * rating and its picture. Without this the guide of a one-base trip — and of
 * every trip the local generator had to write — shows no bed at all.
 */
export function applyStayAsLodging(days: ItineraryDay[], stay: StayOption | null | undefined, locale: "fr" | "en"): void {
  if (!stay?.name || days.some((day) => day.lodging?.name)) return;

  days.forEach((day, index) => {
    day.lodging = LodgingSchema.parse({
      name: stay.name,
      town: stay.area ?? day.stage ?? day.area,
      price_per_night_eur: stay.price_per_night ?? null,
      rating: stay.rating ?? null,
      coordinates: stay.coordinates ? { lat: stay.coordinates.lat, lon: stay.coordinates.lon } : null,
      nights: days.length,
      // Only the first night is a move; the rest is the same room.
      is_change: index === 0,
      booking_links: [
        ...(stay.booking_url
          ? [{ provider: "booking" as const, label: locale === "fr" ? "Réserver" : "Book", url: stay.booking_url }]
          : []),
        ...buildLodgingLinks(stay.name, stay.area ?? days[0]?.area ?? "", locale)
      ],
      photo: stay.photo_url ? { query: stay.name, url: stay.photo_url, thumb_url: null, credit: null, source_url: null } : null
    });
  });
}

/**
 * Gives every stage hotel what the live hotel search knows about it: the
 * listing's own picture, its price, its rating and its booking link.
 *
 * The model names the hotels; Google Hotels photographs them. Matching the
 * two by name means the guide shows the real façade rather than a stock
 * bedroom, without spending a search credit the plan has already paid.
 */
export function applyStayDetails(days: ItineraryDay[], stays: StayOption[], locale: "fr" | "en"): void {
  if (!stays.length) return;
  const key = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const bookLabel = locale === "fr" ? "Réserver" : "Book";

  for (const day of days) {
    const lodging = day.lodging;
    if (!lodging?.name || lodging.photo?.url) continue;
    const wanted = key(lodging.name);
    const stay = stays.find((candidate) => {
      const name = key(candidate.name ?? "");
      return name && (name === wanted || name.includes(wanted) || wanted.includes(name));
    });
    if (!stay) continue;

    if (stay.photo_url) {
      lodging.photo = { query: stay.name, url: stay.photo_url, thumb_url: null, credit: null, source_url: stay.booking_url ?? null, license: null };
    }
    if (lodging.price_per_night_eur == null && stay.price_per_night != null) lodging.price_per_night_eur = stay.price_per_night;
    if (lodging.rating == null && stay.rating != null) lodging.rating = stay.rating;
    if (!lodging.coordinates && stay.coordinates) lodging.coordinates = { lat: stay.coordinates.lat, lon: stay.coordinates.lon };
    if (stay.booking_url && !lodging.booking_links.some((link) => link.url === stay.booking_url)) {
      lodging.booking_links = [{ provider: "booking", label: bookLabel, url: stay.booking_url }, ...lodging.booking_links];
    }
  }
}

const EMPTY_PHOTO = { query: "", url: null, thumb_url: null, credit: null, source_url: null };

function firstText(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/** The overview table at the front of the guide: one row per stage. */
export function stageSummary(days: ItineraryDay[]): StageRow[] {
  const rows: StageRow[] = [];
  for (const day of days) {
    const last = rows[rows.length - 1];
    const name = day.lodging?.name ?? null;
    if (last && last.stage === day.stage && last.lodging === name) {
      last.nights += 1;
      last.dates.push(day.date ?? null);
      continue;
    }
    rows.push({
      stage: day.stage ?? "",
      lodging: name,
      price_from: day.lodging?.price_per_night_eur ?? null,
      price_to: day.lodging?.price_max_per_night_eur ?? null,
      price_note: day.lodging?.price_note ?? null,
      // The overview table shows the hotel: a bed is chosen on a picture as
      // much as on a price.
      photo: day.lodging?.photo ?? null,
      nights: 1,
      dates: [day.date ?? null]
    });
  }
  return rows;
}

export interface StageRow {
  stage: string;
  lodging: string | null;
  price_from: number | null;
  price_to: number | null;
  price_note: string | null;
  photo: Photo | null;
  nights: number;
  dates: (string | null)[];
}
