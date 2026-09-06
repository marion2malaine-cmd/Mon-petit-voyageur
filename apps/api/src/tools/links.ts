import type { BookingLink, SearchLink } from "@mlt/contracts";

/**
 * Every Viator link carries the affiliate tracking of the site, so a booking
 * made from the guide is credited. The ids come from the Viator partner
 * dashboard and can be changed in the environment.
 */
export function viatorUrl(pathAndQuery: string): string {
  const pid = process.env.VIATOR_AFFILIATE_PID ?? "P00277065";
  const mcid = process.env.VIATOR_AFFILIATE_MCID ?? "42383";
  const url = new URL(pathAndQuery, "https://www.viator.com");
  url.searchParams.set("pid", pid);
  url.searchParams.set("mcid", mcid);
  url.searchParams.set("medium", "link");
  url.searchParams.set("medium_version", "selector");
  return url.toString();
}

export interface LinkBuilderInput {
  locale: "fr" | "en";
  originCity?: string | null;
  originCode?: string | null;
  destinationCity: string;
  destinationCode?: string | null;
  departureDate?: string | null; // YYYY-MM-DD
  returnDate?: string | null; // YYYY-MM-DD
  adults?: number;
}

// Skyscanner and Booking.com do not expose a free public API: live prices come
// from Amadeus, and these deep links open the same search pre-filled on each
// platform so the traveler can book at the displayed price.
export function buildSearchLinks(input: LinkBuilderInput): SearchLink[] {
  const fr = input.locale === "fr";
  const adults = input.adults ?? 1;
  const city = input.destinationCity.trim();
  const cityParam = encodeURIComponent(city);
  const links: SearchLink[] = [];

  const skyscannerHost = fr ? "www.skyscanner.fr" : "www.skyscanner.net";
  if (input.originCode && input.destinationCode) {
    const dep = toSkyscannerDate(input.departureDate);
    const ret = toSkyscannerDate(input.returnDate);
    const segments = [input.originCode.toLowerCase(), input.destinationCode.toLowerCase(), dep, ret]
      .filter(Boolean)
      .join("/");
    links.push({
      provider: "skyscanner",
      label: fr ? "Comparer les vols sur Skyscanner" : "Compare flights on Skyscanner",
      url: `https://${skyscannerHost}/transport/${fr ? "vols" : "flights"}/${segments}/?adults=${adults}`,
      category: "flights"
    });
  } else {
    links.push({
      provider: "skyscanner",
      label: fr ? "Comparer les vols sur Skyscanner" : "Compare flights on Skyscanner",
      url: `https://${skyscannerHost}/`,
      category: "flights"
    });
  }

  const gfQuery = encodeURIComponent(
    `flights from ${input.originCity ?? "Paris"} to ${city}${input.departureDate ? ` on ${input.departureDate}` : ""}`
  );
  links.push({
    provider: "google-flights",
    label: fr ? "Voir sur Google Flights" : "View on Google Flights",
    url: `https://www.google.com/travel/flights?q=${gfQuery}`,
    category: "flights"
  });

  const bookingParams = new URLSearchParams({ ss: city, group_adults: String(adults) });
  if (input.departureDate) bookingParams.set("checkin", input.departureDate);
  if (input.returnDate) bookingParams.set("checkout", input.returnDate);
  links.push({
    provider: "booking",
    label: fr ? "Hébergements sur Booking.com" : "Stays on Booking.com",
    url: `https://www.booking.com/searchresults.${fr ? "fr" : "en-gb"}.html?${bookingParams.toString()}`,
    category: "stays"
  });

  const airbnbParams = new URLSearchParams({ adults: String(adults) });
  if (input.departureDate) airbnbParams.set("checkin", input.departureDate);
  if (input.returnDate) airbnbParams.set("checkout", input.returnDate);
  links.push({
    provider: "airbnb",
    label: fr ? "Locations sur Airbnb" : "Rentals on Airbnb",
    url: `https://www.airbnb.${fr ? "fr" : "com"}/s/${cityParam}/homes?${airbnbParams.toString()}`,
    category: "stays"
  });

  links.push(...buildExperienceLinks(city, input.locale));

  links.push({
    provider: "tripadvisor-forum",
    label: fr ? `Forum voyageurs ${city} (TripAdvisor)` : `${city} traveler forum (TripAdvisor)`,
    url: `https://www.tripadvisor.${fr ? "fr" : "com"}/Search?q=${encodeURIComponent(`${city} forum`)}`,
    category: "forums"
  });
  if (fr) {
    links.push({
      provider: "routard",
      label: `Conseils Routard pour ${city}`,
      url: `https://www.routard.com/recherche.asp?q=${cityParam}`,
      category: "forums"
    });
  }

  return links;
}

