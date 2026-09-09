import type { ItineraryByDay, Photo } from "@mlt/contracts";
import {
  buildActivityLinks,
  buildCrossingLinks,
  withActivityDate,
  buildLuggageLinks,
  buildMapUrl,
  buildRestaurantLinks,
  buildTicketLinks,
  toSearchQuery
} from "../tools/links";
import { embedPhoto, scalePhoto } from "../tools/photos";
import { geocodePlaces, geocodeRequestCount } from "../tools/geocode";
import { sanitizeOfficialUrl } from "../tools/links";
import type { LiveTools } from "../tools";

// What makes a guide photo beautiful: distance. A wide view of the place,
// its landscape around it, rather than a close-up or a crowd.
const SCENIC_HINT = "scenic wide landscape view";
const WIDE_CATEGORIES = new Set(["viewpoint", "nature", "beach", "village", "old_town", "monument", "archaeology", "garden"]);

const FOOD_ANGLES = ["food dish", "taverna table", "grilled seafood", "local specialty", "meze plate", "street food"];

export interface EnrichOptions {
  destination: string;
  locale: "fr" | "en";
  /**
   * Resolving a hundred photos takes seconds of network time, so planning only
   * prepares the queries. The images are fetched when the guide is actually
   * rendered, and cached on the trip from then on.
   */
  withPhotos?: boolean;
  /** Party size, pre-filled on the booking platforms that accept it. */
  travelers?: number | null;
}

/**
 * Turns the raw itinerary into a bookable one.
 *
 * Two things the LLM is explicitly told not to produce are added here: real
 * booking URLs (GetYourGuide, Viator, TheFork, Google Maps) and real photos.
 * Both are rebuilt from the titles it did produce, so the guide can never ship
 * an invented link or a hallucinated image.
 */
export async function enrichItinerary(
  itinerary: ItineraryByDay,
  tools: LiveTools,
  options: EnrichOptions
): Promise<ItineraryByDay> {
  const { destination, locale } = options;

  // Every official site is checked on the network at once: done one after the
  // other, twenty museums at up to six seconds each held the plan for minutes.
  await Promise.all(
    (itinerary.itinerary_by_day ?? []).flatMap((day) =>
      (day.paid_options ?? []).map(async (option) => {
        option.official_url = option.kind === "ticket" ? await verifiedOfficialUrl(option.official_url) : null;
      })
    )
  );

  for (const day of itinerary.itinerary_by_day ?? []) {
    for (const visit of day.free_visits ?? []) {
      visit.map_url = buildMapUrl(visit.name, destination);
      const scenic = WIDE_CATEGORIES.has(visit.category) ? ` ${SCENIC_HINT}` : "";
      visit.photo = ensureQuery(visit.photo, `${visit.name} ${destination}${scenic}`);
    }

    for (const option of day.paid_options ?? []) {
      // A ticketed place (museum, monument) is booked at its official ticket
      // office; an experience (tour, cruise) on the activity platforms.
      const isTicket = option.kind === "ticket";

      const dated = { date: day.date ?? null, adults: options.travelers ?? null };
      option.booking_links = isTicket
        ? buildTicketLinks(option.title, destination, locale, option.official_url, dated)
        : buildActivityLinks(option.title, destination, locale, dated);
      // A real GetYourGuide offer replaces the search link, priced in the
      // label. For an experience it leads; for a ticketed place the official
      // site stays first (no commission) and the resellers follow, as a backup
      // for a sold-out date.
      if (option.gyg_url) {
        const price = option.price_source === "getyourguide" && option.price_from_eur != null ? ` — ${locale === "fr" ? "dès" : "from"} ${option.price_from_eur} €` : "";
        const gyg = { provider: "getyourguide" as const, label: `${locale === "fr" ? "Réserver sur GetYourGuide" : "Book on GetYourGuide"}${price}`, url: withActivityDate(option.gyg_url, dated) };
        const others = option.booking_links.filter((link) => link.provider !== "getyourguide");
        option.booking_links = isTicket
          ? [...others.filter((link) => link.provider === "official"), gyg, ...others.filter((link) => link.provider !== "official")]
          : [gyg, ...others];
      }
      // An island or a sea cave is two bookings: the boat from its port, then
      // the entrance. The crossing links come first (they are the harder
      // part to find), the entrance keeps the links built above.
      if (option.crossing?.from_port) {
        option.booking_links = [
          ...buildCrossingLinks(option.title, option.crossing.from_port, destination, locale, dated),
          ...option.booking_links
        ];
      }
      // An activity is not a place: searching "Visite guidée à vélo" in an
      // encyclopedia returns a pro cycling team. Anchoring the query on the
      // destination keeps the photo about the trip.
      option.photo = ensureQuery(option.photo, `${toSearchQuery(option.title, destination)} ${destination}`);
    }

    (day.restaurants ?? []).forEach((restaurant, index) => {
      restaurant.booking_links = buildRestaurantLinks(restaurant.name, destination, locale, {
        website: restaurant.website,
        mapsUrl: restaurant.maps_url
      });
      // Restaurants have no photo of their own, so the dish is illustrated
      // instead. The angle rotates so two tables never show the same plate.
      // Photo libraries are indexed in English and without accents, so the
      // query is built from English angles and a plain destination name.
      const angle = FOOD_ANGLES[(day.day + index) % FOOD_ANGLES.length];
      restaurant.photo = ensureQuery(restaurant.photo, `${angle} ${asciiFold(destination)}`);
    });

    if (day.luggage_storage) {
      day.luggage_storage.booking_links = buildLuggageLinks(destination, locale);
    }

    // Area alone would give the arrival and departure days, both based in the
    // same town, the very same cover photo.
    // The hero of the day is a landscape seen from afar, not a doorway: the
    // scenic words steer the photo libraries, and are dropped for the
    // encyclopedias, which are asked the place name alone.
    day.photo = ensureQuery(day.photo, `${[day.area, day.theme].filter(Boolean).join(" ")} ${destination} ${SCENIC_HINT}`.trim());
  }

  for (const excursion of itinerary.suggested_excursions ?? []) {
    excursion.booking_links = buildActivityLinks(excursion.title, destination, locale);
    // booking_url stays the platform link: it is what the mobile app shows as
    // the single "book" action.
    excursion.booking_url =
      excursion.booking_links.find((link) => link.provider === "getyourguide")?.url ?? null;
    excursion.photo = ensureQuery(excursion.photo, `${excursion.title} ${destination}`);
  }

  if (options.withPhotos) {
    await resolveItineraryPhotos(itinerary, tools, locale, destination);
  }

  return itinerary;
}

