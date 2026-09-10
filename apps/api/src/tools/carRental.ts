import type { BookingLink, CarRentalAdvice, CarRentalOption, SearchLink } from "@mlt/contracts";

export interface CarRentalInput {
  destinationCity: string;
  locale: "fr" | "en";
  travelers: number;
  durationDays: number;
  /** What the budget leaves for ground transport over the whole stay. */
  envelope?: { min: number; max: number } | null;
  pickupDate?: string | null;
  returnDate?: string | null;
  /**
   * How many different areas the program visits. A trip that never leaves one
   * city does not need a car, and saying so is worth more than renting one.
   */
  distinctAreas?: number;
}

// Indicative August/high-season daily rates for a small local agency, used to
// rank categories by price. Real prices come from the comparison sites the
// links point to; these only decide which category is proposed first.
const CATEGORIES: Array<{
  fr: string;
  en: string;
  seats: number;
  pricePerDay: number;
  transmission: "manual" | "automatic";
  /** A model the agencies actually hand over in that category. */
  model: string;
}> = [
  { fr: "Citadine (2 portes)", en: "City car (2 doors)", seats: 4, pricePerDay: 28, transmission: "manual", model: "Fiat Panda" },
  { fr: "Compacte 5 portes", en: "Compact 5-door", seats: 5, pricePerDay: 38, transmission: "manual", model: "Toyota Yaris" },
  { fr: "Berline familiale", en: "Family sedan", seats: 5, pricePerDay: 52, transmission: "automatic", model: "Toyota Corolla" },
  { fr: "SUV compact", en: "Compact SUV", seats: 5, pricePerDay: 62, transmission: "automatic", model: "Nissan Juke" },
  { fr: "Monospace 7 places", en: "7-seater minivan", seats: 7, pricePerDay: 85, transmission: "manual", model: "Citroën Grand C4 SpaceTourer" },
  { fr: "Minibus 9 places", en: "9-seater minibus", seats: 9, pricePerDay: 110, transmission: "manual", model: "Ford Transit Custom" }
];

/**
 * Builds the car rental recommendation.
 *
 * Two things drive the result: the cheapest category that actually seats the
 * group, and the payment rules that decide the real cost. A rental booked at
 * 25 €/day becomes 70 €/day at the desk when the driver has no credit card,
 * because the agency then imposes its own insurance — so those rules are
 * stated as alerts rather than left to the traveler to discover on arrival.
 */
export function buildCarRentalAdvice(input: CarRentalInput): CarRentalAdvice {
  const fr = input.locale === "fr";
  const days = Math.max(input.durationDays || 1, 1);
  const seatsNeeded = Math.max(input.travelers, 1);

  const affordable = CATEGORIES.filter((category) => category.seats >= seatsNeeded);
  // A group larger than the biggest category needs several cars.
  const carsNeeded = affordable.length ? 1 : Math.ceil(seatsNeeded / 7);
  const usable = affordable.length ? affordable : CATEGORIES.filter((category) => category.seats >= 7);

  const options: CarRentalOption[] = usable.slice(0, 3).map((category, index) => {
    const total = category.pricePerDay * days * carsNeeded;
    const fitsBudget = input.envelope ? total <= input.envelope.max : true;

    return {
      category: `${carsNeeded > 1 ? `${carsNeeded} × ` : ""}${fr ? category.fr : category.en}`,
      seats: category.seats * carsNeeded,
      transmission: category.transmission,
      price_per_day_eur: category.pricePerDay * carsNeeded,
      total_estimate_eur: total,
      pickup: "unknown",
      pickup_note: fr
        ? "Vérifiez sur la fiche du loueur si le comptoir est dans le terminal ou si une navette est nécessaire."
        : "Check on the supplier's page whether the desk is inside the terminal or a shuttle is required.",
      fits_budget: fitsBudget,
      notes: buildCategoryNotes(index, category.transmission, fr),
      booking_links: buildCarRentalLinks(input, fr ? category.fr : category.en),
      example_model: category.model,
      photo: null
    };
  });

  const recommended = options.find((option) => option.fits_budget) ?? options[0] ?? null;
  const needed = (input.distinctAreas ?? 2) > 1;

  return {
    needed,
    why: needed
      ? fr
        ? `Le programme enchaîne des sites répartis autour de ${input.destinationCity} : la voiture évite de dépendre des horaires de bus et rend les journées à thème réalisables.`
        : `The program strings together sites spread around ${input.destinationCity}: a car removes the dependency on bus timetables and makes the themed days workable.`
      : fr
        ? `Le séjour reste à ${input.destinationCity} : tout se fait à pied ou en transports, et une voiture coûterait surtout du stationnement. Ces tarifs ne servent que si vous ajoutez une excursion hors de la ville.`
        : `The stay never leaves ${input.destinationCity}: everything is walkable or reachable by transit, and a car would mostly cost parking. These rates only matter if you add a trip out of town.`,
    budget_envelope_eur: input.envelope ?? null,
    recommended,
    options,
    alerts: buildRentalAlerts(fr),
    documents: buildRequiredDocuments(fr),
    search_links: buildCarSearchLinks(input),
    pickup_date: input.pickupDate ?? null,
    return_date: input.returnDate ?? null,
    rental_days: days
  };
}

