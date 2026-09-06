import { z } from "zod";

export const VerificationStatusSchema = z.enum(["verified", "unverified", "unknown"]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const ToolStatusSchema = z.enum(["ok", "degraded", "error"]);
export type ToolStatus = z.infer<typeof ToolStatusSchema>;

export const ToolResponseSchema = z.object({
  status: ToolStatusSchema,
  source: z.string(),
  verified_at: z.string().nullable(),
  data: z.unknown(),
  warnings: z.array(z.string()).default([]),
  raw_ref: z.string().nullable()
});
export type ToolResponse<T = unknown> = Omit<z.infer<typeof ToolResponseSchema>, "data"> & { data: T };

export const StructuredTripBriefSchema = z.object({
  departure_city: z.string().nullable().default(null),
  destination: z.string().nullable().default(null),
  alternative_destinations: z.array(z.string()).default([]),
  date_window: z.string().nullable().default(null),
  exact_dates: z.object({
    start: z.string().nullable().default(null),
    end: z.string().nullable().default(null),
    // True when the dates were derived from a month ("en septembre") rather
    // than written by the traveler: the flight search then samples the month
    // for the cheapest dates instead of trusting the guess.
    estimated: z.boolean().optional()
  }).default({ start: null, end: null }),
  duration_days: z.number().int().positive().nullable().default(null),
  budget_total: z.number().positive().nullable().default(null),
  currency: z.string().default("EUR"),
  travelers_count: z.number().int().positive().default(1),
  traveler_types: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  dislikes: z.array(z.string()).default([]),
  pace: z.enum(["slow", "moderate", "fast"]).default("moderate"),
  accommodation_preferences: z.array(z.string()).default([]),
  transport_preferences: z.array(z.string()).default([]),
  climate_preferences: z.array(z.string()).default([]),
  must_have: z.array(z.string()).default([]),
  must_avoid: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  confidence_notes: z.array(z.string()).default([])
});
export type StructuredTripBrief = z.infer<typeof StructuredTripBriefSchema>;

export const TravelBriefOutputSchema = z.object({
  brief_summary: z.string(),
  structured_trip_brief: StructuredTripBriefSchema,
  missing_information: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  confidence_scores: z.record(z.number().min(0).max(1)).default({})
});
export type TravelBriefOutput = z.infer<typeof TravelBriefOutputSchema>;

export const DestinationOptionSchema = z.object({
  destination: z.string(),
  score: z.number().min(0).max(1),
  why: z.string(),
  tradeoffs: z.array(z.string()).default([]),
  budget_fit: z.string().default("unknown")
});

export const DestinationMatcherOutputSchema = z.object({
  top_destinations: z.array(DestinationOptionSchema).min(1),
  fit_rationale: z.string(),
  tradeoffs: z.array(z.string()).default([]),
  budget_fit: z.string(),
  best_for: z.array(z.string()).default([]),
  watchouts: z.array(z.string()).default([])
});
export type DestinationMatcherOutput = z.infer<typeof DestinationMatcherOutputSchema>;

export const BudgetBreakdownSchema = z.object({
  transport: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
  lodging: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
  food: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
  local_transit: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
  activities: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
  contingency: z.tuple([z.number().nonnegative(), z.number().nonnegative()])
});

export const BudgetEstimateSchema = z.object({
  feasibility: z.enum(["good", "tight", "risky"]),
  estimated_total: z.object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
    currency: z.string()
  }),
  budget_breakdown: BudgetBreakdownSchema,
  pressure_points: z.array(z.string()).default([]),
  optimization_options: z.array(z.string()).default([]),
  confidence_notes: z.array(z.string()).default([])
});
export type BudgetEstimate = z.infer<typeof BudgetEstimateSchema>;

