import type { ItineraryByDay, Photo } from "@mlt/contracts";
import {
  buildActivityLinks,
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

  for (const day of itinerary.itinerary_by_day ?? []) {
    for (const visit of day.free_visits ?? []) {
      visit.map_url = buildMapUrl(visit.name, destination);
      visit.photo = ensureQuery(visit.photo, `${visit.name} ${destination}`);
    }

    for (const option of day.paid_options ?? []) {
      // A ticketed place (museum, monument) is booked at its official ticket
      // office; an experience (tour, cruise) on the activity platforms.
      const isTicket = option.kind === "ticket";
      option.official_url = isTicket ? await verifiedOfficialUrl(option.official_url) : null;
      option.booking_links = isTicket
        ? buildTicketLinks(option.title, destination, locale, option.official_url)
        : buildActivityLinks(option.title, destination, locale);
      // A real GetYourGuide offer replaces the search link, priced in the
      // label. For an experience it leads; for a ticketed place the official
      // site stays first (no commission) and the resellers follow, as a backup
      // for a sold-out date.
      if (option.gyg_url) {
        const price = option.price_source === "getyourguide" && option.price_from_eur != null ? ` — ${locale === "fr" ? "dès" : "from"} ${option.price_from_eur} €` : "";
        const gyg = { provider: "getyourguide" as const, label: `${locale === "fr" ? "Réserver sur GetYourGuide" : "Book on GetYourGuide"}${price}`, url: option.gyg_url };
        const others = option.booking_links.filter((link) => link.provider !== "getyourguide");
        option.booking_links = isTicket
          ? [...others.filter((link) => link.provider === "official"), gyg, ...others.filter((link) => link.provider !== "official")]
          : [gyg, ...others];
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
    day.photo = ensureQuery(day.photo, `${[day.area, day.theme].filter(Boolean).join(" ")} ${destination}`.trim());
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
export async function embedItineraryPhotos(itinerary: ItineraryByDay): Promise<ItineraryByDay> {
  const slots = collectPhotoSlots(itinerary);

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
  destination: string
): Promise<boolean> {
  const slots = collectPhotoSlots(itinerary, destination);
  const pending = slots.filter((slot) => slot.get()?.query && !slot.get()?.url);
  if (!pending.length) return false;

  const queries = pending.map((slot) => slot.get()!.query);
  const resolved = await tools.find_photos({ queries, locale, destination });

  let changed = false;
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

  // Second pass: places with no photo of their own get a photo of what they
  // are, in the region — a market, a village, a beach — rather than a blank.
  if (stillEmpty.length) {
    const themeQueries = [...new Set(stillEmpty.map((slot) => slot.themeQuery))];
    const themePhotos = await tools.find_photos({ queries: themeQueries, locale, destination });

    for (const slot of stillEmpty) {
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

interface PhotoSlot {
  get: () => Photo | null;
  set: (photo: Photo) => void;
  /**
   * What to look for when the exact place has no photo anywhere — a flea
   * market or a village square rarely does. Illustrating it with a market or a
   * village shot of the region beats leaving a blank card in the guide.
   */
  themeQuery: string;
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
  viewpoint: ["panoramic viewpoint landscape", "hilltop view sunset", "coastal overlook"],
  nature: ["nature landscape", "mountain trail", "gorge canyon"],
  beach: ["beach coast", "turquoise sea cove", "sandy shoreline"],
  street_art: ["street art mural", "graffiti wall art", "colourful painted alley"],
  garden: ["public garden park", "botanical garden path", "shaded park bench"],
  village: ["traditional village", "hillside village houses", "village square"]
};

const DEFAULT_QUERIES = ["landmark", "historic place", "scenic spot"];
const DAY_QUERIES = ["landscape", "coastline", "countryside", "town view"];
const ACTIVITY_QUERIES = ["excursion tourists", "boat trip", "guided tour group", "hiking group"];
const RESTAURANT_QUERIES = ["restaurant food", "taverna dinner", "local dishes", "seafood plate", "traditional meal"];

/**
 * Walks the itinerary's photo slots.
 *
 * Every collection is defaulted: trips saved before the rich day format exists
 * in the database with plain morning/afternoon/evening days, and the guide has
 * to render them instead of crashing.
 */
function collectPhotoSlots(itinerary: ItineraryByDay, destination = ""): PhotoSlot[] {
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
      width: HERO_WIDTH
    });
    for (const visit of day.free_visits ?? []) {
      slots.push({
        get: () => visit.photo,
        set: (photo) => (visit.photo = photo),
        themeQuery: angle(visit.category, CATEGORY_QUERIES[visit.category] ?? DEFAULT_QUERIES),
        width: CARD_WIDTH
      });
    }
    for (const option of day.paid_options ?? []) {
      slots.push({
        get: () => option.photo,
        set: (photo) => (option.photo = photo),
        themeQuery: angle("activity", ACTIVITY_QUERIES),
        width: CARD_WIDTH
      });
    }
    for (const restaurant of day.restaurants ?? []) {
      slots.push({
        get: () => restaurant.photo,
        set: (photo) => (restaurant.photo = photo),
        themeQuery: angle("restaurant", RESTAURANT_QUERIES),
        width: CARD_WIDTH
      });
    }
  }
  for (const excursion of itinerary.suggested_excursions ?? []) {
    slots.push({
      get: () => excursion.photo,
      set: (photo) => (excursion.photo = photo),
      themeQuery: angle("excursion", DAY_QUERIES),
      width: HERO_WIDTH
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
