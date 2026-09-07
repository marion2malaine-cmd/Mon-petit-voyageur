import type {
  BookingLink,
  DayRoute,
  ForumFinding,
  FreeVisit,
  InternalFlight,

  ItineraryDay,
  Lodging,
  PaidOption,
  Photo,
  PlanTripResponse,
  RestaurantPick
} from "@mlt/contracts";
import { GUIDE_CSS, icon } from "./theme";
import { stageSummary } from "../skills/itineraryPlanner";

export interface RenderGuideOptions {
  locale: "fr" | "en";
  title?: string;
  /** Mapbox public token; without it the map falls back to Leaflet/OSM. */
  mapboxToken?: string | null;
  /**
   * The static picture of the trip (a data URI once embedded for offline
   * reading). Computed from the token when omitted.
   */
  staticMapSrc?: string | null;
}

interface Strings {
  coverKicker: (profile: string) => string;
  coverSub: (destination: string, days: number, travelers: number) => string;
  statTravelers: string;
  statDays: string;
  statFreeVisits: string;
  statExcursions: string;
  noteFree: string;
  noteOptions: string;
  noteLinks: string;
  stagesTitle: string;
  stagesSub: string;
  stagesDates: string;
  stagesStage: string;
  stagesNights: string;
  stagesLodging: string;
  stagesPrice: string;
  nights: (n: number) => string;
  lodgingTonight: string;
  lodgingChange: string;
  lodgingSame: string;
  routeLabel: string;
  routeStops: string;
  internalFlight: string;

  baseTitle: string;
  baseSub: string;
  baseToBook: string;
  baseToBookDesc: string;
  calendarTitle: string;
  calendarSub: string;
  legendExcursion: string;
  legendRest: string;
  legendTravel: string;
  daysTitle: string;
  daysSub: string;
  timeline: string;
  freeVisits: string;
  paidOptions: string;
  paidOptionsHint: string;
  whereToEat: string;
  verifiedTable: string;
  forumTitle: string;
  forumSub: string;
  tips: string;
  backup: string;
  travelNote: string;
  free: string;
  excursionsTitle: string;
  excursionsSub: string;
  freeBestTitle: string;
  freeBestSub: string;
  restaurantsTitle: string;
  restaurantsSub: string;
  budgetTitle: string;
  budgetSub: string;
  budgetLines: Record<string, string>;
  budgetTotal: string;
  budgetKicker: (travelers: number, days: number) => string;
  budgetHeadline: string;
  budgetEnvelope: string;
  budgetEstimateOnly: string;
  budgetMargin: string;
  budgetOverrun: string;
  budgetTipsTitle: string;
  budgetNote: string;
  tableTitle: (count: number) => string;
  mealLabels: Record<string, string>;
  changeMood: (count: number) => string;
  weatherChange: string;
  practicalTitle: string;
  practicalSub: string;
  entry: string;
  packing: string;
  toVerify: string;
  nextSteps: string;
  linksTitle: string;
  linksSub: string;
  download: string;
  print: string;
  footer: string;
  creditsTitle: string;
  creditsSub: string;
  creditsPexels: string;
  perPerson: string;
  itinerary: string;
  book: string;
  reviews: string;
  dayLabel: (day: number) => string;
  dayWord: string;
  durationLabel: (days: number) => string;
  carTitle: string;
  carOptionalTitle: string;
  carSub: string;
  carCheapest: string;
  carSeats: string;
  carPerDay: string;
  carTotal: string;
  carOverBudget: string;
  carAlerts: string;
  carDocuments: string;
  carTransmission: Record<string, string>;
  carPickupLabels: Record<string, string>;
  cheaperTitle: string;
  resellerNote: string;
  forumTip: string;
  bestChannel: Record<string, string>;
  onSitePrice: string;
  crossingTitle: string;
  crossingFrom: string;
  mapTitle: string;
  mapSub: string;
  mapOffline: string;
  transportTitle: string;
  transportSub: string;
  transportTotal: string;
  transferRecommended: string;
  transferGroup: string;
  transferLast: string;
  transferModes: Record<string, string>;
  cityTransport: string;
  singleTicket: string;
  dayPass: string;
  luggageArrival: string;
  luggageDeparture: string;
  perBag: string;
  transportCost: string;
  ladderTitle: string;
  ladderSub: string;
  ladderSteps: string[];
  forumLinksTitle: string;
}