export function buildExperienceLinks(destinationCity: string, locale: "fr" | "en"): SearchLink[] {
  const fr = locale === "fr";
  const city = destinationCity.trim();
  const cityParam = encodeURIComponent(city);

  return [
    {
      provider: "getyourguide",
      label: fr ? `Excursions et activités à ${city}` : `Tours and activities in ${city}`,
      url: buildGetYourGuideUrl(city, locale),
      category: "activities"
    },
    {
      provider: "viator",
      label: fr ? `Activités à ${city} (Viator)` : `Activities in ${city} (Viator)`,
      url: viatorUrl(`/${fr ? "fr-FR/" : ""}searchResults/all?text=${cityParam}`),
      category: "activities"
    },
    {
      provider: "civitatis",
      label: fr ? `Visites guidées à ${city} (Civitatis)` : `Guided tours in ${city} (Civitatis)`,
      // Civitatis ignores its ?q= and its city slug 404s for regions, so a
      // scoped search is the reliable route to its city page.
      url: buildSiteSearchUrl("civitatis.com", city),
      category: "activities"
    },
    {
      provider: "tripadvisor",
      label: fr ? `Meilleurs restaurants à ${city}` : `Best restaurants in ${city}`,
      url: `https://www.tripadvisor.${fr ? "fr" : "com"}/Search?q=${encodeURIComponent(`restaurants ${city}`)}`,
      category: "restaurants"
    },
    {
      provider: "thefork",
      label: fr ? `Réserver une table à ${city} (TheFork)` : `Book a table in ${city} (TheFork)`,
      // TheFork ignores its queryText and falls back to Paris, so it is reached
      // through a scoped search that lands on the right city.
      url: buildSiteSearchUrl(`thefork.${fr ? "fr" : "com"}`, city),
      category: "restaurants"
    }
  ];
}

// Per-activity links. The LLM proposes the activity title only; the real
// booking URLs are always built here so the guide never ships a dead link.
// Leading words that describe the *kind* of outing rather than the place, and
// which dilute a search: "Croisière sur les canaux" matches nothing, "canaux
// Bruges" matches the canal cruises.
const GENERIC_PREFIX =
  /^(visites? guid[ée]es?|visites?|excursions?|d[ée]gustations?|croisi[èe]res?|entr[ée]es?|billets?|acc[èe]s|mont[ée]es?|balades?|promenades?|tours?|ateliers?|cours|journ[ée]e|demi-journ[ée]e|guided tours?|tickets?|entry|cruises?|tastings?|walks?)\s+(de\s+la\s+|de\s+l'|de\s+|du\s+|des\s+|à\s+la\s+|à\s+l'|à\s+|au\s+|aux\s+|sur\s+les\s+|sur\s+le\s+|sur\s+la\s+|sur\s+|en\s+|dans\s+le\s+|dans\s+la\s+|dans\s+|of\s+the\s+|of\s+|to\s+the\s+|to\s+|in\s+the\s+|in\s+)?/i;

/**
 * Turns an activity title into something a booking platform can actually find.
 *
 * Titles read like a guidebook — "Côte belge : Knokke et Zwin" — and searching
 * that verbatim returns nothing, at which point GetYourGuide silently shows an
 * unrelated city. The specific part is kept, the descriptive lead-in dropped,
 * and the destination added only when what remains is too short to stand alone.
 */
export function toSearchQuery(activityTitle: string, destinationCity: string): string {
  const specific = activityTitle.split(/\s*[:—–|]\s*/).pop() ?? activityTitle;

  const cleaned = specific
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(GENERIC_PREFIX, "")
    .trim();

  const words = cleaned.split(" ").filter(Boolean).slice(0, 4);
  const query = words.join(" ") || activityTitle.trim();

  const alreadyPlaced =
    words.length >= 3 || query.toLowerCase().includes(destinationCity.trim().toLowerCase());

  return alreadyPlaced ? query : `${query} ${destinationCity}`.trim();
}