/**
 * Places each day on the map: free visits, ticketed places and restaurants.
 *
 * Verified restaurants already carry Google Maps coordinates, so Nominatim
 * (one request per second) is only asked for the free visits, the ticketed
 * options and the few unverified tables — an experience (a cruise, a bike
 * tour) has no address and is never geocoded. The day centre is the average
 * of the visits found.
 */
export async function locateItinerary(
  itinerary: ItineraryByDay,
  destination: string,
  maxRequests = Number(process.env.GEOCODE_MAX_PER_PLAN ?? 20)
): Promise<boolean> {
  let changed = false;
  // One Nominatim budget for the whole plan: places already in the disk cache
  // are free, the rest is placed until the budget runs out. A partly placed
  // map is fine; hammering a free public service is not.
  const startCount = geocodeRequestCount();
  const remaining = () => (Number.isFinite(maxRequests) ? Math.max(0, maxRequests - (geocodeRequestCount() - startCount)) : Number.POSITIVE_INFINITY);

  for (const day of itinerary.itinerary_by_day ?? []) {
    const slots: { query: string; get: () => any; set: (point: { lat: number; lon: number }) => void }[] = [];
    for (const visit of day.free_visits ?? []) {
      if (!visit.coordinates) slots.push({ query: visit.name, get: () => visit.coordinates, set: (p) => (visit.coordinates = p) });
    }
    for (const option of day.paid_options ?? []) {
      if (option.kind === "ticket" && !option.coordinates) {
        slots.push({ query: option.title, get: () => option.coordinates, set: (p) => (option.coordinates = p) });
      }
    }
    for (const restaurant of day.restaurants ?? []) {
      if (!restaurant.coordinates) {
        // The address pins the right "Taverna Maria" among the ten in town.
        const query = restaurant.address ? `${restaurant.name}, ${restaurant.address}` : restaurant.name;
        slots.push({ query, get: () => restaurant.coordinates, set: (p) => (restaurant.coordinates = p) });
      }
    }

    if (slots.length) {
      const points = await geocodePlaces(
        slots.map((slot) => slot.query),
        destination,
        remaining()
      );
      for (const slot of slots) {
        const point = points.get(slot.query.trim());
        if (point) {
          slot.set(point);
          changed = true;
        }
      }
    }

    const located = (day.free_visits ?? []).filter((visit) => visit.coordinates);
    if (located.length && !day.center) {
      day.center = {
        lat: located.reduce((sum, visit) => sum + visit.coordinates!.lat, 0) / located.length,
        lon: located.reduce((sum, visit) => sum + visit.coordinates!.lon, 0) / located.length
      };
      changed = true;
    }
  }

  return changed;
}