export const FlightOptionSchema = z.object({
  label: z.string(),
  price: z.number().nonnegative().nullable(),
  currency: z.string().default("EUR"),
  total_duration: z.string().nullable().default(null),
  stops: z.number().int().nonnegative().nullable().default(null),
  budget_fit: z.enum(["within_budget", "over_budget", "unknown"]).default("unknown"),
  booking_url: z.string().nullable().default(null),
  notes: z.array(z.string()).default([])
});

export const StayOptionSchema = z.object({
  name: z.string(),
  price_per_night: z.number().nonnegative().nullable(),
  currency: z.string().default("EUR"),
  area: z.string().nullable().default(null),
  rating: z.number().min(0).max(5).nullable().default(null),
  budget_fit: z.enum(["within_budget", "over_budget", "unknown"]).default("unknown"),
  booking_url: z.string().nullable().default(null),
  notes: z.array(z.string()).default([]),
  // From the hotel search: where the property is (for travel times from the
  // chosen hotel) and its picture.
  coordinates: z.object({ lat: z.number(), lon: z.number() }).nullable().default(null),
  photo_url: z.string().nullable().default(null)
});

export const SearchLinkSchema = z.object({
  provider: z.string(),
  label: z.string(),
  url: z.string(),
  category: z.enum(["flights", "stays", "cars", "activities", "restaurants", "forums"])
});
export type SearchLink = z.infer<typeof SearchLinkSchema>;

// A link attached to one precise item (an activity, a table, a car category),
// as opposed to a section-level search link.
export const BookingLinkSchema = z.object({
  provider: z.enum([
    "getyourguide",
    "viator",
    "tiqets",
    "civitatis",
    "thefork",
    "tripadvisor",
    "google-maps",
    "discovercars",
    "rentalcars",
    "kayak",
    "forum",
    "routard",
    "reddit",
    "local-agency",
    "official"
  ]),
  label: z.string(),
  url: z.string()
});
export type BookingLink = z.infer<typeof BookingLinkSchema>;

// A photo is never invented by the LLM: it only proposes a search query, and
// the photo tool resolves it to a real, credited image.
export const PhotoSchema = z.object({
  query: z.string(),
  url: z.string().nullable().default(null),
  thumb_url: z.string().nullable().default(null),
  credit: z.string().nullable().default(null),
  source_url: z.string().nullable().default(null),
  license: z.string().nullable().default(null)
});
export type Photo = z.infer<typeof PhotoSchema>;

// Where the car is actually handed over decides whether the family walks out
// of the terminal with the keys or waits for a shuttle with the luggage.
export const CarPickupSchema = z.enum(["in_terminal", "shuttle", "off_airport", "unknown"]);
export type CarPickup = z.infer<typeof CarPickupSchema>;

export const CarRentalOptionSchema = z.object({
  category: z.string(),
  seats: z.number().int().positive().nullable().default(null),
  transmission: z.enum(["manual", "automatic", "unknown"]).default("unknown"),
  price_per_day_eur: z.number().nonnegative().nullable().default(null),
  total_estimate_eur: z.number().nonnegative().nullable().default(null),
  pickup: CarPickupSchema.default("unknown"),
  pickup_note: z.string().default(""),
  fits_budget: z.boolean().default(true),
  notes: z.array(z.string()).default([]),
  booking_links: z.array(BookingLinkSchema).default([]),
  // A typical model of the category ("Fiat Panda"), and its picture.
  example_model: z.string().nullable().default(null),
  photo: PhotoSchema.nullable().default(null)
});
export type CarRentalOption = z.infer<typeof CarRentalOptionSchema>;

export const CarRentalAdviceSchema = z.object({
  needed: z.boolean().default(true),
  why: z.string().default(""),
  budget_envelope_eur: z
    .object({ min: z.number().nonnegative(), max: z.number().nonnegative() })
    .nullable()
    .default(null),
  recommended: CarRentalOptionSchema.nullable().default(null),
  options: z.array(CarRentalOptionSchema).default([]),
  // Payment and pickup warnings. Built locally, never by the model: they are
  // the difference between a 15 €/day rental and a 60 €/day one at the desk.
  alerts: z.array(z.string()).default([]),
  documents: z.array(z.string()).default([]),
  search_links: z.array(SearchLinkSchema).default([])
});
export type CarRentalAdvice = z.infer<typeof CarRentalAdviceSchema>;