const STRINGS: Record<"fr" | "en", Strings> = {
  fr: {
    coverKicker: (profile) => profile,
    coverSub: (destination, days, travelers) =>
      `Guide personnalisé pour ${travelers} voyageur${travelers > 1 ? "s" : ""} · ${days} jours à ${destination} · un programme différent chaque jour`,
    statTravelers: "Voyageurs",
    statDays: "Jours",
    statFreeVisits: "Visites gratuites",
    statExcursions: "Activités au choix",
    noteFree: "Toutes les visites culturelles gratuites sont signalées et différentes chaque jour",
    noteOptions: "Chaque journée propose plusieurs options d'activité payante",
    noteLinks: "Chaque activité est réservable via GetYourGuide ou Viator",
    stagesTitle: "Vue d'ensemble",
    stagesSub: "Où vous dormez, nuit après nuit",
    stagesDates: "Dates",
    stagesStage: "Étape",
    stagesNights: "Nuits",
    stagesLodging: "Hôtel",
    stagesPrice: "€ / nuit",
    nights: (n: number) => (n === 1 ? "1 nuit" : `${n} nuits`),
    lodgingTonight: "Vous dormez ici",
    lodgingChange: "Changement d'hôtel — les bagages suivent",
    lodgingSame: "Même hôtel que la veille",
    routeLabel: "Route du jour",
    routeStops: "Sur la route",
    internalFlight: "Vol interne — comparer",

    baseTitle: "Votre base de séjour",
    baseSub: "Le point de départ de toutes les journées",
    baseToBook: "Hébergement à réserver",
    baseToBookDesc:
      "Aucun hébergement n'est encore confirmé. Comparez les disponibilités sur vos dates et réservez avant de figer le programme.",
    calendarTitle: "Votre calendrier",
    calendarSub: "Un thème différent chaque jour, sans jamais répéter une visite",
    legendExcursion: "Journée à thème",
    legendRest: "Journée douce",
    legendTravel: "Arrivée / Départ",
    daysTitle: "Le programme jour par jour",
    daysSub:
      "Chaque journée combine des visites culturelles gratuites, plusieurs options d'activité payante et des tables présélectionnées",
    timeline: "Déroulé de la journée",
    freeVisits: "Visites culturelles gratuites",
    paidOptions: "Activités au choix",
    paidOptionsHint: "Des alternatives pour la même journée : choisissez-en une selon l'envie, la météo et le budget.",
    whereToEat: "Où manger",
    verifiedTable: "Note Google Maps vérifiée",
    forumTitle: "Ce que disent les voyageurs",
    forumSub: "Les fils de discussion TripAdvisor, Routard et Reddit qui ont nourri les conseils de ce guide",
    tips: "Conseils pratiques",
    backup: "Plan B",
    travelNote: "Trajet",
    free: "Gratuit",
    excursionsTitle: "Les excursions phares",
    excursionsSub: "Les incontournables du séjour, réservables en ligne",
    freeBestTitle: "Le meilleur du gratuit",
    freeBestSub: "La sélection des visites culturelles qui ne coûtent rien",
    restaurantsTitle: "Les tables présélectionnées",
    restaurantsSub: "Une sélection par journée, jamais deux fois la même adresse",
    budgetTitle: "Le budget",
    budgetSub: "Estimation pour l'ensemble du séjour",
    budgetLines: {
      transport: "Transport",
      lodging: "Hébergement",
      food: "Restauration",
      local_transit: "Transports sur place",
      activities: "Activités",
      contingency: "Marge de sécurité"
    },
    budgetTotal: "Total estimé",
    budgetKicker: (travelers, days) =>
      `Pour ${travelers === 1 ? "un voyageur" : travelers === 2 ? "deux voyageurs" : `${travelers} voyageurs`} · ${days} jours`,
    budgetHeadline: "Profiter.<br>Garder le cap.",
    budgetEnvelope: "Enveloppe prévue pour le séjour",
    budgetEstimateOnly: "Estimation pour le séjour",
    budgetMargin: "Marge pour les envies spontanées",
    budgetOverrun: "Dépassement à prévoir",
    budgetTipsTitle: "Les bons plans, au bon endroit.",
    budgetNote: "Les montants sont des fourchettes : le carnet distingue les prix trouvés en ligne des estimations.",
    tableTitle: (count) =>
      count === 1 ? "Une pause gourmande" : count === 2 ? "Deux pauses gourmandes" : count === 3 ? "Trois pauses gourmandes" : `${count} pauses gourmandes`,
    mealLabels: { coffee: "Le café du matin", lunch: "La table du midi", dinner: "Le dîner" },
    changeMood: (count) => `Changer d'ambiance : ${count} alternative${count > 1 ? "s" : ""}`,
    weatherChange: "Et si la météo change ?",
    practicalTitle: "Pratique",
    practicalSub: "Formalités, valise et points à confirmer",
    entry: "Formalités d'entrée",
    packing: "À emporter",
    toVerify: "À vérifier avant le départ",
    nextSteps: "Prochaines étapes",
    linksTitle: "Tous vos liens de réservation",
    linksSub: "Vols, hébergements, activités et restaurants",
    download: "Télécharger",
    print: "Imprimer / PDF",
    footer: "Guide généré par Mon Petit Voyageur",
    creditsTitle: "Crédits photos",
    creditsSub: "Les photos de ce guide sont fournies par leurs auteurs sous les licences indiquées",
    creditsPexels: "Photos fournies par Pexels",
    perPerson: "par personne",
    itinerary: "Itinéraire",
    book: "Réserver",
    reviews: "Avis",
    dayLabel: (day) => `Jour ${day}`,
    dayWord: "Jour",
    durationLabel: (days) => `${days} jours`,
    carTitle: "Votre location de voiture",
    carOptionalTitle: "Faut-il louer une voiture ?",
    carSub: "La formule la moins chère compatible avec votre budget et votre groupe",
    carCheapest: "Le meilleur rapport prix / groupe",
    carSeats: "places",
    carPerDay: "jour",
    carTotal: "pour le séjour",
    carOverBudget: "au-dessus de l'enveloppe",
    carAlerts: "À savoir avant de réserver",
    carDocuments: "À présenter au comptoir",
    carTransmission: { manual: "Boîte manuelle", automatic: "Boîte automatique", unknown: "" },
    carPickupLabels: {
      in_terminal: "Comptoirs dans le terminal — vous récupérez les clés sans navette",
      shuttle: "Navette obligatoire — le parking du loueur est hors de l'aéroport",
      off_airport: "Loueur hors aéroport — prévoyez un transfert jusqu'à l'agence",
      unknown: "Point de retrait à confirmer — vérifiez avant de réserver s'il faut prendre une navette"
    },
    mapTitle: "La carte de votre séjour",
    mapSub: "Le tracé de chaque journée, avec ses visites dans l'ordre — cliquez sur un point",
    mapOffline: "La carte a besoin d'une connexion pour s'afficher.",
    transportTitle: "Rejoindre le centre",
    transportSub: "Toutes les options depuis l'aéroport, avec leur prix réel et leur dernier départ",
    transportTotal: "Total transports pour le séjour",
    transferRecommended: "Notre recommandation pour votre groupe",
    transferGroup: "pour le groupe",
    transferLast: "dernier départ",
    transferModes: {
      metro: "Métro", tram: "Tram", train: "Train", bus: "Bus",
      shuttle: "Navette", taxi: "Taxi", vtc: "VTC", walk: "À pied"
    },
    cityTransport: "Se déplacer sur place",
    singleTicket: "le ticket",
    dayPass: "le pass 24 h",
    luggageArrival: "Bagages avant le check-in",
    luggageDeparture: "Bagages après le check-out",
    perBag: "par bagage",
    transportCost: "de trajet",
    cheaperTitle: "Moins cher en direct",
    bestChannel: { on_site: "Le moins cher : sur place", official: "Le moins cher : site officiel", online: "Le moins cher : en ligne" },
    onSitePrice: "sur place",
    crossingTitle: "Traversée en bateau",
    crossingFrom: "départ de",
    resellerNote: "Complet sur le site officiel à votre date ? Les revendeurs ci-dessous (GetYourGuide, Viator, Tiqets) ont souvent encore des places, un peu plus cher.",
    forumTip: "Ce que disent les voyageurs :",
    ladderTitle: "Réserver moins cher",
    ladderSub: "La même expérience se paie rarement au même prix — descendez l'échelle avant de réserver",
    ladderSteps: [
      "Visite libre : beaucoup de « tours » ne font que commenter un lieu dont l'entrée est gratuite.",
      "Transport public + site : un bus et un billet remplacent souvent une excursion facturée trois fois plus cher.",
      "Site officiel du musée ou du monument : le même billet coupe-file, sans commission.",
      "Agence locale, kiosque du port, réception de l'hôtel : 20 à 40 % de moins, souvent le même bateau et le même guide.",
      "Plateforme internationale : le filet de sécurité — confirmation immédiate, annulation gratuite, avis. À privilégier en haute saison."
    ],
    forumLinksTitle: "Vérifier sur les forums voyageurs"
  },
  en: {
    coverKicker: (profile) => profile,
    coverSub: (destination, days, travelers) =>
      `Personalized guide for ${travelers} traveler${travelers > 1 ? "s" : ""} · ${days} days in ${destination} · a different program every day`,
    statTravelers: "Travelers",
    statDays: "Days",
    statFreeVisits: "Free visits",
    statExcursions: "Activity options",
    noteFree: "Every free cultural visit is flagged, and they differ each day",
    noteOptions: "Each day offers several paid activity options",
    noteLinks: "Every activity is bookable through GetYourGuide or Viator",
    stagesTitle: "At a glance",
    stagesSub: "Where you sleep, night after night",
    stagesDates: "Dates",
    stagesStage: "Stage",
    stagesNights: "Nights",
    stagesLodging: "Hotel",
    stagesPrice: "EUR / night",
    nights: (n: number) => (n === 1 ? "1 night" : `${n} nights`),
    lodgingTonight: "Tonight you sleep here",
    lodgingChange: "Hotel change — the bags come along",
    lodgingSame: "Same hotel as last night",
    routeLabel: "Today's drive",
    routeStops: "On the way",
    internalFlight: "Domestic flight — compare",

    baseTitle: "Your home base",
    baseSub: "The starting point of every day",
    baseToBook: "Accommodation to book",
    baseToBookDesc:
      "No stay is confirmed yet. Compare availability on your dates and book before locking the program.",
    calendarTitle: "Your calendar",
    calendarSub: "A different theme every day, never repeating a visit",
    legendExcursion: "Themed day",
    legendRest: "Slow day",
    legendTravel: "Arrival / Departure",
    daysTitle: "The day-by-day program",
    daysSub: "Each day combines free cultural visits, several paid activity options and preselected tables",
    timeline: "How the day unfolds",
    freeVisits: "Free cultural visits",
    paidOptions: "Activities of your choice",
    paidOptionsHint: "Alternatives for the same day: pick one depending on mood, weather and budget.",
    whereToEat: "Where to eat",
    verifiedTable: "Google Maps rating, verified",
    forumTitle: "What travelers say",
    forumSub: "The TripAdvisor, Routard and Reddit threads behind this guide's tips",
    tips: "Practical tips",
    backup: "Plan B",
    travelNote: "Travel",
    free: "Free",
    excursionsTitle: "Headline excursions",
    excursionsSub: "The trip's must-dos, bookable online",
    freeBestTitle: "The best of free",
    freeBestSub: "The pick of cultural visits that cost nothing",
    restaurantsTitle: "Preselected tables",
    restaurantsSub: "A selection per day, never the same address twice",
    budgetTitle: "Budget",
    budgetSub: "Estimate for the whole trip",
    budgetLines: {
      transport: "Transport",
      lodging: "Accommodation",
      food: "Food",
      local_transit: "Local transit",
      activities: "Activities",
      contingency: "Contingency"
    },
    budgetTotal: "Estimated total",
    budgetKicker: (travelers, days) => `For ${travelers} traveller${travelers > 1 ? "s" : ""} · ${days} days`,
    budgetHeadline: "Enjoy.<br>Stay on course.",
    budgetEnvelope: "Envelope planned for the trip",
    budgetEstimateOnly: "Estimate for the trip",
    budgetMargin: "Room for spontaneous treats",
    budgetOverrun: "Expected overrun",
    budgetTipsTitle: "The good deals, right where you need them.",
    budgetNote: "Amounts are ranges: the guide tells prices found online apart from estimates.",
    tableTitle: (count) => `${count} food stop${count > 1 ? "s" : ""}`,
    mealLabels: { coffee: "Morning coffee", lunch: "Lunch", dinner: "Dinner" },
    changeMood: (count) => `Change the mood: ${count} alternative${count > 1 ? "s" : ""}`,
    weatherChange: "What if the weather turns?",
    practicalTitle: "Practical",
    practicalSub: "Formalities, packing and open points",
    entry: "Entry requirements",
    packing: "What to pack",
    toVerify: "To verify before leaving",
    nextSteps: "Next steps",
    linksTitle: "All your booking links",
    linksSub: "Flights, stays, activities and restaurants",
    download: "Download",
    print: "Print / PDF",
    footer: "Guide generated by Mon Petit Voyageur",
    creditsTitle: "Photo credits",
    creditsSub: "The photos in this guide are provided by their authors under the licenses shown",
    creditsPexels: "Photos provided by Pexels",
    perPerson: "per person",
    itinerary: "Directions",
    book: "Book",
    reviews: "Reviews",
    dayLabel: (day) => `Day ${day}`,
    dayWord: "Day",
    durationLabel: (days) => `${days} days`,
    carTitle: "Your car rental",
    carOptionalTitle: "Do you need a car?",
    carSub: "The cheapest option that fits your budget and your group",
    carCheapest: "Best price for the group",
    carSeats: "seats",
    carPerDay: "day",
    carTotal: "for the stay",
    carOverBudget: "above the envelope",
    carAlerts: "Read before booking",
    carDocuments: "To show at the desk",
    carTransmission: { manual: "Manual gearbox", automatic: "Automatic gearbox", unknown: "" },
    carPickupLabels: {
      in_terminal: "Desks inside the terminal — keys without a shuttle",
      shuttle: "Shuttle required — the rental car park is off-airport",
      off_airport: "Off-airport supplier — plan a transfer to the branch",
      unknown: "Pickup point to confirm — check for a shuttle before booking"
    },
    mapTitle: "Your trip on the map",
    mapSub: "Each day's route with its visits in order — click a point",
    mapOffline: "The map needs a connection to load.",
    transportTitle: "Getting to the centre",
    transportSub: "Every option from the airport, with its real fare and its last departure",
    transportTotal: "Transport total for the stay",
    transferRecommended: "Our pick for your group",
    transferGroup: "for the group",
    transferLast: "last departure",
    transferModes: {
      metro: "Metro", tram: "Tram", train: "Train", bus: "Bus",
      shuttle: "Shuttle", taxi: "Taxi", vtc: "Ride-hailing", walk: "On foot"
    },
    cityTransport: "Getting around",
    singleTicket: "single ticket",
    dayPass: "24 h pass",
    luggageArrival: "Luggage before check-in",
    luggageDeparture: "Luggage after check-out",
    perBag: "per bag",
    transportCost: "to get there",
    cheaperTitle: "Cheaper booked direct",
    bestChannel: { on_site: "Cheapest: on the spot", official: "Cheapest: official site", online: "Cheapest: online" },
    onSitePrice: "on the spot",
    crossingTitle: "Boat crossing",
    crossingFrom: "from",
    resellerNote: "Sold out on the official site for your date? The resellers below (GetYourGuide, Viator, Tiqets) often still have tickets, at a slightly higher price.",
    forumTip: "What travelers report:",
    ladderTitle: "Booking it for less",
    ladderSub: "The same experience rarely costs the same — go down the ladder before you book",
    ladderSteps: [
      "Free visit: many \"tours\" only add commentary to a place that is free to enter.",
      "Public transport + site: a bus and a ticket often replace an excursion billed three times higher.",
      "Official site of the museum or monument: the same skip-the-line ticket, without commission.",
      "Local agency, harbour kiosk, hotel desk: 20-40 % less, often the same boat and the same guide.",
      "International platform: the safety net — instant confirmation, free cancellation, reviews. Worth it in high season."
    ],
    forumLinksTitle: "Check the traveler forums"
  }
};