/**
 * Rewrites every photo as a data URI so a downloaded guide keeps its
 * illustrations offline — the traveler reads it on the plane, not online.
 */
export async function embedItineraryPhotos(itinerary: ItineraryByDay, research: any = null): Promise<ItineraryByDay> {
  const slots = collectPhotoSlots(itinerary, "", research);

  for (const slot of slots) {
    const photo = slot.get();
    if (!photo?.url) continue;
    slot.set(await embedPhoto(photo));
  }

  return itinerary;
}

/**
 * Collects every photo query, resolves them in one batch, and writes them back.
 *
 * Returns true when at least one image was newly resolved, which tells the
 * caller the trip is worth saving again.
 */
export async function resolveItineraryPhotos(
  itinerary: ItineraryByDay,
  tools: LiveTools,
  locale: "fr" | "en",
  destination: string,
  /** The researched blocks that also carry photos: hotels are on the days, cars are here. */
  research: any = null
): Promise<boolean> {
  let changed = await resolveHotelPhotos(itinerary, tools, destination, research);
  if (await resolveViatorActivities(itinerary, tools, destination, locale)) changed = true;

  const slots = collectPhotoSlots(itinerary, destination, research);
  const pending = slots.filter((slot) => slot.get()?.query && !slot.get()?.url);
  if (!pending.length) return changed;

  const queries = pending.map((slot) => slot.get()!.query);
  const resolved = await tools.find_photos({ queries, locale, destination });

  const stillEmpty: PhotoSlot[] = [];

  for (const slot of pending) {
    const photo = resolved.get(slot.get()!.query);
    if (photo?.url) {
      slot.set(scalePhoto(photo, slot.width));
      changed = true;
    } else {
      stillEmpty.push(slot);
    }
  }

  // Second pass: the day's hero and the lodging may be illustrated by what
  // they are, in the region — a village, a beach, a guesthouse. A visit, an
  // activity or a restaurant may not: a card showing a market that is not
  // this market misleads the traveler, so those stay blank until a photo of
  // the place itself is found.
  const substitutable = stillEmpty.filter((slot) => !slot.strict);
  if (substitutable.length) {
    const themeQueries = [...new Set(substitutable.map((slot) => slot.themeQuery))];
    const themePhotos = await tools.find_photos({ queries: themeQueries, locale, destination });

    for (const slot of substitutable) {
      const photo = themePhotos.get(slot.themeQuery);
      if (!photo?.url) continue;
      // The original query is kept as the alt text: it says what the card is
      // about, while the credit says where the illustration comes from.
      slot.set(scalePhoto({ ...photo, query: slot.get()!.query }, slot.width));
      changed = true;
    }
  }

  return changed;
}

/**
 * Every paid experience is looked up on Viator: when the product is found,
 * its own photo illustrates the card and its affiliate page becomes the first
 * booking link. A ticketed place (a museum) keeps its official site.
 */
async function resolveViatorActivities(
  itinerary: ItineraryByDay,
  tools: LiveTools,
  destination: string,
  locale: "fr" | "en"
): Promise<boolean> {
  const jobs: (() => Promise<boolean>)[] = [];
  for (const day of itinerary.itinerary_by_day ?? []) {
    for (const option of day.paid_options ?? []) {
      if (option.kind === "ticket" || option.photo?.credit === "Viator") continue;
      jobs.push(async () => {
        const match = await tools.find_viator_activity({ title: option.title, destination, locale });
        if (!match) return false;
        option.photo = match.photo;
        const label = locale === "fr" ? `Réserver sur Viator${match.price_from_eur != null ? ` · dès ${Math.round(match.price_from_eur)} €` : ""}` : `Book on Viator${match.price_from_eur != null ? ` · from ${Math.round(match.price_from_eur)} €` : ""}`;
        option.booking_links = [
          { provider: "viator", label, url: match.url },
          ...(option.booking_links ?? []).filter((link) => link.provider !== "viator")
        ];
        return true;
      });
    }
  }
  let changed = false;
  for (let index = 0; index < jobs.length; index += HOTEL_LOOKUPS_IN_PARALLEL) {
    const results = await Promise.all(jobs.slice(index, index + HOTEL_LOOKUPS_IN_PARALLEL).map((job) => job().catch(() => false)));
    if (results.some(Boolean)) changed = true;
  }
  return changed;
}