// Getting from the airport to the bed is the first expense of the trip and the
// one guides forget. Each option is priced, timed, and carries its last
// departure — a metro that stops at 23h is useless for a 23h30 landing.
export const TransferModeSchema = z.enum([
  "metro",
  "bus",
  "shuttle",
  "train",
  "tram",
  "taxi",
  "vtc",
  "walk"
]);
export type TransferMode = z.infer<typeof TransferModeSchema>;

export const TransferOptionSchema = z.object({
  mode: TransferModeSchema,
  label: z.string(),
  price_per_person_eur: z.number().nonnegative().nullable().default(null),
  price_group_eur: z.number().nonnegative().nullable().default(null),
  price_note: z.string().default(""),
  duration: z.string().nullable().default(null),
  frequency: z.string().nullable().default(null),
  last_departure: z.string().nullable().default(null),
  notes: z.array(z.string()).default([]),
  booking_links: z.array(BookingLinkSchema).default([])
});
export type TransferOption = z.infer<typeof TransferOptionSchema>;

export const CityTransportSchema = z.object({
  single_ticket_eur: z.number().nonnegative().nullable().default(null),
  day_pass_eur: z.number().nonnegative().nullable().default(null),
  multi_day_pass: z.string().nullable().default(null),
  notes: z.array(z.string()).default([]),
  estimated_total_eur: z.number().nonnegative().nullable().default(null)
});
export type CityTransport = z.infer<typeof CityTransportSchema>;

export const GroundTransportSchema = z.object({
  airport_to_center: z.array(TransferOptionSchema).default([]),
  recommended: z.string().default(""),
  city_transport: CityTransportSchema.nullable().default(null),
  total_estimate_eur: z.number().nonnegative().nullable().default(null),
  search_links: z.array(SearchLinkSchema).default([])
});
export type GroundTransport = z.infer<typeof GroundTransportSchema>;

export const FlightHotelResearchSchema = z.object({
  recommended_flights: z.array(FlightOptionSchema).default([]),
  recommended_stays: z.array(StayOptionSchema).default([]),
  car_rental: CarRentalAdviceSchema.nullable().default(null),
  ground_transport: GroundTransportSchema.nullable().default(null),
  search_links: z.array(SearchLinkSchema).default([]),
  tradeoff_notes: z.array(z.string()).default([]),
  best_choice_by_profile: z.array(z.string()).default([]),
  live_data_status: z.enum(["ok", "partial", "unavailable"]).default("partial"),
  // When the traveler gave a month or nothing, the dates the cheapest fare
  // was found on, and every date that was tried.
  chosen_dates: z.object({ start: z.string(), end: z.string(), reason: z.string().default("") }).nullable().default(null),
  date_options: z.array(z.object({ start: z.string(), end: z.string(), price: z.number().nullable().default(null) })).default([]),
  // What the live prices leave of the budget for everything else.
  live_costs: z.object({ flights: z.number().nullable().default(null), lodging: z.number().nullable().default(null) }).nullable().default(null),
  remaining_budget_eur: z.number().nullable().default(null),
  // The month at a glance, Skyscanner-style: the cheapest known fare of each
  // departure day (per adult), the day picked, and where the prices came from.
  price_calendar: z.array(z.object({ date: z.string(), price: z.number(), transfers: z.number().nullable().default(null), chosen: z.boolean().default(false) })).default([]),
  calendar_source: z.enum(["travelpayouts", "sampled"]).nullable().default(null)
});
export type FlightHotelResearch = z.infer<typeof FlightHotelResearchSchema>;

export const EntryRequirementsSchema = z.object({
  verification_status: VerificationStatusSchema,
  requirements_summary: z.array(z.string()).default([]),
  required_actions: z.array(z.string()).default([]),
  documents_to_prepare: z.array(z.string()).default([]),
  unknowns: z.array(z.string()).default([])
});
export type EntryRequirements = z.infer<typeof EntryRequirementsSchema>;