export interface ActivityLinkOptions {
  /** The day of the activity (YYYY-MM-DD): pre-fills the date on the platforms that accept it. */
  date?: string | null;
  adults?: number | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Adds the trip date (and party size) to a platform URL that honours them. */
export function withActivityDate(url: string, options: ActivityLinkOptions | undefined): string {
  const date = options?.date && ISO_DATE.test(options.date) ? options.date : null;
  if (!date) return url;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (host.includes("getyourguide")) {
      parsed.searchParams.set("date_from", date);
      parsed.searchParams.set("date_to", date);
      if (options?.adults) parsed.searchParams.set("adults", String(options.adults));
    } else if (host.includes("viator")) {
      parsed.searchParams.set("startDate", date);
      parsed.searchParams.set("endDate", date);
    } else if (host.includes("tiqets")) {
      parsed.searchParams.set("date", date);
    } else if (host.includes("civitatis")) {
      parsed.searchParams.set("date", date);
    } else {
      return url;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function buildActivityLinks(
  activityTitle: string,
  destinationCity: string,
  locale: "fr" | "en",
  options?: ActivityLinkOptions
): BookingLink[] {
  return buildActivityLinksRaw(activityTitle, destinationCity, locale).map((link) => ({ ...link, url: withActivityDate(link.url, options) }));
}

/**
 * The two bookings of a site reached by boat: the crossing from its port,
 * then the entrance. Both are searched on the platforms and, for the
 * crossing, at the port's own operators — usually the cheapest.
 */
export function buildCrossingLinks(
  siteTitle: string,
  fromPort: string,
  destinationCity: string,
  locale: "fr" | "en",
  options?: ActivityLinkOptions
): BookingLink[] {
  const fr = locale === "fr";
  const site = toSearchQuery(siteTitle, destinationCity).replace(new RegExp(`\\s*${destinationCity.trim()}$`, "i"), "").trim() || siteTitle;
  const boatQuery = fr ? `bateau ${site} depuis ${fromPort}` : `boat ${site} from ${fromPort}`;
  const encoded = encodeURIComponent(boatQuery);
  return [
    {
      provider: "local-agency",
      label: fr ? `Traversée depuis ${fromPort} — opérateurs du port` : `Crossing from ${fromPort} — port operators`,
      url: `https://www.google.com/search?q=${encodeURIComponent(fr ? `${boatQuery} billet traversée horaires` : `${boatQuery} ticket timetable`)}`
    },
    {
      provider: "viator",
      label: fr ? `Traversée depuis ${fromPort} (Viator)` : `Crossing from ${fromPort} (Viator)`,
      url: withActivityDate(viatorUrl(`/${fr ? "fr-FR/" : ""}searchResults/all?text=${encoded}`), options)
    },
    {
      provider: "getyourguide",
      label: fr ? `Traversée depuis ${fromPort} (GetYourGuide)` : `Crossing from ${fromPort} (GetYourGuide)`,
      url: buildGetYourGuideUrl(boatQuery, locale)
    }
  ];
}

function buildActivityLinksRaw(
  activityTitle: string,
  destinationCity: string,
  locale: "fr" | "en"
): BookingLink[] {
  const fr = locale === "fr";
  const query = toSearchQuery(activityTitle, destinationCity);
  const encoded = encodeURIComponent(query);

  // Ordered cheapest-route-first: a local operator or a forum thread usually
  // sells the same outing below the platform price, so those come before the
  // international platforms rather than after.
  return [
    ...buildLocalAndForumLinks(activityTitle, destinationCity, locale),
    {
      // Viator honours its search parameter, so it can be addressed directly.
      provider: "viator",
      label: fr ? "Voir sur Viator" : "See on Viator",
      url: viatorUrl(`/${fr ? "fr-FR/" : ""}searchResults/all?text=${encoded}`)
    },
    {
      provider: "getyourguide",
      label: fr ? "Réserver sur GetYourGuide" : "Book on GetYourGuide",
      url: buildGetYourGuideUrl(query, locale)
    }
  ];
}

/**
 * GetYourGuide's own search silently ignores its `q` parameter and shows
 * whatever destination the visitor's session is anchored on — a Bruges query
 * landed on Málaga. Going through a site-restricted web search reaches the
 * real GetYourGuide pages for the activity instead.
 */
export function buildGetYourGuideUrl(query: string, locale: "fr" | "en"): string {
  return buildSiteSearchUrl(locale === "fr" ? "getyourguide.fr" : "getyourguide.com", query);
}

/**
 * A site-restricted web search that always resolves and lands on the right
 * page of a site whose own search is unreliable.
 *
 * Several travel sites ignore their `?q=` parameter (GetYourGuide, Civitatis)
 * or require a city slug that 404s for anything but a plain city name
 * (Nannybag, Radical Storage). Rather than guess slugs, the traveler is sent
 * through a search scoped to that site — verified to land on the correct page.
 */
export function buildSiteSearchUrl(host: string, query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`site:${host} ${query}`)}`;
}

/**
 * Booking links for a fixed place you enter with a ticket — a museum, a
 * monument, a palace, a show.
 *
 * A GetYourGuide search for "Musée Groeninge" mostly returns unrelated city
 * tours; the traveler wants the entrance ticket. So this leads with the
 * official ticket office (a targeted web search that lands on the museum's own
 * site — verified to hit museabrugge.be for the Groeninge) and Tiqets, which
 * specialises in attraction tickets and honours its search, before the
 * general platforms.
 */
export function buildTicketLinks(
  activityTitle: string,
  destinationCity: string,
  locale: "fr" | "en",
  officialUrl: string | null = null,
  options?: ActivityLinkOptions
): BookingLink[] {
  return buildTicketLinksRaw(activityTitle, destinationCity, locale, officialUrl).map((link) =>
    link.provider === "official" ? link : { ...link, url: withActivityDate(link.url, options) }
  );
}

function buildTicketLinksRaw(
  activityTitle: string,
  destinationCity: string,
  locale: "fr" | "en",
  officialUrl: string | null = null
): BookingLink[] {
  const fr = locale === "fr";
  const query = toSearchQuery(activityTitle, destinationCity);
  const encoded = encodeURIComponent(query);
  const officialQuery = fr ? `${query} billetterie officielle` : `${query} official tickets`;

  return [
    // The institution's own site when it is known — the cheapest way in —
    // otherwise a search that lands on it.
    officialUrl
      ? { provider: "official", label: fr ? "Site officiel — billetterie" : "Official website — tickets", url: officialUrl }
      : {
          provider: "official",
          label: fr ? "Billetterie officielle" : "Official ticket office",
          url: `https://www.google.com/search?q=${encodeURIComponent(officialQuery)}`
        },
    {
      provider: "tiqets",
      label: fr ? "Billet d'entrée (Tiqets)" : "Entry ticket (Tiqets)",
      url: `https://www.tiqets.com/${fr ? "fr" : "en"}/search?q=${encoded}`
    },
    {
      provider: "viator",
      label: fr ? "Voir sur Viator" : "See on Viator",
      url: viatorUrl(`/${fr ? "fr-FR/" : ""}searchResults/all?text=${encoded}`)
    },
    {
      provider: "getyourguide",
      label: fr ? "Comparer sur GetYourGuide" : "Compare on GetYourGuide",
      url: buildGetYourGuideUrl(query, locale)
    }
  ];
}