export function renderGuideHtml(plan: PlanTripResponse, options: RenderGuideOptions): string {
  const t = STRINGS[options.locale];
  const structured = (plan.structured_json ?? {}) as any;
  const brief = structured.brief ?? {};
  const itinerary = structured.itinerary ?? {};
  const days: ItineraryDay[] = itinerary.itinerary_by_day ?? [];
  const destination = brief.destination ?? (plan.final_trip_plan as any)?.destination ?? "";
  const travelers = Number(brief.travelers_count ?? 1);

  const freeVisitCount = days.reduce((total, day) => total + (day.free_visits?.length ?? 0), 0);
  const optionCount = days.reduce((total, day) => total + (day.paid_options?.length ?? 0), 0);

  const title = options.title ?? `${destination} — ${t.durationLabel(days.length)}`;

  return `<!doctype html>
<html lang="${options.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${GUIDE_CSS}</style>
</head>
<body>
${renderCover(t, { destination, brief, days: days.length, travelers, freeVisitCount, optionCount })}
${renderStages(t, days, structured, destination, options.locale)}
${renderGroundTransport(t, structured.research?.ground_transport)}
${renderCarRental(t, structured.research?.car_rental)}
${renderCalendar(t, days, options.locale)}
${renderMap(t, days, destination, options.mapboxToken ?? null, options.staticMapSrc ?? null)}
${renderDays(t, days, options.locale, structured.research?.internal_flights ?? [])}

${renderExcursions(t, itinerary.suggested_excursions ?? [])}
${renderBookingLadder(t, structured, destination)}
${renderFreeHighlights(t, itinerary.free_culture_highlights ?? [], days)}
${renderRestaurants(t, days)}
${renderForumFindings(t, itinerary?.forum_findings ?? [])}
${renderBudget(t, structured.budget_estimate, brief, days.length, destination)}
${renderPractical(t, structured, plan)}
${renderLinks(t, structured, itinerary)}
${renderPhotoCredits(t, days, itinerary?.suggested_excursions ?? [])}
<footer class="footer">
  <strong>${escapeHtml(t.footer)}</strong>
  <div>${escapeHtml(destination)}${days.length ? ` · ${days.length} ${options.locale === "fr" ? "jours" : "days"}` : ""}</div>
</footer>
<div class="toolbar">
  <a class="btn" href="#" onclick="window.print();return false;">${icon("print")}${escapeHtml(t.print)}</a>
</div>
</body>
</html>`;
}

function renderCover(
  t: Strings,
  data: {
    destination: string;
    brief: any;
    days: number;
    travelers: number;
    freeVisitCount: number;
    optionCount: number;
  }
): string {
  const styles: string[] = data.brief.traveler_types ?? [];
  const kicker = [...styles.slice(0, 3), data.brief.date_window]
    .filter(Boolean)
    .join(" · ");

  return `<section class="cover">
  <div class="inner">
    <span class="cover-pill">${icon("compass")}${escapeHtml(kicker || t.statDays)}</span>
    <h1 class="cover-title">${escapeHtml(data.destination)}<br><em>${escapeHtml(
      t.durationLabel(data.days)
    )}</em></h1>
    <p class="cover-sub">${escapeHtml(t.coverSub(data.destination, data.days, data.travelers))}</p>
    <div class="stats">
      ${stat(String(data.travelers), t.statTravelers)}
      ${stat(String(data.days), t.statDays)}
      ${stat(String(data.freeVisitCount), t.statFreeVisits)}
      ${stat(String(data.optionCount), t.statExcursions)}
    </div>
    <div class="cover-note">
      <span>${icon("gift")} ${escapeHtml(t.noteFree)}</span>
      <span>${icon("ticket")} ${escapeHtml(t.noteOptions)}</span>
      <span>${icon("arrow")} ${escapeHtml(t.noteLinks)}</span>
    </div>
  </div>
</section>`;
}

function stat(value: string, label: string): string {
  return `<div><div class="stat-value">${escapeHtml(value)}</div><div class="stat-label">${escapeHtml(label)}</div></div>`;
}

/**
 * The overview table of the roadbook: one row per stage, with its nights, its
 * hotel and what the room costs.
 *
 * This is the page the traveler comes back to. A trip that never changes hotel
 * has nothing to tabulate, so it keeps the single "your base" card instead.
 */
function renderStages(
  t: Strings,
  days: ItineraryDay[],
  structured: any,
  destination: string,
  locale: "fr" | "en"
): string {
  const rows = stageSummary(days);
  if (rows.length < 2) return renderBase(t, structured, destination);

  const short = (date: string | null) =>
    date
      ? new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(
          new Date(`${date}T00:00:00Z`)
        )
      : "";

  const body = rows
    .map((row) => {
      const dates = [short(row.dates[0] ?? null), short(row.dates[row.dates.length - 1] ?? null)].filter(Boolean);
      const span = dates.length === 2 && dates[0] !== dates[1] ? `${dates[0]} – ${dates[1]}` : dates[0] ?? "";
      const price =
        row.price_note ??
        (row.price_from
          ? row.price_to && row.price_to !== row.price_from
            ? `${row.price_from}–${row.price_to} €`
            : `${row.price_from} €`
          : "—");
      return `<tr>
        <td>${escapeHtml(span)}</td>
        <td><strong>${escapeHtml(row.stage)}</strong></td>
        <td>${row.nights}</td>
        <td>${escapeHtml(row.lodging ?? "—")}</td>
        <td>${escapeHtml(price)}</td>
      </tr>`;
    })
    .join("");

  return `<section class="band band-deep">
  <div class="inner">
    <h2 class="section-title">${escapeHtml(t.stagesTitle)}</h2>
    <div class="section-rule"></div>
    <p class="section-sub">${escapeHtml(t.stagesSub)}</p>
    <div class="info-card">
      <table class="stages">
        <thead><tr>
          <th>${escapeHtml(t.stagesDates)}</th>
          <th>${escapeHtml(t.stagesStage)}</th>
          <th>${escapeHtml(t.stagesNights)}</th>
          <th>${escapeHtml(t.stagesLodging)}</th>
          <th>${escapeHtml(t.stagesPrice)}</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </div>
</section>`;
}

/** The drive that opens a day: where from, how long, what to stop for. */
function renderRoute(t: Strings, route: DayRoute | null | undefined): string {
  if (!route?.to) return "";
  const heading = [route.from, route.to].filter(Boolean).join(" → ");

  return `<div class="route">
    <div class="chips">
      <span class="chip">${icon(ROUTE_ICONS[route.mode] ?? "car")}${escapeHtml(heading)}</span>
      ${route.duration ? `<span class="chip chip-price">${icon("clock")}${escapeHtml(route.duration)}</span>` : ""}
      ${route.distance_km ? `<span class="chip">${escapeHtml(`${route.distance_km} km`)}</span>` : ""}
      ${route.departure_time ? `<span class="chip">${icon("clock")}${escapeHtml(route.departure_time)}</span>` : ""}
    </div>
    ${route.road_note ? `<p class="muted" style="margin:.5rem 0 0">${escapeHtml(route.road_note)}</p>` : ""}
    ${
      (route.stops ?? []).length
        ? `<p class="muted" style="margin:.35rem 0 0"><strong>${escapeHtml(t.routeStops)} :</strong> ${escapeHtml(
            route.stops.join(" · ")
          )}</p>`
        : ""
    }
  </div>`;
}

/**
 * The comparator links of a flight between two stages of the trip.
 *
 * These legs are never priced live — each live search costs a credit of a
 * small monthly plan — so the guide hands the traveler the pre-filled search
 * instead of a fare it would have had to invent.
 */
function renderInternalFlight(t: Strings, flight: InternalFlight | null): string {
  if (!flight?.search_links?.length) return "";
  const heading = [flight.from, flight.to].filter(Boolean).join(" → ");

  return `<div class="route route-flight">
    <div class="chips">
      <span class="chip">${icon("plane")}${escapeHtml(`${t.internalFlight} · ${heading}`)}</span>
      ${flight.search_links
        .map((link) => `<a class="chip chip-link" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`)
        .join("")}
    </div>
  </div>`;
}

const ROUTE_ICONS: Record<string, string> = {

  car: "car",
  train: "car",
  bus: "car",
  boat: "boat",
  plane: "plane",
  foot: "walk"
};

/**
 * The bed at the end of the day, inside the day itself.
 *
 * The traveler reads the guide one day at a time, so the hotel belongs there
 * and not in a block at the front — and the night the bags move is flagged.
 */
function renderLodging(t: Strings, lodging: Lodging | null | undefined): string {
  if (!lodging?.name) return "";

  const price =
    lodging.price_note ??
    (lodging.price_per_night_eur
      ? lodging.price_max_per_night_eur && lodging.price_max_per_night_eur !== lodging.price_per_night_eur
        ? `${lodging.price_per_night_eur}–${lodging.price_max_per_night_eur} € / nuit`
        : `${lodging.price_per_night_eur} € / nuit`
      : null);

  return `<div class="lodging${lodging.is_change ? " lodging-change" : ""}">
    ${lodging.photo?.url ? `<div class="lodging-photo">${photoTag(lodging.photo, "lodging-photo-fallback")}</div>` : ""}
    <div class="lodging-body">
      <div class="kicker">${escapeHtml(lodging.is_change ? t.lodgingChange : t.lodgingSame)}</div>
      <h4 class="resto-name">${escapeHtml(lodging.name)}</h4>
      ${lodging.town ? `<p class="muted" style="margin:.2rem 0 .5rem">${escapeHtml(lodging.town)}</p>` : ""}
      <div class="chips">
        ${price ? `<span class="chip chip-price">${icon("wallet")}${escapeHtml(price)}</span>` : ""}
        ${lodging.nights ? `<span class="chip">${icon("bed")}${escapeHtml(t.nights(lodging.nights))}</span>` : ""}
        ${lodging.rating ? `<span class="chip">${icon("check")}${escapeHtml(`${lodging.rating}/5`)}</span>` : ""}
      </div>
      ${lodging.why ? `<p class="tl-detail">${escapeHtml(lodging.why)}</p>` : ""}
      ${renderBookingButtons(lodging.booking_links ?? [], true)}
    </div>
  </div>`;
}