function buildCategoryNotes(index: number, transmission: "manual" | "automatic", fr: boolean): string[] {
  const notes: string[] = [];
  if (index === 0) {
    notes.push(fr ? "Option la moins chère qui reste adaptée au groupe" : "Cheapest option that still fits the group");
  }
  if (transmission === "manual") {
    notes.push(fr ? "Boîte manuelle : l'automatique coûte 10 à 20 € de plus par jour" : "Manual gearbox: automatic costs 10-20 € more per day");
  }
  notes.push(
    fr
      ? "Vérifiez la taille du coffre si vous avez de grandes valises"
      : "Check the boot size if you travel with large suitcases"
  );
  return notes;
}

/**
 * The payment and insurance rules, stated plainly.
 *
 * The credit card point is the one that costs travelers the most: a debit card
 * or a card not in the driver's name means the agency refuses the deposit and
 * sells its own insurance instead.
 */
function buildRentalAlerts(fr: boolean): string[] {
  return fr
    ? [
        "Payez et présentez une VRAIE carte de crédit (Visa/Mastercard à débit différé), au nom du conducteur principal : sans elle, le loueur refuse la caution et vous impose son assurance, souvent 20 à 40 € par jour.",
        "Une carte de débit, une carte prépayée ou une Revolut/N26 classique ne suffit généralement pas pour la caution.",
        "La caution (800 à 1 500 €) est bloquée sur la carte, pas débitée : prévoyez le plafond disponible.",
        "Refusez l'assurance du comptoir si votre carte de crédit couvre déjà la location — vérifiez votre contrat avant de partir.",
        "Vérifiez si le comptoir est DANS le terminal ou hors aéroport : hors aéroport, il faut prendre une navette (15 à 30 min d'attente, pénible avec des enfants et des valises).",
        "Politique carburant : exigez « plein / plein ». Le « plein / vide » facture le carburant plus cher que la station.",
        "Photographiez la voiture sous tous les angles au départ et au retour, rayures et pare-brise compris."
      ]
    : [
        "Pay with a REAL credit card (Visa/Mastercard, deferred debit) in the main driver's name: without one the agency refuses the deposit and sells you its own insurance, often 20-40 € per day.",
        "A debit card, a prepaid card or a standard Revolut/N26 is usually not accepted for the deposit.",
        "The deposit (800-1,500 €) is held on the card, not charged: make sure the limit allows it.",
        "Decline the counter insurance if your credit card already covers rentals — check your card contract before leaving.",
        "Check whether the desk is INSIDE the terminal or off-airport: off-airport means a shuttle (15-30 min wait, painful with children and luggage).",
        "Fuel policy: insist on full-to-full. Full-to-empty bills fuel above pump price.",
        "Photograph the car from every angle at pickup and return, including scratches and the windscreen."
      ];
}

function buildRequiredDocuments(fr: boolean): string[] {
  return fr
    ? [
        "Permis de conduire du conducteur principal (et de chaque conducteur additionnel)",
        "Carte de crédit au nom du conducteur principal",
        "Pièce d'identité ou passeport",
        "Bon de réservation imprimé ou sur téléphone"
      ]
    : [
        "Driving licence of the main driver (and of each additional driver)",
        "Credit card in the main driver's name",
        "ID card or passport",
        "Booking voucher, printed or on the phone"
      ];
}

// Comparison sites are the only realistic source of live rental prices: none
// of them exposes a free public API, so these are pre-filled search links.
export function buildCarRentalLinks(input: CarRentalInput, category: string): BookingLink[] {
  const fr = input.locale === "fr";
  const city = input.destinationCity.trim();
  const query = encodeURIComponent(`${category} ${city}`);

  return [
    {
      // DiscoverCars needs its own location ids to deep-link a search, so this
      // is the localized entry point rather than a pre-filled query that would
      // silently be ignored.
      provider: "discovercars",
      label: fr ? "Comparer sur DiscoverCars" : "Compare on DiscoverCars",
      url: `https://www.discovercars.com/${fr ? "fr" : "en"}`
    },
    {
      provider: "kayak",
      label: fr ? "Comparer sur Kayak" : "Compare on Kayak",
      url: buildKayakCarUrl(input)
    },
    {
      provider: "rentalcars",
      label: fr ? "Voir sur Booking (voitures)" : "See on Booking (cars)",
      url: `https://www.booking.com/cars/index.${fr ? "fr" : "en-gb"}.html?ss=${query}`
    }
  ];
}

function buildCarSearchLinks(input: CarRentalInput): SearchLink[] {
  return buildCarRentalLinks(input, input.locale === "fr" ? "location de voiture" : "car rental").map((link) => ({
    provider: link.provider,
    label: link.label,
    url: link.url,
    category: "cars" as const
  }));
}

// Kayak addresses its car search as /cars/<place>/<pickup>/<dropoff>.
function buildKayakCarUrl(input: CarRentalInput): string {
  const host = input.locale === "fr" ? "www.kayak.fr" : "www.kayak.com";
  const place = input.destinationCity.trim().replace(/\s+/g, "-");
  const dates =
    input.pickupDate && input.returnDate ? `/${input.pickupDate}/${input.returnDate}` : "";
  return `https://${host}/cars/${encodeURIComponent(place)}${dates}`;
}