export const FreeVisitCategorySchema = z.enum([
  "museum",
  "monument",
  "religious",
  "archaeology",
  "old_town",
  "market",
  "viewpoint",
  "nature",
  "beach",
  "street_art",
  "garden",
  "village"
]);
export type FreeVisitCategory = z.infer<typeof FreeVisitCategorySchema>;

// Free cultural visits are the backbone of every day: named, real places that
// cost nothing (or are free on a specific day/slot, captured in free_note).
// Coordinates are resolved by the app from the place name, never written by
// the model, and they are what lets the guide draw the day's route.
export const GeoPointSchema = z.object({
  lat: z.number(),
  lon: z.number()
});
export type GeoPoint = z.infer<typeof GeoPointSchema>;

export const FreeVisitSchema = z.object({
  name: z.string(),
  coordinates: GeoPointSchema.nullable().default(null),
  category: FreeVisitCategorySchema.default("monument"),
  description: z.string(),
  free_note: z.string().default(""),
  duration: z.string().nullable().default(null),
  best_time: z.string().nullable().default(null),
  address_hint: z.string().nullable().default(null),
  map_url: z.string().nullable().default(null),
  photo: PhotoSchema.nullable().default(null)
});
export type FreeVisit = z.infer<typeof FreeVisitSchema>;

// The same excursion is rarely sold at one price: the harbour kiosk, the
// official site and the international platform all resell it. This is where
// the cheaper route is written down, with what travelers report about it.
export const LocalAlternativeSchema = z.object({
  how_to_book: z.string().default(""),
  typical_saving: z.string().nullable().default(null),
  forum_tip: z.string().nullable().default(null),
  // What the same outing costs bought on the spot (harbour kiosk, site
  // ticket office), per person, when it is known.
  on_site_price_eur: z.number().nonnegative().nullable().default(null),
  // Where the traveler actually pays the least: on the spot, on the
  // official site, or online on a platform (a sold-out date or a mandatory
  // time slot can make online the only sensible choice).
  best_channel: z.enum(["on_site", "official", "online", "unknown"]).default("unknown"),
  // One sentence of advice that goes with the channel.
  advice: z.string().nullable().default(null)
});
export type LocalAlternative = z.infer<typeof LocalAlternativeSchema>;

// What kind of day an activity makes. Three options a day always cover three
// different kinds, mixed the way the traveler's styles ask for.
export const ActivityCategorySchema = z.enum(["culture", "sport", "discovery", "relax", "food"]);
export type ActivityCategory = z.infer<typeof ActivityCategorySchema>;

// Paid activities are always offered as alternatives (option A / B / C) so the
// traveler picks by budget, energy and weather on the day itself.
export const PaidOptionSchema = z.object({
  option_label: z.string(),
  title: z.string(),
  category: ActivityCategorySchema.default("discovery"),
  description: z.string(),
  duration: z.string().nullable().default(null),
  price_from_eur: z.number().nonnegative().nullable().default(null),
  price_note: z.string().nullable().default(null),
  suited_for: z.array(z.string()).default([]),
  intensity: z.enum(["easy", "moderate", "sporty"]).default("easy"),
  // A "ticket" is a fixed place you enter (museum, monument, palace, site,
  // show); an "experience" is a guided activity (tour, cruise, class, day
  // trip). They are booked through different channels, so the kind decides
  // which links the app builds.
  kind: z.enum(["ticket", "experience"]).default("experience"),
  // Against the activities envelope of the budget set in the questionnaire.
  budget_fit: z.enum(["within_budget", "over_budget", "unknown"]).default("unknown"),
  // "getyourguide" when the price and link come from a real GetYourGuide
  // offer found for this destination; "estimate" when the model guessed.
  price_source: z.enum(["getyourguide", "estimate"]).default("estimate"),
  gyg_url: z.string().nullable().default(null),
  // The institution's own website for a ticketed place, proposed by the model
  // only when certain and checked by the app before it replaces the official
  // ticket-office search. Resellers are never accepted here.
  official_url: z.string().nullable().default(null),
  // Resolved by the app for ticketed places (a museum has an address, a
  // cruise does not) so the day's route on the map includes them.
  coordinates: GeoPointSchema.nullable().default(null),
  local_alternative: LocalAlternativeSchema.nullable().default(null),
  // A site reached by boat (an island fortress, a sea cave) needs two
  // bookings: the crossing from a port, and the entrance. The port is what
  // the app needs to build the crossing links.
  crossing: z
    .object({
      from_port: z.string(),
      note: z.string().nullable().default(null),
      price_eur: z.number().nonnegative().nullable().default(null)
    })
    .nullable()
    .default(null),
  booking_links: z.array(BookingLinkSchema).default([]),
  photo: PhotoSchema.nullable().default(null)
});
export type PaidOption = z.infer<typeof PaidOptionSchema>;