function renderBase(t: Strings, structured: any, destination: string): string {
  const stays = structured.research?.recommended_stays ?? [];
  const chosen = Number(structured.research?.chosen_stay_index);
  const stay = stays[Number.isInteger(chosen) && chosen >= 0 && chosen < stays.length ? chosen : 0];
  const stayLink =
    stay?.booking_url ??
    structured.research?.search_links?.find((link: any) => link.category === "stays")?.url ??
    null;

  const body = stay
    ? `${stay.photo_url ? `<img src="${escapeAttr(stay.photo_url)}" alt="${escapeAttr(stay.name)}" style="width:100%;max-height:260px;object-fit:cover;border-radius:12px;margin-bottom:.8rem" />` : ""}
       <h3 class="resto-name" style="font-size:1.4rem">${escapeHtml(stay.name)}</h3>
       <p class="muted" style="margin:.4rem 0 .8rem">${escapeHtml(stay.area ?? destination)}</p>
       <div class="chips">
         ${stay.price_per_night ? chip("wallet", `${stay.price_per_night} ${stay.currency ?? "EUR"} / nuit`) : ""}
         ${stay.rating ? chip("check", `${stay.rating}/5`) : ""}
       </div>`
    : `<h3 class="resto-name" style="font-size:1.4rem">${escapeHtml(t.baseToBook)}</h3>
       <p class="muted" style="margin:.4rem 0 .8rem">${escapeHtml(t.baseToBookDesc)}</p>`;

  return `<section class="band band-deep">
  <div class="inner">
    <h2 class="section-title">${escapeHtml(t.baseTitle)}</h2>
    <div class="section-rule"></div>
    <p class="section-sub">${escapeHtml(t.baseSub)}</p>
    <div class="info-card">
      ${body}
      ${stayLink ? `<div class="btn-row"><a class="btn" href="${escapeAttr(stayLink)}" target="_blank" rel="noreferrer">${icon("bed")}${escapeHtml(t.book)}</a></div>` : ""}
    </div>
  </div>
</section>`;
}

/** Airport transfers and city transit, priced. */
function renderGroundTransport(t: Strings, transport: any): string {
  if (!transport?.airport_to_center?.length && !transport?.city_transport) return "";

  const rows = (transport.airport_to_center ?? [])
    .map((option: any) => {
      const price =
        option.price_note ||
        (option.price_per_person_eur !== null && option.price_per_person_eur !== undefined
          ? `${option.price_per_person_eur} € ${t.perPerson}`
          : "");

      return `<div class="transfer">
        <div class="transfer-head">
          <span class="chip">${icon(TRANSFER_ICONS[option.mode] ?? "car")}${escapeHtml(
            t.transferModes[option.mode] ?? option.mode
          )}</span>
          <strong>${escapeHtml(option.label)}</strong>
        </div>
        <div class="chips">
          ${price ? `<span class="chip chip-price">${icon("wallet")}${escapeHtml(price)}</span>` : ""}
          ${
            option.price_group_eur
              ? `<span class="chip chip-price">${icon("wallet")}${Math.round(option.price_group_eur)} € ${escapeHtml(
                  t.transferGroup
                )}</span>`
              : ""
          }
          ${option.duration ? chip("clock", option.duration) : ""}
          ${option.frequency ? chip("check", option.frequency) : ""}
          ${
            option.last_departure
              ? `<span class="chip chip-warn">${icon("clock")}${escapeHtml(t.transferLast)} ${escapeHtml(
                  option.last_departure
                )}</span>`
              : ""
          }
        </div>
        ${(option.notes ?? []).length ? `<p class="resto-why">${escapeHtml(option.notes.join(" · "))}</p>` : ""}
      </div>`;
    })
    .join("");

  const city = transport.city_transport;

  return `<section class="band band-cream">
  <div class="inner">
    <h2 class="section-title">${escapeHtml(t.transportTitle)}</h2>
    <div class="section-rule"></div>
    <p class="section-sub">${escapeHtml(t.transportSub)}</p>
    ${rows}
    ${
      transport.recommended
        ? `<div class="alert"><div class="alert-title">${icon("check")}${escapeHtml(
            t.transferRecommended
          )}</div><p>${escapeHtml(transport.recommended)}</p></div>`
        : ""
    }
    ${
      city
        ? `<div class="info-card">
            <h4>${escapeHtml(t.cityTransport)}</h4>
            <div class="chips">
              ${city.single_ticket_eur !== null && city.single_ticket_eur !== undefined ? `<span class="chip chip-price">${icon("ticket")}${city.single_ticket_eur} € ${escapeHtml(t.singleTicket)}</span>` : ""}
              ${city.day_pass_eur ? `<span class="chip chip-price">${icon("ticket")}${city.day_pass_eur} € ${escapeHtml(t.dayPass)}</span>` : ""}
              ${city.multi_day_pass ? chip("ticket", city.multi_day_pass) : ""}
            </div>
            ${(city.notes ?? []).length ? `<ul>${city.notes.map((note: string) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>` : ""}
          </div>`
        : ""
    }
    ${
      transport.total_estimate_eur
        ? `<div class="budget-row" style="margin-top:1rem"><span><strong>${escapeHtml(
            t.transportTotal
          )}</strong></span><span>~${Math.round(transport.total_estimate_eur)} €</span></div>`
        : ""
    }
    ${renderBookingButtons(
      (transport.search_links ?? []).map((link: any) => ({
        provider: link.provider,
        label: link.label,
        url: link.url
      }))
    )}
  </div>
</section>`;
}

const TRANSFER_ICONS: Record<string, string> = {
  metro: "arrow",
  tram: "arrow",
  train: "arrow",
  bus: "car",
  shuttle: "car",
  taxi: "car",
  vtc: "car",
  walk: "compass"
};

/** The dead hours before check-in and after check-out, turned into visits. */
function renderLuggage(t: Strings, storage: any): string {
  if (!storage || (!storage.area_hint && !storage.price_note)) return "";

  return `<div class="alert">
    <div class="alert-title">${icon("bed")}${escapeHtml(
      storage.when === "departure" ? t.luggageDeparture : t.luggageArrival
    )}${storage.window ? ` · ${escapeHtml(storage.window)}` : ""}</div>
    ${storage.area_hint ? `<p>${escapeHtml(storage.area_hint)}</p>` : ""}
    <div class="chips" style="margin-top:.5rem">
      ${storage.access_time ? chip("clock", storage.access_time) : ""}
      ${
        storage.price_per_bag_eur !== null && storage.price_per_bag_eur !== undefined
          ? `<span class="chip chip-price">${icon("wallet")}${escapeHtml(
              storage.price_note || `${storage.price_per_bag_eur} € ${t.perBag}`
            )}</span>`
          : storage.price_note
            ? `<span class="chip chip-price">${icon("wallet")}${escapeHtml(storage.price_note)}</span>`
            : ""
      }
      ${
        storage.transport_cost_eur !== null && storage.transport_cost_eur !== undefined
          ? `<span class="chip chip-price">${icon("car")}${storage.transport_cost_eur} € ${escapeHtml(t.transportCost)}</span>`
          : ""
      }
      ${storage.opening_hours ? chip("clock", storage.opening_hours) : ""}
    </div>
    ${storage.transport_note ? `<p>${escapeHtml(storage.transport_note)}</p>` : ""}
    ${(storage.notes ?? []).length ? `<ul>${storage.notes.map((note: string) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>` : ""}
    ${renderBookingButtons(storage.booking_links ?? [])}
  </div>`;
}

function renderCarRental(t: Strings, advice: any): string {
  if (!advice?.recommended && !advice?.options?.length) return "";

  const pickupLabels: Record<string, string> = t.carPickupLabels;
  const optionCards = (advice.options ?? [])
    .map((option: any, index: number) => {
      const isRecommended = option.category === advice.recommended?.category;
      return `<div class="car-option${isRecommended ? " is-recommended" : ""}">
        <div class="car-head">
          <h4>${escapeHtml(option.category)}</h4>
          ${isRecommended ? `<span class="chip chip-free">${icon("check")}${escapeHtml(t.carCheapest)}</span>` : ""}
        </div>
        <div class="chips">
          ${option.seats ? chip("check", `${option.seats} ${t.carSeats}`) : ""}
          ${option.transmission !== "unknown" ? chip("car", t.carTransmission[option.transmission] ?? "") : ""}
          ${
            option.price_per_day_eur
              ? `<span class="chip chip-price">${icon("wallet")}~${Math.round(option.price_per_day_eur)} €/${escapeHtml(
                  t.carPerDay
                )}</span>`
              : ""
          }
          ${
            option.total_estimate_eur
              ? `<span class="chip chip-price">${icon("wallet")}~${Math.round(
                  option.total_estimate_eur
                )} € ${escapeHtml(t.carTotal)}</span>`
              : ""
          }
          ${option.fits_budget ? "" : `<span class="chip chip-warn">${icon("wallet")}${escapeHtml(t.carOverBudget)}</span>`}
        </div>
        ${(option.notes ?? []).length ? `<p class="resto-why">${escapeHtml(option.notes.join(" · "))}</p>` : ""}
        ${index === 0 ? renderBookingButtons(option.booking_links ?? []) : ""}
      </div>`;
    })
    .join("");

  const pickup = advice.recommended?.pickup ?? "unknown";
  const pickupNote = advice.recommended?.pickup_note ?? "";

  return `<section class="band band-soft">
  <div class="inner">
    <h2 class="section-title">${escapeHtml(advice.needed === false ? t.carOptionalTitle : t.carTitle)}</h2>
    <div class="section-rule"></div>
    <p class="section-sub">${escapeHtml(advice.why || t.carSub)}</p>

    ${
      advice.needed === false
        ? ""
        : `<div class="alert alert-pickup">
      <div class="alert-title">${icon("car")}${escapeHtml(pickupLabels[pickup] ?? pickupLabels.unknown)}</div>
      ${pickupNote ? `<p>${escapeHtml(pickupNote)}</p>` : ""}
    </div>`
    }

    ${optionCards}

    ${
      (advice.alerts ?? []).length
        ? `<div class="alert alert-card">
            <div class="alert-title">${icon("wallet")}${escapeHtml(t.carAlerts)}</div>
            <ul>${advice.alerts.map((alert: string) => `<li>${escapeHtml(alert)}</li>`).join("")}</ul>
          </div>`
        : ""
    }
    ${
      (advice.documents ?? []).length
        ? `<div class="tips"><div class="block-title" style="margin-top:0">${icon("check")}${escapeHtml(
            t.carDocuments
          )}</div><ul>${advice.documents.map((doc: string) => `<li>${escapeHtml(doc)}</li>`).join("")}</ul></div>`
        : ""
    }
  </div>
</section>`;
}

function renderCalendar(t: Strings, days: ItineraryDay[], locale: "fr" | "en"): string {
  if (!days.length) return "";

  const tiles = days
    .map((day) => {
      const isEdge = day.day === 1 || day.day === days.length;
      const isRest = /douce|slow|repos|rest/i.test(day.theme ?? "");
      const className = isEdge ? "cal-day is-rest" : isRest ? "cal-day is-rest" : "cal-day is-highlight";
      const parsed = day.date ? new Date(`${day.date}T00:00:00Z`) : null;
      const dow = parsed
        ? new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "short", timeZone: "UTC" }).format(parsed)
        : t.dayWord;
      const num = parsed ? String(parsed.getUTCDate()) : String(day.day);

      return `<div class="${className}">
        <div class="cal-dow">${escapeHtml(dow)}</div>
        <div class="cal-num">${escapeHtml(num)}</div>
        <div class="cal-theme">${escapeHtml(truncate(day.theme || day.title, 18))}</div>
      </div>`;
    })
    .join("");

  return `<section class="band band-cream">
  <div class="inner">
    <h2 class="section-title">${escapeHtml(t.calendarTitle)}</h2>
    <div class="section-rule"></div>
    <p class="section-sub">${escapeHtml(t.calendarSub)}</p>
    <div class="calendar">${tiles}</div>
    <div class="legend">
      <span><i class="dot" style="background:#78a189"></i>${escapeHtml(t.legendExcursion)}</span>
      <span><i class="dot" style="background:#ede3dc;border:1px solid #ddd0c6"></i>${escapeHtml(t.legendRest)}</span>
      <span><i class="dot" style="background:#334d3e"></i>${escapeHtml(t.legendTravel)}</span>
    </div>
  </div>
</section>`;
}