// Google is asked a few hotels at a time: enough to finish a three-week
// trip in seconds, few enough to stay polite with the quota.
const HOTEL_LOOKUPS_IN_PARALLEL = 4;

/**
 * Every hotel the plan proposes gets its picture from Google Maps — the
 * night's lodging on each day, and the suggested stays — unless the hotel
 * engine already illustrated it. Returns true when a photo was added.
 */
async function resolveHotelPhotos(
  itinerary: ItineraryByDay,
  tools: LiveTools,
  destination: string,
  research: any
): Promise<boolean> {
  const jobs: (() => Promise<boolean>)[] = [];

  for (const day of itinerary.itinerary_by_day ?? []) {
    const lodging = day.lodging;
    if (!lodging?.name || lodging.photo?.url) continue;
    jobs.push(async () => {
      const photo = await tools.find_hotel_photo({ name: lodging.name, town: lodging.town ?? day.area ?? null, destination });
      if (!photo?.url) return false;
      lodging.photo = photo;
      return true;
    });
  }

  for (const stay of research?.recommended_stays ?? []) {
    if (!stay?.name || stay.photo_url) continue;
    jobs.push(async () => {
      const photo = await tools.find_hotel_photo({ name: stay.name, town: stay.area ?? null, destination });
      if (!photo?.url) return false;
      stay.photo_url = photo.url;
      return true;
    });
  }

  let changed = false;
  for (let index = 0; index < jobs.length; index += HOTEL_LOOKUPS_IN_PARALLEL) {
    const results = await Promise.all(jobs.slice(index, index + HOTEL_LOOKUPS_IN_PARALLEL).map((job) => job().catch(() => false)));
    if (results.some(Boolean)) changed = true;
  }
  return changed;
}

interface PhotoSlot {
  get: () => Photo | null;
  set: (photo: Photo) => void;
  /**
   * What to look for when the exact place has no photo anywhere — a flea
   * market or a village square rarely does. Illustrating it with a market or a
   * village shot of the region beats leaving a blank card in the guide.
   */
  themeQuery: string;
  /** True when only a photo of this very place will do (visits, activities, tables). */
  strict?: boolean;
  /** Display width, so a thumbnail card never embeds a full-width photo. */
  width: number;
}

const HERO_WIDTH = 1200;
const CARD_WIDTH = 520;

// Photo libraries index in English, so the second-chance queries are English.
// Each category holds several angles: reusing one query everywhere would put
// the very same plate, or the very same church, on a dozen cards.
const CATEGORY_QUERIES: Record<string, string[]> = {
  museum: ["museum interior", "museum exhibition hall", "ancient artefacts museum"],
  monument: ["historic monument", "stone fortress wall", "old citadel"],
  religious: ["old church", "orthodox chapel", "monastery courtyard"],
  archaeology: ["archaeological site ruins", "ancient columns ruins", "excavation site stones"],
  old_town: ["old town street", "narrow alley old houses", "historic quarter facades"],
  market: ["local market stalls", "spice market", "farmers market produce"],
  viewpoint: ["panoramic viewpoint landscape", "hilltop wide view sunset", "coastal overlook panorama"],
  nature: ["nature landscape panorama", "mountain valley wide view", "gorge canyon aerial view"],
  beach: ["beach coast aerial view", "turquoise sea cove panorama", "sandy shoreline wide view"],
  street_art: ["street art mural", "graffiti wall art", "colourful painted alley"],
  garden: ["public garden park", "botanical garden path", "shaded park bench"],
  village: ["traditional village", "hillside village houses", "village square"]
};

const DEFAULT_QUERIES = ["landmark", "historic place", "scenic spot"];
const DAY_QUERIES = ["panoramic landscape wide view", "aerial coastline scenery", "countryside panorama", "town skyline distant view"];
const ACTIVITY_QUERIES = ["excursion tourists", "boat trip", "guided tour group", "hiking group"];
const RESTAURANT_QUERIES = ["restaurant food", "taverna dinner", "local dishes", "seafood plate", "traditional meal"];
// A hotel rarely has a photo of its own in a free library: the fallback shows
// the kind of place it is, in the region.
const LODGING_QUERIES: Record<string, string[]> = {
  hotel: ["hotel room", "boutique hotel bedroom", "hotel facade"],
  guesthouse: ["guesthouse room", "bed and breakfast bedroom", "small guesthouse"],
  homestay: ["homestay room", "traditional house bedroom", "family home stay"],
  ecolodge: ["eco lodge", "wooden lodge nature", "bungalow garden"],
  resort: ["resort pool", "beach resort", "resort terrace"],
  apartment: ["apartment living room", "studio apartment", "holiday apartment"],
  boat: ["cabin boat interior", "cruise boat deck", "houseboat"]
};
const CAR_QUERIES = ["rental car", "small car parked", "car on the road"];