export const RestaurantPickSchema = z.object({
  name: z.string(),
  // Filled from Google Maps when the table was picked among real, rated
  // places; an unverified pick is one the model named on its own.
  verified: z.boolean().default(false),
  rating: z.number().min(0).max(5).nullable().default(null),
  reviews_count: z.number().int().nonnegative().nullable().default(null),
  address: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  website: z.string().nullable().default(null),
  maps_url: z.string().nullable().default(null),
  // From Google Maps when the table was verified, else geocoded by the app.
  coordinates: GeoPointSchema.nullable().default(null),
  meal: z.enum(["lunch", "dinner", "coffee"]).default("dinner"),
  cuisine: z.string().default(""),
  price_range: z.enum(["€", "€€", "€€€", "€€€€"]).default("€€"),
  area: z.string().nullable().default(null),
  why: z.string().default(""),
  tags: z.array(z.string()).default([]),
  budget_note: z.string().nullable().default(null),
  booking_links: z.array(BookingLinkSchema).default([]),
  photo: PhotoSchema.nullable().default(null)
});
export type RestaurantPick = z.infer<typeof RestaurantPickSchema>;

// Arrival day before check-in and departure day after check-out are dead
// hours spent dragging suitcases. A locker turns them back into visiting time.
export const LuggageStorageSchema = z.object({
  when: z.enum(["arrival", "departure"]).default("arrival"),
  window: z.string().default(""),
  area_hint: z.string().default(""),
  access_time: z.string().nullable().default(null),
  transport_note: z.string().default(""),
  transport_cost_eur: z.number().nonnegative().nullable().default(null),
  price_per_bag_eur: z.number().nonnegative().nullable().default(null),
  price_note: z.string().default(""),
  opening_hours: z.string().nullable().default(null),
  notes: z.array(z.string()).default([]),
  booking_links: z.array(BookingLinkSchema).default([])
});
export type LuggageStorage = z.infer<typeof LuggageStorageSchema>;

export const TimelineStepSchema = z.object({
  time: z.string(),
  label: z.string(),
  detail: z.string().default("")
});
export type TimelineStep = z.infer<typeof TimelineStepSchema>;

export const ItineraryDaySchema = z.object({
  day: z.number().int().positive(),
  date: z.string().nullable().default(null),
  title: z.string(),
  theme: z.string().default(""),
  area: z.string().nullable().default(null),
  narrative: z.string().default(""),
  morning: z.string(),
  afternoon: z.string(),
  evening: z.string(),
  timeline: z.array(TimelineStepSchema).default([]),
  free_visits: z.array(FreeVisitSchema).default([]),
  paid_options: z.array(PaidOptionSchema).default([]),
  restaurants: z.array(RestaurantPickSchema).default([]),
  travel_note: z.string().nullable().default(null),
  center: GeoPointSchema.nullable().default(null),
  practical_tips: z.array(z.string()).default([]),
  free_day_cost_eur: z.number().nonnegative().nullable().default(null),
  luggage_storage: LuggageStorageSchema.nullable().default(null),
  photo: PhotoSchema.nullable().default(null),
  backup_option: z.string().nullable().default(null)
});
export type ItineraryDay = z.infer<typeof ItineraryDaySchema>;