/**
 * An interactive map of the trip: one coloured route per day, joining that
 * day's visits in the order they are done.
 *
 * Mapbox GL renders it when a public token is configured (50 000 loads a
 * month for free); otherwise Leaflet with OpenStreetMap tiles takes over, so
 * the guide always has a map. Both libraries load from the network, so a
 * guide read offline shows the printed program without the map rather than
 * a broken frame — hence the fallback notice inside the container.
 */
function renderMap(
  t: Strings,
  days: ItineraryDay[],
  destination: string,
  mapboxToken: string | null,
  staticMapSrc: string | null
): string {
  const routes = days.map((day) => mapRouteForDay(day)).filter((route) => route.points.length > 0);

  if (!routes.length) return "";

  const payload = JSON.stringify(routes).replace(/</g, "\\u003c");
  // The still picture: what shows before the interactive map loads, when
  // there is no connection, and on paper. Inlined as a data URI in the
  // downloaded guide.
  const still = staticMapSrc;
  const stillTag = still ? `<img class="map-static" src="${escapeAttr(still)}" alt="${escapeAttr(t.mapTitle)}">` : "";
  const section = `<section class="band band-cream">
  <div class="inner">
    <h2 class="section-title">${escapeHtml(t.mapTitle)}</h2>
    <div class="section-rule"></div>
    <p class="section-sub">${escapeHtml(t.mapSub)}</p>
    <div id="trip-map" class="trip-map">${stillTag || `<p class="map-fallback">${escapeHtml(t.mapOffline)}</p>`}</div>
    ${still ? `<div class="map-print">${stillTag}</div>` : ""}
    <div class="chips map-legend" id="trip-map-legend"></div>
  </div>
</section>`;

  return mapboxToken ? section + renderMapboxScript(payload, mapboxToken) : section + renderLeafletScript(payload);
}

export interface MapPoint {
  name: string;
  lat: number;
  lon: number;
  /** A visit or ticketed place is a stop on the walk; a restaurant is a marker beside it. */
  kind: "visit" | "ticket" | "restaurant";
}

export interface MapRoute {
  day: number;
  title: string;
  points: MapPoint[];
}

/**
 * One day on the map: the free visits then the ticketed options, in order,
 * form the walk; the day's tables are placed next to it. Experiences (a
 * cruise, a bike tour) have no fixed address and stay off the map.
 */
export function mapRouteForDay(day: ItineraryDay): MapRoute {
  const located = (item: any) => item?.coordinates && Number.isFinite(item.coordinates.lat) && Number.isFinite(item.coordinates.lon);
  const points: MapPoint[] = [
    ...(day.free_visits ?? []).filter(located).map((visit) => ({ name: visit.name, lat: visit.coordinates!.lat, lon: visit.coordinates!.lon, kind: "visit" as const })),
    ...(day.paid_options ?? [])
      .filter((option: any) => option.kind === "ticket" && located(option))
      .map((option: any) => ({ name: option.title, lat: option.coordinates.lat, lon: option.coordinates.lon, kind: "ticket" as const })),
    ...(day.restaurants ?? []).filter(located).map((resto: any) => ({ name: resto.name, lat: resto.coordinates.lat, lon: resto.coordinates.lon, kind: "restaurant" as const }))
  ];
  return { day: day.day, title: day.title, points };
}

// The day colours, shared by both map engines and by the legend.
const MAP_PALETTE = `["#78a189", "#334d3e", "#c98a4b", "#5b7f9c", "#8d6a9f", "#b0623f", "#4f8a6d", "#7d7f45"]`;

// Builds the legend chip and the popup for a point without innerHTML: titles
// and place names come from the model, so they must stay text.
const MAP_HELPERS = `
  function legendChip(legend, colour, title) {
    if (!legend) return null;
    var chip = document.createElement("span");
    chip.className = "chip";
    var dot = document.createElement("i");
    dot.className = "dot";
    dot.style.background = colour;
    chip.appendChild(dot);
    chip.appendChild(document.createTextNode(title));
    legend.appendChild(chip);
    return chip;
  }
  function popupNode(title, label, name) {
    var popup = document.createElement("div");
    var strong = document.createElement("strong");
    strong.textContent = title;
    popup.appendChild(strong);
    popup.appendChild(document.createElement("br"));
    popup.appendChild(document.createTextNode(label + name));
    return popup;
  }
  function stops(route) { return route.points.filter(function (p) { return p.kind !== "restaurant"; }); }
  function tables(route) { return route.points.filter(function (p) { return p.kind === "restaurant"; }); }
  function walkLabel(meters, seconds) {
    var km = (meters / 1000).toFixed(1).replace(".", ",");
    var minutes = Math.round(seconds / 60);
    var time = minutes >= 60 ? Math.floor(minutes / 60) + " h " + (minutes % 60 ? (minutes % 60) + " min" : "") : minutes + " min";
    return " · " + km + " km · " + time.trim();
  }`;

function renderMapboxScript(payload: string, token: string): string {
  const safeToken = JSON.stringify(token).replace(/</g, "\\u003c");
  return `
<link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/v3.30.0/mapbox-gl.css">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.30.0/mapbox-gl.js"></script>
<script>
(function () {
  var routes = ${payload};
  var container = document.getElementById("trip-map");
  if (!window.mapboxgl || !container) return;
  ${MAP_HELPERS}

  container.innerHTML = "";
  mapboxgl.accessToken = ${safeToken};
  var map = new mapboxgl.Map({
    container: container,
    style: "mapbox://styles/mapbox/outdoors-v12",
    scrollZoom: false,
    attributionControl: true,
    cooperativeGestures: true
  });
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

  var palette = ${MAP_PALETTE};
  var bounds = new mapboxgl.LngLatBounds();
  var legend = document.getElementById("trip-map-legend");

  var chips = [];
  routes.forEach(function (route, index) {
    var colour = palette[index % palette.length];
    stops(route).forEach(function (point, order) {
      bounds.extend([point.lon, point.lat]);
      var el = document.createElement("div");
      el.className = "map-marker";
      el.style.background = colour;
      el.textContent = String(order + 1);
      new mapboxgl.Marker({ element: el })
        .setLngLat([point.lon, point.lat])
        .setPopup(new mapboxgl.Popup({ offset: 14, closeButton: false }).setDOMContent(popupNode(route.title, order + 1 + ". ", point.name)))
        .addTo(map);
    });
    tables(route).forEach(function (point) {
      bounds.extend([point.lon, point.lat]);
      var el = document.createElement("div");
      el.className = "map-marker map-marker-food";
      el.style.borderColor = colour;
      el.style.color = colour;
      el.textContent = "R";
      new mapboxgl.Marker({ element: el })
        .setLngLat([point.lon, point.lat])
        .setPopup(new mapboxgl.Popup({ offset: 14, closeButton: false }).setDOMContent(popupNode(route.title, "", point.name)))
        .addTo(map);
    });
    chips.push(legendChip(legend, colour, route.title));
  });

  // The walk itself, following the streets (Mapbox Directions, walking
  // profile). A failed request falls back to straight segments.
  function straight(route) {
    return { type: "LineString", coordinates: stops(route).map(function (p) { return [p.lon, p.lat]; }) };
  }
  function walkingRoute(route) {
    var coords = stops(route).slice(0, 25).map(function (p) { return p.lon + "," + p.lat; }).join(";");
    var url = "https://api.mapbox.com/directions/v5/mapbox/walking/" + coords + "?geometries=geojson&overview=full&access_token=" + encodeURIComponent(mapboxgl.accessToken);
    return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (json) {
      var best = json && json.routes && json.routes[0];
      return best ? { geometry: best.geometry, distance: best.distance, duration: best.duration } : null;
    }).catch(function () { return null; });
  }

  map.on("load", function () {
    routes.forEach(function (route, index) {
      if (stops(route).length < 2) return;
      var id = "route-" + index;
      map.addSource(id, { type: "geojson", data: { type: "Feature", properties: {}, geometry: straight(route) } });
      map.addLayer({
        id: id, type: "line", source: id,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": palette[index % palette.length], "line-width": 4, "line-opacity": 0.85 }
      });
      walkingRoute(route).then(function (walk) {
        if (!walk) return;
        map.getSource(id).setData({ type: "Feature", properties: {}, geometry: walk.geometry });
        if (chips[index]) chips[index].appendChild(document.createTextNode(walkLabel(walk.distance, walk.duration)));
      });
    });
  });

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 0 });
  } else {
    map.setCenter([0, 0]); map.setZoom(1);
  }
})();
</script>`;
}