/**
 * Walks the itinerary's photo slots.
 *
 * Every collection is defaulted: trips saved before the rich day format exists
 * in the database with plain morning/afternoon/evening days, and the guide has
 * to render them instead of crashing.
 */
function collectPhotoSlots(itinerary: ItineraryByDay, destination = "", research: any = null): PhotoSlot[] {
  const place = destination.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const slots: PhotoSlot[] = [];
  const counters = new Map<string, number>();

  // Rotates through a category's angles so consecutive fallbacks differ.
  const angle = (key: string, options: string[]): string => {
    const index = counters.get(key) ?? 0;
    counters.set(key, index + 1);
    return `${options[index % options.length]} ${place}`.trim();
  };

  for (const day of itinerary.itinerary_by_day ?? []) {
    slots.push({
      get: () => day.photo,
      set: (photo) => (day.photo = photo),
      themeQuery: angle("day", DAY_QUERIES),
      strict: true,
      width: HERO_WIDTH
    });
    // The bed of the night. Its picture comes from the hotel engine (the same
    // photos Booking shows), matched by name in the planner. It is never
    // looked up in the photo libraries: an encyclopedia has no page for a
    // guesthouse, and a stock library answers "hotel" with someone else's
    // hotel — which a traveler would take for this one.
    if (day.lodging?.name && day.lodging.photo?.url) {
      const lodging = day.lodging;
      slots.push({
        get: () => lodging.photo,
        set: (photo) => (lodging.photo = photo),
        themeQuery: angle(lodging.kind ?? "hotel", LODGING_QUERIES[lodging.kind ?? "hotel"] ?? LODGING_QUERIES.hotel),
        width: CARD_WIDTH
      });
    }
    for (const visit of day.free_visits ?? []) {
      slots.push({
        get: () => visit.photo,
        set: (photo) => (visit.photo = photo),
        themeQuery: angle(visit.category, CATEGORY_QUERIES[visit.category] ?? DEFAULT_QUERIES),
        strict: true,
        width: CARD_WIDTH
      });
    }
    for (const option of day.paid_options ?? []) {
      slots.push({
        get: () => option.photo,
        set: (photo) => (option.photo = photo),
        themeQuery: angle("activity", ACTIVITY_QUERIES),
        strict: true,
        width: CARD_WIDTH
      });
    }
    for (const restaurant of day.restaurants ?? []) {
      slots.push({
        get: () => restaurant.photo,
        set: (photo) => (restaurant.photo = photo),
        themeQuery: angle("restaurant", RESTAURANT_QUERIES),
        strict: true,
        width: CARD_WIDTH
      });
    }
  }
  for (const excursion of itinerary.suggested_excursions ?? []) {
    slots.push({
      get: () => excursion.photo,
      set: (photo) => (excursion.photo = photo),
      themeQuery: angle("excursion", DAY_QUERIES),
      strict: true,
      width: HERO_WIDTH
    });
  }

  // The rental categories: the traveler picks between a city car and a
  // 7-seater far more easily on a picture of the model than on a label.
  for (const option of research?.car_rental?.options ?? []) {
    const model = option.example_model ?? option.category;
    option.photo = ensureQuery(option.photo, `${model} car`.trim());
    slots.push({
      get: () => option.photo,
      set: (photo: Photo) => (option.photo = photo),
      themeQuery: angle("car", CAR_QUERIES),
      width: CARD_WIDTH
    });
  }

  return slots;
}

/**
 * The model's official URL, kept only when well-formed, not a reseller, and
 * actually answering on the network. Tests stay hermetic: the format check
 * alone decides there.
 */
async function verifiedOfficialUrl(value: string | null | undefined): Promise<string | null> {
  const url = sanitizeOfficialUrl(value);
  if (!url || process.env.NODE_ENV === "test") return url;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    clearTimeout(timer);
    // Some sites refuse HEAD (405) yet serve the page: only a clear miss drops it.
    return response.status === 404 || response.status === 410 ? null : url;
  } catch {
    return null;
  }
}

function asciiFold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function ensureQuery(photo: Photo | null, fallbackQuery: string): Photo {
  const query = photo?.query?.trim() || fallbackQuery.trim();
  return {
    query,
    url: photo?.url ?? null,
    thumb_url: photo?.thumb_url ?? null,
    credit: photo?.credit ?? null,
    source_url: photo?.source_url ?? null,
    license: photo?.license ?? null
  };
}