export const ExcursionSchema = z.object({
  title: z.string(),
  description: z.string(),
  duration: z.string().nullable().default(null),
  price_estimate_eur: z.number().nonnegative().nullable().default(null),
  style: z.string().nullable().default(null),
  booking_url: z.string().nullable().default(null),
  booking_links: z.array(BookingLinkSchema).default([]),
  photo: PhotoSchema.nullable().default(null)
});
export type Excursion = z.infer<typeof ExcursionSchema>;

// What travelers actually wrote on TripAdvisor, Routard and Reddit about the
// destination: real threads the guide links to, and what grounds forum_tip.
export const ForumFindingSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string().default(""),
  source: z.string().default("")
});
export type ForumFinding = z.infer<typeof ForumFindingSchema>;

export const ItineraryByDaySchema = z.object({
  trip_summary: z.string(),
  car_needed: z.boolean().nullable().default(null),
  car_rationale: z.string().default(""),
  itinerary_by_day: z.array(ItineraryDaySchema).min(1),
  suggested_excursions: z.array(ExcursionSchema).default([]),
  experience_links: z.array(SearchLinkSchema).default([]),
  free_culture_highlights: z.array(z.string()).default([]),
  pacing_notes: z.array(z.string()).default([]),
  alternatives: z.array(z.string()).default([]),
  verification_needed: z.array(z.string()).default([]),
  forum_findings: z.array(ForumFindingSchema).default([])
});
export type ItineraryByDay = z.infer<typeof ItineraryByDaySchema>;

// A full illustrated program does not fit in one LLM response, so it is built
// in two phases. The outline is the uniqueness contract: it assigns every day
// its theme and the exact names it may use, which is what guarantees that no
// visit, table or activity is ever repeated across the trip.
export const ItineraryOutlineDaySchema = z.object({
  day: z.number().int().positive(),
  date: z.string().nullable().default(null),
  title: z.string(),
  theme: z.string(),
  area: z.string(),
  // The one town or village where that day's lunch and dinner happen — what the
  // restaurant lookup searches. "Gorges de Samaria et Omalos" is an area; "Omalos"
  // is where one eats.
  meal_town: z.string().nullable().default(null),
  free_visit_names: z.array(z.string()).default([]),
  paid_option_titles: z.array(z.string()).default([]),
  // One category per paid option title, same order: the outline plans the mix
  // of the whole trip so no two days feel alike.
  paid_option_categories: z.array(ActivityCategorySchema).default([]),
  restaurant_names: z.array(z.string()).default([])
});
export type ItineraryOutlineDay = z.infer<typeof ItineraryOutlineDaySchema>;

export const ItineraryOutlineSchema = z.object({
  trip_summary: z.string(),
  // Whether the program actually requires a car. A compact city where
  // everything is walkable should not be sold a rental.
  car_needed: z.boolean().default(true),
  car_rationale: z.string().default(""),
  days: z.array(ItineraryOutlineDaySchema).min(1),
  suggested_excursions: z.array(ExcursionSchema).default([]),
  free_culture_highlights: z.array(z.string()).default([]),
  pacing_notes: z.array(z.string()).default([]),
  alternatives: z.array(z.string()).default([]),
  verification_needed: z.array(z.string()).default([])
});
export type ItineraryOutline = z.infer<typeof ItineraryOutlineSchema>;

export const ItineraryDaysBatchSchema = z.object({
  days: z.array(ItineraryDaySchema).min(1)
});
export type ItineraryDaysBatch = z.infer<typeof ItineraryDaysBatchSchema>;