function renderLeafletScript(payload: string): string {
  return `
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H"
      crossorigin="anonymous">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH"
        crossorigin="anonymous"></script>
<script>
(function () {
  var routes = ${payload};
  var container = document.getElementById("trip-map");
  if (!window.L || !container) return;
  ${MAP_HELPERS}

  container.innerHTML = "";
  var map = L.map(container, { scrollWheelZoom: false });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  var palette = ${MAP_PALETTE};
  var bounds = [];
  var legend = document.getElementById("trip-map-legend");

  routes.forEach(function (route, index) {
    var colour = palette[index % palette.length];
    var latlngs = stops(route).map(function (p) { return [p.lat, p.lon]; });
    bounds = bounds.concat(latlngs);

    if (latlngs.length > 1) {
      L.polyline(latlngs, { color: colour, weight: 4, opacity: 0.85 }).addTo(map);
    }

    stops(route).forEach(function (point, order) {
      L.circleMarker([point.lat, point.lon], {
        radius: 9, color: "#fff", weight: 2, fillColor: colour, fillOpacity: 1
      })
        .addTo(map)
        .bindPopup(popupNode(route.title, order + 1 + ". ", point.name));
    });
    tables(route).forEach(function (point) {
      bounds.push([point.lat, point.lon]);
      L.circleMarker([point.lat, point.lon], {
        radius: 6, color: colour, weight: 2, fillColor: "#fff", fillOpacity: 1
      })
        .addTo(map)
        .bindPopup(popupNode(route.title, "", point.name));
    });

    legendChip(legend, colour, route.title);
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [30, 30] });
  } else {
    map.setView([0, 0], 2);
  }
})();
</script>`;
}

function renderDays(
  t: Strings,
  days: ItineraryDay[],
  locale: "fr" | "en",
  internalFlights: InternalFlight[] = []
): string {
  if (!days.length) return "";

  // A flown leg is read inside its own day, next to the drive it replaces.
  const flightsByDay = new Map(internalFlights.map((flight) => [flight.day, flight]));
  const cards = days.map((day) => renderDay(t, day, locale, flightsByDay.get(day.day) ?? null)).join("");


  return `<section class="band band-cream">
  <div class="inner">
    <h2 class="section-title">${escapeHtml(t.daysTitle)}</h2>
    <p class="section-sub">${escapeHtml(t.daysSub)}</p>
    ${cards}
  </div>
</section>`;
}

/**
 * One day laid out like a page of the printed carnet: the date and place as
 * a kicker, the title set in serif, the day's walk as a dotted timeline and
 * the tables of the day in a panel beside it. Alternatives and the plan B
 * fold away so the page reads calmly.
 */
function renderDay(t: Strings, day: ItineraryDay, locale: "fr" | "en", internalFlight: InternalFlight | null = null): string {

  const dateLabel = day.date
    ? new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC"
      }).format(new Date(`${day.date}T00:00:00Z`))
    : t.dayLabel(day.day);
  const kicker = [dateLabel, day.area].filter(Boolean).join(" · ");
  const subtitle = day.narrative || [day.theme, day.area].filter(Boolean).join(" · ");

  const steps = (day.timeline ?? []).length
    ? day.timeline.map((step) => ({ time: step.time, label: step.label, detail: step.detail }))
    : [
        { time: "", label: day.morning, detail: "" },
        { time: "", label: day.afternoon, detail: "" },
        { time: "", label: day.evening, detail: "" }
      ];
  const timeline = `<ol class="timeline">${steps
    .map(
      (step) => `<li class="tl-step">
      <div class="tl-time">${escapeHtml([step.time, day.theme].filter(Boolean).join(" · "))}</div>
      <h4 class="tl-label">${escapeHtml(step.label)}</h4>
      ${step.detail ? `<p class="tl-detail">${escapeHtml(step.detail)}</p>` : ""}
    </li>`
    )
    .join("")}</ol>`;

  const options = day.paid_options ?? [];

  return `<article class="day">
  ${day.photo?.url ? `<div class="day-hero">${photoTag(day.photo, "day-hero-fallback")}</div>` : ""}
  <header class="day-head">
    <div class="kicker">${escapeHtml(kicker)}</div>
    <h3 class="day-title">${escapeHtml(day.title)}</h3>
    ${subtitle ? `<p class="day-sub">${escapeHtml(subtitle)}</p>` : ""}
  </header>
  <div class="day-body">
    ${renderRoute(t, day.route)}
    ${renderInternalFlight(t, internalFlight)}

    ${renderLuggage(t, day.luggage_storage)}
    ${!day.route && day.travel_note ? `<div class="chips">${chip("car", `${t.travelNote} · ${day.travel_note}`)}</div>` : ""}
    <div class="day-columns">
      <div class="day-main">${timeline}</div>
      ${renderDayRestaurants(t, day.restaurants ?? [])}
    </div>
    ${renderFreeVisits(t, day.free_visits ?? [])}
    ${renderLodging(t, day.lodging)}
    ${
      options.length
        ? `<details class="fold">
      <summary>${escapeHtml(t.changeMood(options.length))}</summary>
      <div class="fold-body">${renderPaidOptions(t, options)}</div>
    </details>`
        : ""
    }
    ${
      day.backup_option || (day.practical_tips ?? []).length
        ? `<details class="fold">
      <summary>${escapeHtml(t.weatherChange)}</summary>
      <div class="fold-body">
        ${day.backup_option ? `<p class="backup"><strong>${escapeHtml(t.backup)} :</strong> ${escapeHtml(day.backup_option)}</p>` : ""}
        ${
          (day.practical_tips ?? []).length
            ? `<div class="tips"><div class="block-title" style="margin-top:0">${icon("check")}${escapeHtml(
                t.tips
              )}</div><ul>${day.practical_tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}</ul></div>`
            : ""
        }
      </div>
    </details>`
        : ""
    }
  </div>
</article>`;
}

function renderFreeVisits(t: Strings, visits: FreeVisit[]): string {
  if (!visits.length) return "";

  const cards = visits
    .map(
      (visit) => `<div class="free-card">
      <div class="free-thumb">${photoTag(visit.photo, "free-thumb-fallback")}</div>
      <div class="free-body">
        <p class="free-name">${escapeHtml(visit.name)}</p>
        <p class="free-desc">${escapeHtml(visit.description)}</p>
        <div class="free-meta">
          <span class="chip chip-free">${icon("gift")}${escapeHtml(visit.free_note || t.free)}</span>
          ${visit.duration ? chip("clock", visit.duration) : ""}
        </div>
        ${
          visit.map_url
            ? `<div class="btn-row"><a class="btn btn-ghost" href="${escapeAttr(visit.map_url)}" target="_blank" rel="noreferrer">${icon(
                "map"
              )}${escapeHtml(t.itinerary)}</a></div>`
            : ""
        }
      </div>
    </div>`
    )
    .join("");

  return `<div class="block-title">${icon("gift")}${escapeHtml(t.freeVisits)} · ${visits.length}</div>
  <div class="free-grid">${cards}</div>`;
}

const CATEGORY_LABELS: Record<"fr" | "en", Record<string, string>> = {
  fr: { culture: "Culture", sport: "Sport", discovery: "Découverte", relax: "Farniente", food: "Gastronomie" },
  en: { culture: "Culture", sport: "Sport", discovery: "Discovery", relax: "Leisure", food: "Food" }
};

function renderPaidOptions(t: Strings, opts: PaidOption[]): string {
  if (!opts.length) return "";

  const cards = opts
    .map((option, index) => {
      const variant = index === 0 ? "option-a" : index === 1 ? "option-b" : "";
      return `<div class="option ${variant}">
      <div class="option-photo">${photoTag(option.photo, "option-photo-fallback")}</div>
      <div class="option-body">
        <div class="option-label">${escapeHtml(option.option_label)}</div>
        <h4 class="option-title">${escapeHtml(option.title)}</h4>
        <p class="option-desc">${escapeHtml(option.description)}</p>
        <div class="chips">
          ${option.category ? chip("check", CATEGORY_LABELS[t.dayWord === "Jour" ? "fr" : "en"][option.category] ?? option.category) : ""}
          ${option.duration ? chip("clock", option.duration) : ""}
          ${
            option.price_from_eur !== null && option.price_from_eur !== undefined
              ? `<span class="chip chip-price">${icon("ticket")}${escapeHtml(
                  option.price_note ?? `${option.price_from_eur} € ${t.perPerson}`
                )}</span>`
              : ""
          }
          ${(option.suited_for ?? []).map((tag) => chip("check", tag)).join("")}
        </div>
        ${renderLocalAlternative(t, option.local_alternative, option.crossing)}
        ${option.kind === "ticket" ? renderTicketButtons(t, option.booking_links ?? []) : renderBookingButtons(option.booking_links ?? [])}
      </div>
    </div>`;
    })
    .join("");

  return `<div class="block-title" style="margin-top:0">${icon("ticket")}${escapeHtml(t.paidOptions)}</div>
  <p class="free-desc" style="margin-top:-.4rem">${escapeHtml(t.paidOptionsHint)}</p>
  ${cards}`;
}