// Domains that resell tickets: a URL there is never an "official" site.
const RESELLER_HOSTS = /(getyourguide|viator|tiqets|civitatis|klook|tripadvisor|headout|musement|expedia|booking\.com|google\.|facebook|instagram|wikipedia)/i;

/**
 * Accepts the model's official URL only when it is a well-formed https
 * address on a domain that is not a reseller. Everything else falls back to
 * the official ticket-office search.
 */
export function sanitizeOfficialUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (RESELLER_HOSTS.test(url.hostname)) return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Links to the cheaper end of the ladder: local operators and what travelers
 * actually report about an activity.
 *
 * These are searches, not deep links to a named agency: no free API lists
 * local operators, and naming one the model invented would be worse than
 * handing over a good search.
 */
export function buildLocalAndForumLinks(
  activityTitle: string,
  destinationCity: string,
  locale: "fr" | "en"
): BookingLink[] {
  const fr = locale === "fr";
  const city = destinationCity.trim();
  const subject = `${activityTitle} ${city}`.trim();

  const localQuery = fr
    ? `${subject} agence locale réservation sur place tarif`
    : `${subject} local agency book on site price`;

  const links: BookingLink[] = [
    {
      provider: "local-agency",
      label: fr ? "Agences locales et tarif sur place" : "Local agencies and on-site price",
      url: `https://www.google.com/search?q=${encodeURIComponent(localQuery)}`
    },
    {
      provider: "forum",
      label: fr ? "Avis du forum TripAdvisor" : "TripAdvisor forum reports",
      url: `https://www.tripadvisor.${fr ? "fr" : "com"}/Search?q=${encodeURIComponent(`${subject} forum`)}`
    }
  ];

  if (fr) {
    links.push({
      provider: "routard",
      label: "Forum Routard",
      url: `https://www.routard.com/recherche.asp?q=${encodeURIComponent(subject)}`
    });
  }

  links.push({
    provider: "reddit",
    label: fr ? "Retours voyageurs (Reddit)" : "Traveler reports (Reddit)",
    url: `https://www.google.com/search?q=${encodeURIComponent(`site:reddit.com ${subject}`)}`
  });

  return links;
}