export const PackingChecklistSchema = z.object({
  essentials: z.array(z.string()).default([]),
  clothing: z.array(z.string()).default([]),
  documents: z.array(z.string()).default([]),
  health_and_safety: z.array(z.string()).default([]),
  electronics: z.array(z.string()).default([]),
  optional_items: z.array(z.string()).default([]),
  final_reminders: z.array(z.string()).default([])
});
export type PackingChecklist = z.infer<typeof PackingChecklistSchema>;

export const TripSummaryExportSchema = z.object({
  traveler_summary: z.string(),
  final_trip_plan: z.object({
    destination: z.string().nullable().default(null),
    duration_days: z.number().int().positive().nullable().default(null),
    budget: z.object({
      min: z.number().nonnegative(),
      max: z.number().nonnegative(),
      currency: z.string()
    }).nullable().default(null),
    itinerary_highlights: z.array(z.string()).default([])
  }),
  structured_json: z.record(z.unknown()),
  open_verifications: z.array(z.string()).default([]),
  next_steps: z.array(z.string()).default([])
});
export type TripSummaryExport = z.infer<typeof TripSummaryExportSchema>;

export const TravelStyleSchema = z.enum([
  "beach",
  "culture",
  "nature",
  "food",
  "nightlife",
  "family",
  "romantic",
  "adventure"
]);
export type TravelStyle = z.infer<typeof TravelStyleSchema>;

// The upfront traveler questionnaire: explicit answers take precedence over
// whatever is inferred from the free-text message.
export const TripPreferencesSchema = z.object({
  travel_styles: z.array(TravelStyleSchema).default([]),
  pace: z.enum(["slow", "moderate", "fast"]).nullable().default(null),
  budget_total: z.number().positive().nullable().default(null),
  // An explicit destination beats guessing one out of the free-text message.
  destination: z.string().nullable().default(null),
  duration_days: z.number().int().positive().nullable().default(null),
  travelers_count: z.number().int().positive().nullable().default(null),
  departure_city: z.string().nullable().default(null),
  month: z.string().nullable().default(null)
});
export type TripPreferences = z.infer<typeof TripPreferencesSchema>;

export const PlanTripRequestSchema = z.object({
  message: z.string().min(1),
  locale: z.enum(["fr", "en"]).default("fr"),
  trip_id: z.number().int().positive().optional(),
  preferences: TripPreferencesSchema.optional()
});
export type PlanTripRequest = z.infer<typeof PlanTripRequestSchema>;

export const PlanTraceStepSchema = z.object({
  skill: z.string(),
  status: z.enum(["ok", "skipped", "error"]),
  reason: z.string().optional(),
  source: z.enum(["llm", "fallback", "tools"]).optional(),
  tool_statuses: z.record(ToolStatusSchema).default({})
});
export type PlanTraceStep = z.infer<typeof PlanTraceStepSchema>;

export const PlanTripResponseSchema = z.object({
  traveler_summary: z.string(),
  final_trip_plan: z.record(z.unknown()),
  structured_json: z.record(z.unknown()),
  open_verifications: z.array(z.string()),
  next_steps: z.array(z.string()),
  trace: z.array(PlanTraceStepSchema)
});
export type PlanTripResponse = z.infer<typeof PlanTripResponseSchema>;

export const AuthRegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  preferred_language: z.enum(["fr", "en"]).default("fr")
});

export const AuthLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

// Emailing the guide. `to` is optional: omitted, it goes to the signed-in
// account, which keeps the common case from ever needing a typed address.
export const GuideEmailRequestSchema = z.object({
  to: z.string().email().optional(),
  locale: z.enum(["fr", "en"]).optional(),
  embed: z.boolean().default(true)
});
export type GuideEmailRequest = z.infer<typeof GuideEmailRequestSchema>;

export const TripRecordSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  title: z.string(),
  brief_json: z.record(z.unknown()),
  plan_json: z.record(z.unknown()),
  verification_flags: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string()
});
export type TripRecord = z.infer<typeof TripRecordSchema>;