/** The cheaper route for one activity: local operator, official site, forums. */
function renderLocalAlternative(t: Strings, alternative: any, crossing?: any): string {
  if (!alternative?.how_to_book && !alternative?.forum_tip && !alternative?.advice && !crossing?.from_port) return "";

  const channel = alternative?.best_channel && t.bestChannel[alternative.best_channel];
  const onSite = alternative?.on_site_price_eur != null ? `<span class="chip chip-free">${escapeHtml(`${alternative.on_site_price_eur} € ${t.onSitePrice}`)}</span>` : "";

  return `<div class="saving">
    <div class="saving-head">${icon("wallet")}${escapeHtml(channel || t.cheaperTitle)}${onSite}${
      alternative?.typical_saving
        ? `<span class="chip chip-free">${escapeHtml(alternative.typical_saving)}</span>`
        : ""
    }</div>
    ${alternative?.advice ? `<p><strong>${escapeHtml(alternative.advice)}</strong></p>` : ""}
    ${alternative?.how_to_book ? `<p>${escapeHtml(alternative.how_to_book)}</p>` : ""}
    ${
      crossing?.from_port
        ? `<p class="saving-forum">${icon("compass")}${escapeHtml(t.crossingTitle)} — ${escapeHtml(t.crossingFrom)} ${escapeHtml(crossing.from_port)}${
            crossing.price_eur != null ? ` · ${escapeHtml(String(crossing.price_eur))} € ${escapeHtml(t.perPerson)}` : ""
          }${crossing.note ? `. ${escapeHtml(crossing.note)}` : ""}</p>`
        : ""
    }
    ${
      alternative.forum_tip
        ? `<p class="saving-forum">${icon("compass")}${escapeHtml(t.forumTip)} ${escapeHtml(alternative.forum_tip)}</p>`
        : ""
    }
  </div>`;
}

const MEAL_ORDER: Record<string, number> = { coffee: 0, lunch: 1, dinner: 2 };

/** The tables of the day, in the order of the meals, as a panel beside the walk. */
function renderDayRestaurants(t: Strings, restaurants: RestaurantPick[]): string {
  if (!restaurants.length) return "";

  const sorted = [...restaurants].sort((a, b) => (MEAL_ORDER[a.meal] ?? 9) - (MEAL_ORDER[b.meal] ?? 9));
  const rows = sorted
    .map((resto) => {
      const link = resto.booking_links?.[0]?.url ?? resto.maps_url ?? resto.website;
      const name = link
        ? `<a href="${escapeAttr(link)}" target="_blank" rel="noreferrer">${escapeHtml(resto.name)}</a>`
        : escapeHtml(resto.name);
      const meta = [resto.cuisine, resto.area ?? resto.address, resto.price_range].filter(Boolean).join(" · ");
      const links = (resto.booking_links ?? [])
        .map(
          (l) => `<a href="${escapeAttr(l.url)}" target="_blank" rel="noreferrer">${escapeHtml(l.label)}</a>`
        )
        .join(" · ");
      return `<div class="table-row">
      ${resto.photo?.url ? `<div class="table-thumb">${photoTag(resto.photo, "resto-photo-fallback")}</div>` : ""}
      <div class="table-body">
        <div class="table-meal">${escapeHtml(t.mealLabels[resto.meal] ?? t.mealLabels.dinner)}</div>
        <div class="table-name">${name}${
          resto.rating != null ? `<span class="table-rating">★ ${escapeHtml(resto.rating)}</span>` : ""
        }</div>
        <div class="table-meta">${escapeHtml(meta)}</div>
        ${links ? `<div class="table-links">${links}</div>` : ""}
      </div>
    </div>`;
    })
    .join("");

  return `<aside class="tables">
    <div class="kicker">${escapeHtml(t.whereToEat)}</div>
    <h4 class="tables-title">${escapeHtml(t.tableTitle(sorted.length))}</h4>
    ${rows}
  </aside>`;
}

function renderRestaurantCard(t: Strings, resto: RestaurantPick): string {
  return `<div class="resto">
    <div class="resto-photo">${photoTag(resto.photo, "resto-photo-fallback")}</div>
    <div class="resto-body">
      <div class="resto-head">
        <h4 class="resto-name">${escapeHtml(resto.name)}</h4>
        <span class="resto-price">${escapeHtml(resto.price_range)}</span>
      </div>
      <p class="resto-cuisine">${escapeHtml(
        [
          resto.rating != null ? `★ ${resto.rating}${resto.reviews_count ? ` (${resto.reviews_count} ${t.reviews.toLowerCase()})` : ""}` : null,
          resto.cuisine,
          resto.address ?? resto.area
        ]
          .filter(Boolean)
          .join(" · ")
      )}</p>
      ${resto.verified ? `<div class="chips">${chip("check", t.verifiedTable)}</div>` : ""}
      ${resto.why ? `<p class="resto-why">${escapeHtml(resto.why)}</p>` : ""}
      <div class="chips">${(resto.tags ?? []).map((tag) => chip("check", tag)).join("")}</div>
      ${renderBookingButtons(resto.booking_links ?? [])}
    </div>
  </div>`;
}

const PROVIDER_ICONS: Record<string, string> = {
  "google-maps": "map",
  discovercars: "car",
  kayak: "car",
  rentalcars: "car",
  thefork: "fork",
  tripadvisor: "fork",
  tiqets: "ticket",
  official: "ticket"
};

/**
 * A ticketed place: the official site alone on the first row (the cheapest
 * way in), then a note and the resellers, for when the official site has no
 * tickets left on the chosen date.
 */
function renderTicketButtons(t: Strings, links: BookingLink[]): string {
  const official = links.filter((link) => link.provider === "official");
  const resellers = links.filter((link) => link.provider !== "official");
  if (!official.length) return renderBookingButtons(links);
  return `${renderBookingButtons(official)}${
    resellers.length
      ? `<p class="reseller-note">${icon("info")}${escapeHtml(t.resellerNote)}</p>${renderBookingButtons(resellers, true)}`
      : ""
  }`;
}

function renderBookingButtons(links: BookingLink[], allGhost = false): string {
  if (!links.length) return "";
  return `<div class="btn-row">${links
    .map(
      (link, index) =>
        `<a class="btn ${index === 0 && !allGhost ? "" : "btn-ghost"}" href="${escapeAttr(link.url)}" target="_blank" rel="noreferrer">${icon(
          PROVIDER_ICONS[link.provider] ?? "arrow"
        )}${escapeHtml(link.label)}</a>`
    )
    .join("")}</div>`;
}

function renderExcursions(t: Strings, excursions: any[]): string {
  if (!excursions.length) return "";

  const cards = excursions
    .map(
      (excursion) => `<div class="option option-a">
      <div class="option-photo">${photoTag(excursion.photo, "option-photo-fallback")}</div>
      <div class="option-body">
        <div class="option-label">${escapeHtml(excursion.style ?? "")}</div>
        <h4 class="option-title">${escapeHtml(excursion.title)}</h4>
        <p class="option-desc">${escapeHtml(excursion.description)}</p>
        <div class="chips">
          ${excursion.duration ? chip("clock", excursion.duration) : ""}
          ${
            excursion.price_estimate_eur !== null && excursion.price_estimate_eur !== undefined
              ? `<span class="chip chip-price">${icon("ticket")}~${escapeHtml(
                  String(excursion.price_estimate_eur)
                )} € ${escapeHtml(t.perPerson)}</span>`
              : ""
          }
        </div>
        ${renderBookingButtons(excursion.booking_links ?? [])}
      </div>
    </div>`
    )
    .join("");

  return `<section class="band band-cream">
  <div class="inner">
    <h2 class="section-title">${escapeHtml(t.excursionsTitle)}</h2>
    <div class="section-rule"></div>
    <p class="section-sub">${escapeHtml(t.excursionsSub)}</p>
    ${cards}
  </div>
</section>`;
}

/**
 * The method, once, for the whole trip: how to pay less for the same thing,
 * with the forum searches that let the traveler check it before booking.
 */
function renderBookingLadder(t: Strings, structured: any, destination: string): string {
  if (!destination) return "";

  const forumLinks = [
    ...(structured.research?.search_links ?? []),
    ...(structured.itinerary?.experience_links ?? [])
  ].filter((link: any) => link.category === "forums");

  const steps = t.ladderSteps
    .map(
      (step, index) =>
        `<li><span class="ladder-step">${index + 1}</span><span>${escapeHtml(step)}</span></li>`
    )
    .join("");

  return `<section class="band band-soft">
  <div class="inner">
    <h2 class="section-title">${escapeHtml(t.ladderTitle)}</h2>
    <div class="section-rule"></div>
    <p class="section-sub">${escapeHtml(t.ladderSub)}</p>
    <ol class="ladder">${steps}</ol>
    ${
      forumLinks.length
        ? `<div class="alert">
            <div class="alert-title">${icon("compass")}${escapeHtml(t.forumLinksTitle)}</div>
            <div class="btn-row">${forumLinks
              .map(
                (link: any) =>
                  `<a class="btn btn-ghost" href="${escapeAttr(link.url)}" target="_blank" rel="noreferrer">${icon(
                    "arrow"
                  )}${escapeHtml(link.label)}</a>`
              )
              .join("")}</div>
          </div>`
        : ""
    }
  </div>
</section>`;
}

function renderFreeHighlights(t: Strings, highlights: string[], days: ItineraryDay[]): string {
  const names = highlights.length
    ? highlights
    : [...new Set(days.flatMap((day) => (day.free_visits ?? []).map((visit) => visit.name)))].slice(0, 8);
  if (!names.length) return "";

  return `<section class="band band-deep">
  <div class="inner">
    <h2 class="section-title">${escapeHtml(t.freeBestTitle)}</h2>
    <div class="section-rule"></div>
    <p class="section-sub">${escapeHtml(t.freeBestSub)}</p>
    <div class="chips" style="justify-content:center">
      ${names.map((name) => `<span class="chip">${icon("gift")}${escapeHtml(name)}</span>`).join("")}
    </div>
  </div>
</section>`;
}