// Free visits are not booked: they get a map link so the traveler can drive there.
export function buildMapUrl(placeName: string, destinationCity: string): string {
  const query = placeName.toLowerCase().includes(destinationCity.toLowerCase())
    ? placeName
    : `${placeName}, ${destinationCity}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function buildRestaurantLinks(
  restaurantName: string,
  destinationCity: string,
  locale: "fr" | "en",
  known: { website?: string | null; mapsUrl?: string | null } = {}
): BookingLink[] {
  const fr = locale === "fr";
  const query = `${restaurantName} ${destinationCity}`.trim();
  const encoded = encodeURIComponent(query);

  return [
    // A verified table comes with its own site: the direct way to book.
    ...(known.website
      ? ([{ provider: "official", label: fr ? "Site du restaurant" : "Restaurant website", url: known.website }] as BookingLink[])
      : []),
    {
      // TheFork ignores queryText (it defaults to Paris), so a scoped search
      // lands on this restaurant's own TheFork page when it has one.
      provider: "thefork",
      label: fr ? "Réserver sur TheFork" : "Book on TheFork",
      url: buildSiteSearchUrl(`thefork.${fr ? "fr" : "com"}`, query)
    },
    {
      provider: "tripadvisor",
      label: fr ? "Avis TripAdvisor" : "TripAdvisor reviews",
      url: `https://www.tripadvisor.${fr ? "fr" : "com"}/Search?q=${encoded}`
    },
    {
      provider: "google-maps",
      label: fr ? "Itinéraire" : "Directions",
      url: known.mapsUrl ?? buildMapUrl(restaurantName, destinationCity)
    }
  ];
}

// Left-luggage networks all address their cities by slug, which is the only
// deep link available without an account.
export function buildLuggageLinks(destinationCity: string, locale: "fr" | "en"): BookingLink[] {
  const fr = locale === "fr";
  const city = destinationCity.trim();

  // The networks' slug URLs 404 for anything but a plain city name
  // (nannybag.com/fr/luggage-storage/bruges does not exist — the French path
  // is /consigne-bagage/), so each is reached through a scoped search that
  // always resolves.
  return [
    {
      provider: "official",
      label: fr ? "Consignes Nannybag" : "Nannybag lockers",
      url: buildSiteSearchUrl("nannybag.com", city)
    },
    {
      provider: "official",
      label: fr ? "Consignes Radical Storage" : "Radical Storage lockers",
      url: buildSiteSearchUrl("radicalstorage.com", city)
    },
    {
      provider: "google-maps",
      label: fr ? "Consignes autour de moi" : "Lockers nearby",
      url: buildMapUrl(fr ? "consigne à bagages" : "luggage storage", destinationCity)
    }
  ];
}

/** Airport-to-centre research links: real routes, real timetables, real fares. */
export function buildTransferLinks(destinationCity: string, locale: "fr" | "en"): BookingLink[] {
  const fr = locale === "fr";
  const city = destinationCity.trim();

  return [
    {
      provider: "google-maps",
      label: fr ? "Itinéraire aéroport → centre" : "Airport → centre directions",
      url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
        `${city} airport`
      )}&destination=${encodeURIComponent(`${city} centre`)}&travelmode=transit`
    },
    {
      // Rome2Rio sits behind an aggressive Cloudflare wall that often blocks
      // the visitor, so the second route is a plain search that reliably
      // surfaces the airport-to-centre options and their fares.
      provider: "official",
      label: fr ? "Options et tarifs aéroport → centre" : "Airport → centre options and fares",
      url: `https://www.google.com/search?q=${encodeURIComponent(
        fr ? `aéroport ${city} centre-ville transport prix` : `${city} airport city centre transport price`
      )}`
    }
  ];
}

// Skyscanner URL dates use the compact YYMMDD form.
function toSkyscannerDate(date?: string | null): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return date.slice(2).replace(/-/g, "");
}