function renderRestaurants(t: Strings, days: ItineraryDay[]): string {
  const all = days.flatMap((day) => day.restaurants ?? []);
  if (!all.length) return "";

  const seen = new Set<string>();
  const unique = all.filter((resto) => {
    const key = resto.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return `<section class="band band-cream">
  <div class="inner">
    <h2 class="section-title">${escapeHtml(t.restaurantsTitle)}</h2>
    <div class="section-rule"></div>
    <p class="section-sub">${escapeHtml(t.restaurantsSub)}</p>
    <div class="resto-grid">${unique.map((resto) => renderRestaurantCard(t, resto)).join("")}</div>
  </div>
</section>`;
}

// The real threads the tips were grounded in, so the traveler can read the
// whole discussion rather than trust a one-line summary.
function renderForumFindings(t: Strings, findings: ForumFinding[]): string {
  if (!findings.length) return "";

  return `<section class="band">
  <div class="inner">
    <h2 class="section-title">${escapeHtml(t.forumTitle)}</h2>
    <div class="section-rule"></div>
    <p class="section-sub">${escapeHtml(t.forumSub)}</p>
    <div class="resto-grid">${findings
      .slice(0, 8)
      .map(
        (finding) => `<div class="resto"><div class="resto-body">
        <div class="chips">${chip("check", finding.source || "Forum")}</div>
        <h4 class="resto-name">${escapeHtml(finding.title)}</h4>
        ${finding.snippet ? `<p class="resto-why">${escapeHtml(finding.snippet)}</p>` : ""}
        ${renderBookingButtons([{ provider: "forum", label: t.forumTitle.split(" ")[0] === "Ce" ? "Lire le fil" : "Read the thread", url: finding.url }])}
      </div></div>`
      )
      .join("")}</div>
  </div>
</section>`;
}

function renderBudget(t: Strings, budget: any, brief: any, dayCount: number, destination: string): string {
  if (!budget?.budget_breakdown) return "";

  const rows = Object.entries(budget.budget_breakdown)
    .map(([key, range]) => {
      const [min, max] = range as [number, number];
      const label = t.budgetLines[key] ?? key;
      return `<div class="budget-row"><span>${escapeHtml(label)}</span><span>${fmtRange(min, max)}</span></div>`;
    })
    .join("");

  const total = budget.estimated_total;
  const envelope = Number(brief?.budget_total) > 0 ? Number(brief.budget_total) : null;
  const travelers = Number(brief?.travelers_count ?? 1);
  const headlineAmount = envelope ?? (total ? Math.round((total.min + total.max) / 2) : null);
  const margin = envelope && total ? envelope - Math.round(total.max) : null;
  const tips: string[] = [...(budget.optimization_options ?? []), ...(budget.pressure_points ?? [])].slice(0, 4);

  return `<section class="band band-cream">
  <div class="inner">
    <div class="running-head"><span>${escapeHtml([destination, t.budgetTitle].filter(Boolean).join(" / "))}</span></div>
    <div class="kicker">${escapeHtml(t.budgetKicker(travelers, dayCount))}</div>
    <h2 class="page-title">${t.budgetHeadline}</h2>
    ${
      headlineAmount != null
        ? `<div class="budget-amount">${fmtEuro(headlineAmount)}</div>
    <p class="budget-amount-label">${escapeHtml(envelope ? t.budgetEnvelope : t.budgetEstimateOnly)}</p>`
        : ""
    }
    <div class="budget-table">
      ${rows}
      ${
        total
          ? `<div class="budget-row budget-total"><span>${escapeHtml(t.budgetTotal)}</span><span>${fmtRange(
              total.min,
              total.max
            )}</span></div>`
          : ""
      }
      ${
        margin != null
          ? `<div class="budget-row"><span>${escapeHtml(margin >= 0 ? t.budgetMargin : t.budgetOverrun)}</span><span>${fmtEuro(
              Math.abs(margin)
            )}</span></div>`
          : ""
      }
    </div>
    ${
      tips.length
        ? `<div class="callout">
      <p class="callout-title">${escapeHtml(t.budgetTipsTitle)}</p>
      ${tips.map((tip) => `<p>${escapeHtml(tip)}</p>`).join("")}
    </div>`
        : ""
    }
    <p class="footnote">${escapeHtml(t.budgetNote)}</p>
  </div>
</section>`;
}

function fmtEuro(value: number): string {
  return `${Math.round(value).toLocaleString("fr-FR").replace(/ | /g, " ")} €`;
}

function fmtRange(min: number, max: number): string {
  return Math.round(min) === Math.round(max) ? fmtEuro(min) : `${fmtEuro(min).replace(" €", "")} – ${fmtEuro(max)}`;
}

function renderPractical(t: Strings, structured: any, plan: PlanTripResponse): string {
  const entry = structured.entry_requirements;
  const packing = structured.packing_checklist;

  const cards: string[] = [];

  if (entry?.requirements_summary?.length) {
    cards.push(infoCard(t.entry, entry.requirements_summary));
  }
  if (packing) {
    const items = [
      ...(packing.essentials ?? []),
      ...(packing.documents ?? []),
      ...(packing.health_and_safety ?? [])
    ].slice(0, 10);
    if (items.length) cards.push(infoCard(t.packing, items));
  }
  if (plan.open_verifications?.length) {
    cards.push(infoCard(t.toVerify, plan.open_verifications));
  }
  if (plan.next_steps?.length) {
    cards.push(infoCard(t.nextSteps, plan.next_steps));
  }

  if (!cards.length) return "";

  return `<section class="band band-cream">
  <div class="inner">
    <h2 class="section-title">${escapeHtml(t.practicalTitle)}</h2>
    <div class="section-rule"></div>
    <p class="section-sub">${escapeHtml(t.practicalSub)}</p>
    <div class="info-grid">${cards.join("")}</div>
  </div>
</section>`;
}

function infoCard(title: string, items: string[]): string {
  return `<div class="info-card">
    <h4>${escapeHtml(title)}</h4>
    <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </div>`;
}

function renderLinks(t: Strings, structured: any, itinerary: any): string {
  const links = [...(structured.research?.search_links ?? []), ...(itinerary.experience_links ?? [])];
  if (!links.length) return "";

  const seen = new Set<string>();
  const unique = links.filter((link: any) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });

  return `<section class="band band-deep">
  <div class="inner">
    <h2 class="section-title">${escapeHtml(t.linksTitle)}</h2>
    <div class="section-rule"></div>
    <p class="section-sub">${escapeHtml(t.linksSub)}</p>
    <div class="chips" style="justify-content:center">
      ${unique
        .map(
          (link: any) =>
            `<a class="chip" href="${escapeAttr(link.url)}" target="_blank" rel="noreferrer" style="text-decoration:none">${icon(
              "arrow"
            )}${escapeHtml(link.label)}</a>`
        )
        .join("")}
    </div>
  </div>
</section>`;
}

/** Every photo shown in the guide, in reading order, without duplicates. */
export function collectPhotos(days: ItineraryDay[], excursions: any[]): Photo[] {
  const seen = new Set<string>();
  const photos: Photo[] = [];
  const add = (photo: Photo | null | undefined) => {
    if (!photo?.url || !photo.credit || seen.has(photo.url)) return;
    seen.add(photo.url);
    photos.push(photo);
  };
  for (const day of days) {
    add(day.photo);
    (day.free_visits ?? []).forEach((visit) => add(visit.photo));
    (day.paid_options ?? []).forEach((option: any) => add(option.photo));
    (day.restaurants ?? []).forEach((resto: any) => add(resto.photo));
  }
  excursions.forEach((excursion) => add(excursion.photo));
  return photos;
}

/**
 * Photo credits: author, source page and license for every image, as the
 * photo libraries (Pexels, Unsplash, Openverse) and Wikimedia licenses
 * require. Pexels additionally asks for a link back to pexels.com.
 */
function renderPhotoCredits(t: Strings, days: ItineraryDay[], excursions: any[]): string {
  const photos = collectPhotos(days, excursions);
  if (!photos.length) return "";

  const usesPexels = photos.some((photo) => /pexels/i.test(photo.credit ?? "") || /pexels\.com/i.test(photo.source_url ?? ""));
  const items = photos
    .map((photo) => {
      const label = escapeHtml(photo.credit ?? "");
      const link = photo.source_url
        ? `<a href="${escapeAttr(photo.source_url)}" target="_blank" rel="noopener">${label}</a>`
        : label;
      const license = photo.license ? ` <span class="credit-license">${escapeHtml(photo.license)}</span>` : "";
      return `<li>${link}${license}</li>`;
    })
    .join("");

  return `<section class="band band-cream credits">
  <div class="inner">
    <h2 class="section-title">${escapeHtml(t.creditsTitle)}</h2>
    <div class="section-rule"></div>
    <p class="section-sub">${escapeHtml(t.creditsSub)}</p>
    ${usesPexels ? `<p class="credits-provider"><a href="https://www.pexels.com" target="_blank" rel="noopener">${escapeHtml(t.creditsPexels)}</a></p>` : ""}
    <ul class="credits-list">${items}</ul>
  </div>
</section>`;
}

function photoTag(photo: Photo | null | undefined, fallbackClass: string): string {
  if (!photo?.url) {
    return `<div class="${fallbackClass}"></div>`;
  }
  const alt = escapeAttr(photo.query ?? "");
  const title = photo.credit ? ` title="${escapeAttr(photo.credit)}"` : "";
  return `<img src="${escapeAttr(photo.url)}" alt="${alt}"${title} loading="lazy">`;
}

function chip(iconName: string, label: string): string {
  return `<span class="chip">${icon(iconName)}${escapeHtml(label)}</span>`;
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/^Jour \d+\s*[—-]\s*/i, "").replace(/^Day \d+\s*[—-]\s*/i, "");
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value);
}
