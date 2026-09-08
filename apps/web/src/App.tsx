import { useEffect, useMemo, useState } from "react";
import { api, downloadGuide, downloadGuidePdf, previewGuide, type AuthUser } from "./api";
import { legLabel, useHotelTravelTimes } from "./travelTimes";
import type { PlanTripResponse } from "@mlt/contracts";
import AdminDashboard from "./AdminDashboard";
import TripMap, { routesFromItinerary } from "./TripMap";
import Plane3D from "./Plane3D";
import { LegalPage } from "./LegalPage";
import type { LegalDoc } from "./legalContent";
import { DESTINATION_CATALOGUE, US_COUNTRY_NAME, US_STATES, placeLabel } from "./destinations";
import { ABOUT, EYEBROW, FAQ, FEATURES, STEPS } from "./homeContent";


type Locale = "fr" | "en";

const CATEGORY_LABELS: Record<Locale, Record<string, string>> = {
  fr: { culture: "culture", sport: "sport", discovery: "découverte", relax: "farniente", food: "gastronomie" },
  en: { culture: "culture", sport: "sport", discovery: "discovery", relax: "leisure", food: "food" }
};

const text = {
  fr: {
    title: "Mon Petit Voyageur",
    subtitle: "Voyages sur mesure, orchestrés par l'IA",
    login: "Connexion",
    register: "Inscription",
    email: "Email",
    password: "Mot de passe",
    logout: "Déconnexion",
    language: "Langue",
    plannerTitle: "Décris ton voyage",
    plannerPlaceholder: "Ex: Je veux partir 10 jours en septembre, budget 1800 €, départ de Lyon...",
    planTrip: "Lancer l'agent",
    recentTrips: "Mes voyages",
    tripsHint: "Retrouvez ici chaque voyage planifié, avec son programme et son guide illustré.",
    navPlan: "Planifier",
    navTrips: "Mes voyages",
    tripsEmpty: "Aucun voyage pour le moment.",
    tripsEmptyCta: "Planifier mon premier voyage",
    openTrip: "Ouvrir le voyage",
    tripOpen: "Ouvert",
    travelersShort: "voyageur(s)",
    daysShort: "jours",
    updatedOn: "Mis à jour le",
    datesFlexible: "Dates à préciser",
    travelerSummary: "Résumé voyageur",
    finalPlan: "Plan final",
    openVerifications: "Vérifications ouvertes",
    nextSteps: "Prochaines étapes",
    trace: "Trace orchestration",
    flightsHotels: "Vols & hébergements",
    loading: "Chargement...",
    budget: "Budget estimé",
    itinerary: "Itinéraire jour par jour",
    bookingLinks: "Réserver au meilleur tarif",
    experiences: "Excursions & restaurants",
    withinBudget: "dans le budget",
    overBudget: "au-dessus du budget",
    book: "Réserver",
    perNight: "/nuit",
    direct: "direct",
    stops: "escale(s)",
    morning: "Matin",
    afternoon: "Après-midi",
    evening: "Soir",
    eyebrow: "Votre agence de voyage intelligente",
    tagline:
      "Le planificateur de voyage IA qui crée votre itinéraire sur mesure : destination, vols, hôtels, activités et restaurants au meilleur prix, dans votre budget.",
    ctaStart: "Commencer mon voyage",
    ctaHow: "Découvrir comment ça marche",
    featuresTitle: "Une expérience complète de A à Z",
    featuresSub: "Nous nous occupons de tout, de la planification aux réservations",
    howTitle: "Comment ça marche ?",
    howSub: "En quelques étapes simples, créez le voyage de vos rêves",
    ctaCardTitle: "Prêt à vivre une expérience unique ?",
    ctaCardSub: "Laissez notre IA créer le voyage parfait pour vous",
    ctaCardBtn: "Créer mon voyage",
    footerDesc: "Votre compagnon de voyage intelligent pour des aventures inoubliables.",
    footerLinks: "Liens utiles",
    footerGuides: "Guides",
    footerPrivacy: "Politique de confidentialité",
    footerTerms: "Conditions d'utilisation",
    footerSales: "Conditions générales de vente",
    backHome: "Retour à l\u2019accueil",
    footerContact: "Contact",
    footerRights: "Tous droits réservés.",
    authSub: "Accédez à vos voyages",
    serverDown: "Serveur injoignable — lance l'API avec « npm run dev » puis réessaie.",
    badCredentials: "Email ou mot de passe incorrect. Pas encore de compte ? Cliquez sur Inscription.",
    planningInterrupted: "La génération a été interrompue (redémarrage du serveur). Relancez l'agent.",
    flightTag: "Vol",
    stayTag: "Hôtel",
    internalFlightsTitle: "Vols internes entre étapes",
    dayShort: "Jour",

    styleQuestion: "Quel type de voyage ?",
    paceLabel: "Rythme",
    paceSlow: "Tranquille",
    paceModerate: "Équilibré",
    paceFast: "Soutenu",
    shapeLabel: "Forme du voyage",
    shapeBase: "Séjour — une ville, on rayonne",
    shapeRoadtrip: "Itinérant — on change d'hôtel en route",
    lodgingChange: "Nouvel hôtel",
    lodgingSame: "Même hôtel",
    budgetLabel: "Budget total (€)",
    durationLabel: "Durée (jours)",
    travelersLabel: "Voyageurs",
    departureLabel: "Ville de départ",
    destinationLabel: "Destination",
    destinationPlaceholder: "Laisser vide pour une suggestion",
    continentLabel: "Continent",
    countryLabel: "Pays",
    stateLabel: "État",
    cityLabel: "Ville",
    anyDestination: "Peu importe — surprenez-moi",
    anyCountry: "Peu importe dans ce continent",
    anyState: "Peu importe dans le pays",
    anyCity: "Peu importe — toute la région",
    pickContinentFirst: "Choisissez d'abord un continent",
    pickCountryFirst: "Choisissez d'abord un pays",
    pickStateFirst: "Choisissez d'abord un État",

    statesCountLabel: "Combien d'États voulez-vous visiter ?",
    statesCountAny: "Un seul, à définir",
    oneState: "1 État",
    severalStates: "États",
    statesCountHint: "Au-delà d'un État, les vols internes entre étapes sont recherchés.",

    monthLabel: "Mois de départ",
    anyMonth: "Indifférent",
    freeTextLabel: "Précisions (destination, envies...)",
    excursionsTitle: "Excursions proposées",
    excursionTag: "Excursion",
    perPerson: "€ / pers.",
    freeLabel: "Gratuit",
    moreLinks: "Autres liens utiles",
    guideTitle: "Votre guide illustré",
    guideSub: "Le programme complet, jour par jour, avec photos et liens de réservation",
    downloadGuide: "Télécharger le guide",
    previewGuide: "Aperçu",
    guideBusy: "Préparation du guide...",
    guideError: "Guide indisponible pour le moment.",
    freeVisitsLabel: "Visites gratuites",
    optionsLabel: "Activités au choix",
    restaurantsLabel: "Tables présélectionnées",
    reviewsShort: "avis",
    forumTitle: "Ce que disent les voyageurs",
    readThread: "Lire le fil",
    calendarTitle: "Le mois en un coup d'œil",
    calendarSourceCalendar: "prix par jour et par personne (Aviasales) — jour retenu en vert",
    calendarSourceSampled: "départs testés, prix par personne — jour retenu en vert",
    carTitle: "Location de voiture",
    carRecommended: "Recommandé",
    carAlerts: "À savoir avant de réserver",
    carPerDay: "€ / jour",
    carTotalLabel: "pour le séjour",
    savingHint: "Moins cher en direct :",
    planningHint: "cela prend généralement 1 à 3 minutes",
    emailGuide: "Envoyer par mail",
    emailPlaceholder: "Adresse du destinataire",
    guideSent: "Guide envoyé à",
    guideEmailError: "Envoi impossible pour le moment.",
    downloadPdf: "Télécharger en PDF",
    pdfError: "PDF indisponible : ouvrez l'aperçu puis Imprimer / PDF.",
    chooseStay: "Choisir cet hôtel",
    chosenStay: "Hôtel choisi",
    chooseStayHint: "Choisissez votre hôtel : les temps de trajet vers chaque activité s'affichent ensuite.",
    fromHotel: "Depuis l'hôtel :",
    bestChannel: { on_site: "Le moins cher : sur place", official: "Le moins cher : site officiel", online: "Le moins cher : en ligne", unknown: "Moins cher en direct" },
    onSite: "sur place",
    crossing: "Traversée en bateau depuis",
    carModel: "Modèle type",
    perPersonShort: "€ / pers.",
    googleLogin: "Continuer avec Google",
    orDivider: "ou",
    planTitle: "Choisissez votre formule",
    planSub: "Essai gratuit de 7 jours, sans engagement. Annulable à tout moment.",
    planMonthlyName: "Mensuel",
    planMonthlyPrice: "5,99 €",
    planMonthlyPer: "/ mois",
    planAnnualName: "Annuel",
    planAnnualPrice: "49 €",
    planAnnualPer: "/ an",
    planAnnualNote: "Économisez 32 % — soit 4,08 €/mois",
    planPopular: "Le plus choisi",
    planFeatures: [
      "Voyages illimités générés par l'IA",
      "Guide illustré en PDF, jour par jour",
      "Liens de réservation au meilleur prix",
      "Envoi du guide par email"
    ],
    planTrialCta: "Démarrer l'essai gratuit",
    planCta: "S'abonner",
    planTrialUsedNote: "Essai déjà utilisé — l'abonnement démarre immédiatement.",
    planReassurance: "Sans engagement — résiliez en un clic depuis votre espace, à tout moment.",
    manageBilling: "Gérer mon abonnement",
    subscriptionRequired: "Votre essai est terminé. Choisissez une formule pour continuer à planifier.",
    trialActiveBadge: "Essai en cours",
    subActiveBadge: "Abonnement actif",
    checkoutError: "Le paiement n'a pas pu démarrer. Réessayez.",
    checkoutSuccess: "Bienvenue ! Votre accès est activé.",
    billingSoon: "Le paiement sera bientôt disponible."
  },
  en: {
    title: "My Little Traveler",
    subtitle: "Tailor-made trips, orchestrated by AI",
    login: "Login",
    register: "Register",
    email: "Email",
    password: "Password",
    logout: "Logout",
    language: "Language",
    plannerTitle: "Describe your trip",
    plannerPlaceholder: "Ex: I want to travel 10 days in September, budget 1800€, leaving from Lyon...",
    planTrip: "Run agent",
    recentTrips: "My trips",
    tripsHint: "Every trip you planned, with its program and illustrated guide.",
    navPlan: "Plan",
    navTrips: "My trips",
    tripsEmpty: "No trip yet.",
    tripsEmptyCta: "Plan my first trip",
    openTrip: "Open trip",
    tripOpen: "Open",
    travelersShort: "traveler(s)",
    daysShort: "days",
    updatedOn: "Updated on",
    datesFlexible: "Dates to confirm",
    travelerSummary: "Traveler summary",
    finalPlan: "Final plan",
    openVerifications: "Open verifications",
    nextSteps: "Next steps",
    trace: "Orchestration trace",
    flightsHotels: "Flights & stays",
    loading: "Loading...",
    budget: "Estimated budget",
    itinerary: "Day-by-day itinerary",
    bookingLinks: "Book at the best price",
    experiences: "Tours & restaurants",
    withinBudget: "within budget",
    overBudget: "over budget",
    book: "Book",
    perNight: "/night",
    direct: "nonstop",
    stops: "stop(s)",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    eyebrow: "Your intelligent travel agency",
    tagline:
      "The AI travel planner that builds your tailor-made itinerary: destination, flights, hotels, activities and restaurants at the best price, within your budget.",
    ctaStart: "Start my trip",
    ctaHow: "See how it works",
    featuresTitle: "A complete experience from A to Z",
    featuresSub: "We take care of everything, from planning to bookings",
    howTitle: "How does it work?",
    howSub: "Create the trip of your dreams in a few simple steps",
    ctaCardTitle: "Ready for a unique experience?",
    ctaCardSub: "Let our AI craft the perfect trip for you",
    ctaCardBtn: "Create my trip",
    footerDesc: "Your intelligent travel companion for unforgettable adventures.",
    footerLinks: "Useful links",
    footerGuides: "Guides",
    footerPrivacy: "Privacy policy",
    footerTerms: "Terms of use",
    footerSales: "Terms of sale",
    backHome: "Back to home",
    footerContact: "Contact",
    footerRights: "All rights reserved.",
    authSub: "Access your trips",
    serverDown: "Server unreachable — start the API with “npm run dev” and try again.",
    badCredentials: "Wrong email or password. No account yet? Click Sign up.",
    planningInterrupted: "Planning was interrupted (server restart). Please launch the agent again.",
    flightTag: "Flight",
    stayTag: "Stay",
    internalFlightsTitle: "Domestic flights between stages",
    dayShort: "Day",

    styleQuestion: "What kind of trip?",
    paceLabel: "Pace",
    paceSlow: "Relaxed",
    paceModerate: "Balanced",
    paceFast: "Packed",
    shapeLabel: "Shape of the trip",
    shapeBase: "Stay — one town, day trips around",
    shapeRoadtrip: "Road trip — a new hotel along the way",
    lodgingChange: "New hotel",
    lodgingSame: "Same hotel",
    budgetLabel: "Total budget (€)",
    durationLabel: "Duration (days)",
    travelersLabel: "Travelers",
    departureLabel: "Departure city",
    destinationLabel: "Destination",
    destinationPlaceholder: "Leave empty for a suggestion",
    continentLabel: "Continent",
    countryLabel: "Country",
    stateLabel: "State",
    cityLabel: "City",
    anyDestination: "Anywhere — surprise me",
    anyCountry: "Anywhere on this continent",
    anyState: "Anywhere in the country",
    anyCity: "Anywhere — the whole region",
    pickContinentFirst: "Pick a continent first",
    pickCountryFirst: "Pick a country first",
    pickStateFirst: "Pick a state first",

    statesCountLabel: "How many states do you want to visit?",
    statesCountAny: "Just one, to be decided",
    oneState: "1 state",
    severalStates: "states",
    statesCountHint: "Beyond one state, domestic flights between stages are searched.",

    monthLabel: "Departure month",
    anyMonth: "Flexible",
    freeTextLabel: "Details (destination, wishes...)",
    excursionsTitle: "Suggested excursions",
    excursionTag: "Excursion",
    perPerson: "€ / pers.",
    freeLabel: "Free",
    moreLinks: "More useful links",
    guideTitle: "Your illustrated guide",
    guideSub: "The complete day-by-day program, with photos and booking links",
    downloadGuide: "Download the guide",
    previewGuide: "Preview",
    guideBusy: "Preparing the guide...",
    guideError: "Guide unavailable right now.",
    freeVisitsLabel: "Free visits",
    optionsLabel: "Activity options",
    restaurantsLabel: "Preselected tables",
    reviewsShort: "reviews",
    forumTitle: "What travelers say",
    readThread: "Read the thread",
    calendarTitle: "The month at a glance",
    calendarSourceCalendar: "price per day and per person (Aviasales) — chosen day in green",
    calendarSourceSampled: "departures tried, price per person — chosen day in green",
    carTitle: "Car rental",
    carRecommended: "Recommended",
    carAlerts: "Read before booking",
    carPerDay: "€ / day",
    carTotalLabel: "for the stay",
    savingHint: "Cheaper booked direct:",
    planningHint: "this usually takes 1 to 3 minutes",
    emailGuide: "Send by email",
    emailPlaceholder: "Recipient address",
    guideSent: "Guide sent to",
    guideEmailError: "Sending failed for now.",
    downloadPdf: "Download as PDF",
    pdfError: "PDF unavailable: open the preview, then Print / PDF.",
    chooseStay: "Choose this hotel",
    chosenStay: "Chosen hotel",
    chooseStayHint: "Pick your hotel: travel times to every activity then appear.",
    fromHotel: "From the hotel:",
    bestChannel: { on_site: "Cheapest: on the spot", official: "Cheapest: official site", online: "Cheapest: online", unknown: "Cheaper booked direct" },
    onSite: "on the spot",
    crossing: "Boat crossing from",
    carModel: "Typical model",
    perPersonShort: "€ / pers.",
    googleLogin: "Continue with Google",
    orDivider: "or",
    planTitle: "Choose your plan",
    planSub: "7-day free trial, no commitment. Cancel anytime.",
    planMonthlyName: "Monthly",
    planMonthlyPrice: "€5.99",
    planMonthlyPer: "/ month",
    planAnnualName: "Annual",
    planAnnualPrice: "€49",
    planAnnualPer: "/ year",
    planAnnualNote: "Save 32% — €4.08/mo",
    planPopular: "Most popular",
    planFeatures: [
      "Unlimited AI-generated trips",
      "Illustrated PDF guide, day by day",
      "Booking links at the best price",
      "Guide sent by email"
    ],
    planTrialCta: "Start free trial",
    planCta: "Subscribe",
    planTrialUsedNote: "Trial already used — the subscription starts right away.",
    planReassurance: "No commitment — cancel anytime, in one click from your account.",
    manageBilling: "Manage my subscription",
    subscriptionRequired: "Your trial has ended. Pick a plan to keep planning.",
    trialActiveBadge: "Trial active",
    subActiveBadge: "Subscription active",
    checkoutError: "Checkout could not start. Please try again.",
    checkoutSuccess: "Welcome! Your access is active.",
    billingSoon: "Payments will be available soon."
  }
} as const;

const PLANNING_STEPS = {
  fr: [
    "Analyse de votre demande...",
    "Choix de la destination et estimation du budget...",
    "Recherche des vols, hébergements et transports...",
    "Construction du programme jour par jour...",
    "Sélection des visites gratuites et des tables...",
    "Derniers réglages du programme..."
  ],
  en: [
    "Reading your request...",
    "Choosing the destination and estimating the budget...",
    "Searching flights, stays and transport...",
    "Building the day-by-day program...",
    "Picking free visits and tables...",
    "Final adjustments..."
  ]
} as const;

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes} min ${String(rest).padStart(2, "0")} s` : `${rest} s`;
}

// How many US states a trip may cross, offered as a question of its own the
// moment the United States are picked: it decides whether the program is one
// state explored in depth or a route with domestic flights between stages.
const US_STATE_COUNTS = [1, 2, 3, 4, 5] as const;


// Static SEO guides generated by apps/web/seo (served at these URLs by server.mjs).
// Linked from the footer so no guide is orphaned; keep in sync with seo/pages/*.mjs
// and the static footer in index.html.
const SEO_GUIDES = [
  { href: "/planificateur-voyage-ia", fr: "Planificateur de voyage IA", en: "AI travel planner (FR)" },
  { href: "/planificateur-road-trip-ia", fr: "Planificateur de road trip", en: "Road trip planner (FR)" },
  { href: "/budget-voyage", fr: "Budget voyage", en: "Travel budget (FR)" },
  { href: "/organiser-un-voyage-avec-l-ia", fr: "Organiser un voyage avec l'IA", en: "Planning a trip with AI (FR)" }
] as const;

const TRAVEL_STYLES = [
  { key: "beach", fr: "Plage & mer", en: "Beach & sea" },
  { key: "culture", fr: "Culture & patrimoine", en: "Culture & heritage" },
  { key: "nature", fr: "Nature & rando", en: "Nature & hiking" },
  { key: "food", fr: "Gastronomie", en: "Food & dining" },
  { key: "nightlife", fr: "Fête & nuit", en: "Nightlife" },
  { key: "family", fr: "Famille", en: "Family" },
  { key: "romantic", fr: "Romantique", en: "Romantic" },
  { key: "adventure", fr: "Aventure", en: "Adventure" }
] as const;

const MONTHS = {
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  en: ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
} as const;

const featureIcons = {
  compass: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.2,7.8 14.2,14.2 7.8,16.2 9.8,9.8" />
    </svg>
  ),
  ticket: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
      <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
    </svg>
  ),
  plane: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  ),
  bed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /><path d="M6 8v9" />
    </svg>
  ),
  map: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.1 6.1 9.9 3.9a1 1 0 0 0-.9 0L3.6 6.6A1 1 0 0 0 3 7.5v12a1 1 0 0 0 1.4.9l4.7-2.3 4.8 2.3a1 1 0 0 0 .9 0l5.6-2.8a1 1 0 0 0 .6-.9v-12a1 1 0 0 0-1.4-.9l-4.6 2.3a1 1 0 0 1-.9 0z" /><path d="M9.5 3.9v13.9" /><path d="M14.5 6.1V20" />
    </svg>
  ),
  dining: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </svg>
  )
} as const;

function TravelerApp() {
  const [locale, setLocale] = useState<Locale>("fr");
  const t = text[locale];
  const devCredentials = useMemo(() => api.getDevTestCredentials(), []);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string>("");
  const [email, setEmail] = useState<string>(devCredentials.email);
  const [password, setPassword] = useState<string>(devCredentials.password);
  const [isRegisterMode, setRegisterMode] = useState(false);

  const [message, setMessage] = useState("");
  const [styles, setStyles] = useState<string[]>([]);
  const [pace, setPace] = useState("moderate");
  // A road trip is a different guide: one stage per night, the drive between
  // them, a hotel that changes. The traveler says which one they want.
  const [tripShape, setTripShape] = useState("base");
  // When the AI cannot write the program the traveler gets nothing rather than
  // a generic guide, so the reason has to be readable, not an alert box.
  const [planError, setPlanError] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [duration, setDuration] = useState("");
  const [travelers, setTravelers] = useState("2");
  const [departure, setDeparture] = useState("");
  // The destination is browsed continent → country (or US state) → city; the
  // deepest answer given is what the plan is built on, so a traveler who stops
  // at "Asie" still gets a trip.
  const [continentKey, setContinentKey] = useState("");
  const [countryName, setCountryName] = useState("");
  const [stateName, setStateName] = useState("");
  const [cityName, setCityName] = useState("");
  const [statesCount, setStatesCount] = useState("");

  const [month, setMonth] = useState("");
  // ?demo-plane shows the wait screen without planning: for checking the animation.
  const [planning, setPlanning] = useState(false);
  // ?demo-plane shows the wait screen alone, without an account or a plan:
  // for checking the animation.
  const demoPlane = new URLSearchParams(window.location.search).has("demo-plane");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<(PlanTripResponse & { trip_id?: number; run_id?: string }) | null>(null);
  const [trips, setTrips] = useState<any[]>([]);
  // Saved trips live on their own page; the planner page only plans.
  const [page, setPage] = useState<"planner" | "trips" | "legal">("planner");
  const [legalDoc, setLegalDoc] = useState<LegalDoc["key"]>("privacy");

  const openLegal = (key: LegalDoc["key"]) => {
    setLegalDoc(key);
    setPage("legal");
    window.scrollTo({ top: 0 });
  };
  const [guideBusy, setGuideBusy] = useState(false);
  const [guideError, setGuideError] = useState("");
  const [guideSent, setGuideSent] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingMsg, setBillingMsg] = useState("");

  // Deep link to a legal page: /?legal=privacy|terms|sales. Gives the privacy
  // policy and terms a stable public URL (needed for the Google OAuth screen).
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("legal");
    if (key === "privacy" || key === "terms" || key === "sales") openLegal(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api
      .me()
      .then((u) => {
        setUser(u);
        setLocale(u.preferred_language);
      })
      .catch(() => null);
  }, []);

  // After returning from Stripe Checkout or Google, refresh the account and
  // clean the URL so a reload does not re-trigger the message.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const login = params.get("login");
    if (!checkout && !login) return;
    if (checkout === "success") setBillingMsg(text[locale].checkoutSuccess);
    api.me().then((u) => { setUser(u); setLocale(u.preferred_language); }).catch(() => null);
    params.delete("checkout");
    params.delete("login");
    const rest = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCheckout(plan: "monthly" | "annual") {
    setBillingBusy(true);
    setBillingMsg("");
    try {
      const { url } = await api.checkout(plan);
      window.location.href = url;
    } catch (error) {
      const raw = (error as Error).message;
      setBillingMsg(/billing_not_configured/.test(raw) ? t.billingSoon : t.checkoutError);
      setBillingBusy(false);
    }
  }

  async function handleManageBilling() {
    setBillingBusy(true);
    try {
      const { url } = await api.billingPortal();
      window.location.href = url;
    } catch {
      setBillingBusy(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    api.listTrips().then(setTrips).catch(() => setTrips([]));
  }, [user]);

  const continent = DESTINATION_CATALOGUE.find((entry) => entry.key === continentKey) ?? null;
  const country = continent?.countries.find((entry) => entry.name === countryName) ?? null;
  const isUnitedStates = countryName === US_COUNTRY_NAME;
  const usState = isUnitedStates ? US_STATES.find((entry) => entry.name === stateName) ?? null : null;
  // Inside the United States the second list is the state, so the cities come
  // from it; everywhere else they come from the country.
  const cityOptions = isUnitedStates ? usState?.cities ?? [] : country?.cities ?? [];

  // The most precise place the traveler named. A city beats its state, a state
  // beats the country, and an untouched continent beats nothing at all: the
  // destination matcher then chooses inside it.
  const destination = useMemo(() => {
    if (cityName) return cityName;
    if (isUnitedStates) return stateName ? `${stateName}, ${US_COUNTRY_NAME}` : countryName;
    return countryName || "";
  }, [cityName, countryName, stateName, isUnitedStates]);

  // A continent with no country picked is a hint for the free text, not a
  // destination: the AI is told where to look and stays free to choose.
  const continentHint = useMemo(() => {
    if (destination || !continent) return "";
    return locale === "fr" ? `Je veux partir en ${continent.fr}.` : `I want to travel to ${continent.en}.`;
  }, [destination, continent, locale]);

  const canSubmit = useMemo(
    () => (!!message.trim() || styles.length > 0 || !!destination || !!continentHint) && !planning,
    [message, styles, planning, destination, continentHint]
  );

  // Changing a level clears the ones below it, so the form never sends a city
  // that belongs to another country.
  function handleContinentChange(value: string) {
    setContinentKey(value);
    setCountryName("");
    setStateName("");
    setCityName("");
    setStatesCount("");
  }

  function handleCountryChange(value: string) {
    setCountryName(value);
    setStateName("");
    setCityName("");
    if (value !== US_COUNTRY_NAME) setStatesCount("");
  }

  function handleStateChange(value: string) {
    setStateName(value);
    setCityName("");
  }


  function toggleStyle(key: string) {
    setStyles((current) => (current.includes(key) ? current.filter((s) => s !== key) : [...current, key]));
  }

  async function handleAuthSubmit(event: React.FormEvent) {
    event.preventDefault();
    setAuthError("");

    try {
      const account = isRegisterMode
        ? await api.register({ email, password, preferred_language: locale })
        : await api.login({ email, password });
      setUser(account);
      setPassword("");
    } catch (error) {
      const message = (error as Error).message;
      setAuthError(
        /fetch/i.test(message) ? t.serverDown : /invalid credentials/i.test(message) ? t.badCredentials : message
      );
    }
  }

  async function handlePlan(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setPlanning(true);
    setPlanError("");
    try {
      const response = await api.planTrip({
        message:
          [message.trim(), continentHint].filter(Boolean).join(" ") ||
          (locale === "fr" ? "Propose-moi un voyage adapté à mes critères." : "Suggest a trip matching my criteria."),

        locale,
        preferences: {
          travel_styles: styles as any,
          pace: (pace || null) as any,
          budget_total: budgetInput ? Number(budgetInput) : null,
          destination: destination.trim() || null,
          states_count: isUnitedStates && statesCount ? Number(statesCount) : null,

          duration_days: duration ? Number(duration) : null,
          travelers_count: travelers ? Number(travelers) : null,
          departure_city: departure.trim() || null,
          month: month || null,
          trip_shape: (tripShape || null) as any
        }
      });
      setResult(response);
      const list = await api.listTrips();
      setTrips(list);
    } catch (error) {
      const message = (error as Error).message;
      if (/subscription_required/.test(message)) {
        // The trial ran out mid-session: refresh the account so the paywall shows.
        setPlanError(t.subscriptionRequired);
        api.me().then(setUser).catch(() => null);
      } else {
        setPlanError(
          /planning_interrupted/.test(message) ? t.planningInterrupted : /fetch/i.test(message) ? t.serverDown : message
        );
      }
    } finally {
      setPlanning(false);
    }
  }

  // The plan is one blocking request of one to three minutes: without a ticking
  // timer and a visible step, it reads as a frozen page.
  useEffect(() => {
    if (!planning) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const id = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [planning]);

  const planningStep = Math.min(Math.floor(elapsed / 25), PLANNING_STEPS[locale].length - 1);

  // Saved trips already carry their full plan, so reopening one is just
  // restoring it into the results view — no re-planning, no server round-trip.
  function openTrip(trip: any) {
    if (!trip?.plan_json) return;
    setResult({ ...trip.plan_json, trip_id: trip.id });
    setGuideError("");
    setGuideSent("");
    setPage("planner");
    window.setTimeout(
      () => document.querySelector(".results")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50
    );
  }

  async function handleLogout() {
    await api.logout();
    setUser(null);
    setResult(null);
  }

  async function handleGuide(action: "download" | "preview" | "pdf") {
    if (!result?.trip_id) return;
    setGuideBusy(true);
    setGuideError("");
    setGuideSent("");
    try {
      const run = action === "download" ? downloadGuide : action === "pdf" ? downloadGuidePdf : previewGuide;
      await run(result.trip_id, locale);
    } catch {
      setGuideError(action === "pdf" ? t.pdfError : t.guideError);
    } finally {
      setGuideBusy(false);
    }
  }

  async function handleChooseStay(index: number) {
    if (!result) return;
    const structured = result.structured_json as any;
    if (!structured?.research) return;
    // Optimistic: the choice is visible at once, and stored on the trip when
    // it has been saved.
    setResult({ ...result, structured_json: { ...structured, research: { ...structured.research, chosen_stay_index: index } } });
    if (result.trip_id) {
      try {
        await api.chooseStay(result.trip_id, index);
      } catch {
        // The choice stays local for this session.
      }
    }
  }

  async function handleEmailGuide() {
    if (!result?.trip_id) return;
    setGuideBusy(true);
    setGuideError("");
    setGuideSent("");
    try {
      const sent = await api.emailGuide(result.trip_id, locale, emailTo.trim() || undefined);
      setGuideSent(`${t.guideSent} ${sent.to}`);
    } catch (error) {
      // The API returns a readable message when SMTP is not configured yet.
      const raw = (error as Error).message;
      const parsed = raw.startsWith("{") ? (JSON.parse(raw).message as string | undefined) : undefined;
      setGuideError(parsed ?? t.guideEmailError);
    } finally {
      setGuideBusy(false);
    }
  }

  const structured = result?.structured_json as any;
  const research = structured?.research;
  const budget = structured?.budget_estimate;
  const itinerary = structured?.itinerary;
  const carRental = research?.car_rental;
  const searchLinks: any[] = research?.search_links ?? [];
  const experienceLinks: any[] = itinerary?.experience_links ?? [];
  const excursions: any[] = itinerary?.suggested_excursions ?? [];
  const mapRoutes = useMemo(() => routesFromItinerary(itinerary?.itinerary_by_day), [itinerary]);
  const stays: any[] = research?.recommended_stays ?? [];
  const chosenStayIndex: number | null = Number.isInteger(research?.chosen_stay_index) ? research.chosen_stay_index : null;
  const chosenStay = chosenStayIndex !== null ? stays[chosenStayIndex] : null;
  const hotelPoint = useMemo(
    () => (chosenStay?.coordinates ? { name: String(chosenStay.name), lat: chosenStay.coordinates.lat, lon: chosenStay.coordinates.lon } : null),
    [chosenStay]
  );
  const travelTimes = useHotelTravelTimes(hotelPoint, itinerary?.itinerary_by_day);

  const budgetBadge = (fit?: string) =>
    fit === "within_budget" ? (
      <span className="badge ok">{t.withinBudget}</span>
    ) : fit === "over_budget" ? (
      <span className="badge warn">{t.overBudget}</span>
    ) : null;

  return (
    <div className="app-shell">
      {(planning || demoPlane) && (
        <div className="planning-overlay" role="status" aria-live="polite">
          <Plane3D />
          <div className="planning-overlay-text">
            <strong>{planning ? PLANNING_STEPS[locale][planningStep] : PLANNING_STEPS[locale][1]}</strong>
            <small>
              {planning ? formatElapsed(elapsed) : "0:42"} · {t.planningHint}
            </small>
          </div>
        </div>
      )}
      {user ? (
        <header className="hero">
          <div className="hero-brand">
            <h1 className="brand-logo brand-logo-dark">
              <img src="/logo.png" alt={t.title} />
            </h1>
            <p>{t.subtitle}</p>
          </div>
          <div className="toolbar">
            <nav className="hero-nav" aria-label="Navigation">
              <button
                type="button"
                className={`ghost${page === "planner" ? " is-active" : ""}`}
                onClick={() => setPage("planner")}
              >
                {t.navPlan}
              </button>
              <button
                type="button"
                className={`ghost${page === "trips" ? " is-active" : ""}`}
                onClick={() => setPage("trips")}
              >
                {t.navTrips}
                {trips.length > 0 && <span className="nav-count">{trips.length}</span>}
              </button>
            </nav>
            <label>
              {t.language}
              <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
                <option value="fr">FR</option>
                <option value="en">EN</option>
              </select>
            </label>
            {user.billing_enabled && (user.subscription_status === "active" || user.subscription_status === "trialing") && (
              <button className="ghost sub-badge" onClick={handleManageBilling} disabled={billingBusy} title={t.manageBilling}>
                {user.subscription_status === "trialing" ? t.trialActiveBadge : t.subActiveBadge}
              </button>
            )}
            <button className="ghost" onClick={handleLogout}>
              {t.logout}
            </button>
          </div>
        </header>
      ) : (
        <div className="topbar">
          <a className="brand-logo brand-logo-dark topbar-logo" href="/" aria-label={t.title}>
            <img src="/logo.png" alt={t.title} />
          </a>
          <label>
            {t.language}
            <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              <option value="fr">FR</option>
              <option value="en">EN</option>
            </select>
          </label>
        </div>
      )}

      {page === "legal" ? (
        <LegalPage
          locale={locale}
          active={legalDoc}
          onSelect={setLegalDoc}
          onBack={() => setPage("planner")}
          backLabel={user ? t.navPlan : t.backHome}
        />
      ) : !user ? (
        <main className="landing">
          <section className="hero-landing">
            <span className="pill">
              <span className="pill-icon">{featureIcons.compass}</span>
              {EYEBROW[locale]}
            </span>
            <h1 className="hero-title">{t.title}</h1>
            <p className="hero-tagline">{t.tagline}</p>
            <div className="hero-plane" aria-hidden="true">
              <img className="hero-card" src="/logo-hero.webp" alt="" width="860" height="577" />
            </div>
            <div className="hero-actions">
              <button onClick={() => document.getElementById("connexion")?.scrollIntoView({ behavior: "smooth" })}>
                {t.ctaStart}
              </button>
              <button
                className="secondary"
                onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
              >
                {t.ctaHow}
              </button>
            </div>
          </section>

          <section className="about-section" id="about">
            <h2 className="section-title">{ABOUT[locale].title}</h2>
            <div className="about-text">
              {ABOUT[locale].paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
            </div>
          </section>

          <section className="features-section">
            <h2 className="section-title">{t.featuresTitle}</h2>
            <p className="section-sub">{t.featuresSub}</p>
            <div className="feature-grid">
              {FEATURES.map((feature) => (
                <article key={feature[locale].title} className="feature-card">
                  <span className="feature-icon">{featureIcons[feature.icon as keyof typeof featureIcons]}</span>
                  <h3>{feature[locale].title}</h3>
                  <p>{feature[locale].desc}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="how-section" id="how">
            <h2 className="section-title">{t.howTitle}</h2>
            <p className="section-sub">{t.howSub}</p>
            <ol className="steps">
              {STEPS.map((step, index) => (
                <li key={step[locale].title}>
                  <span className="step-number">{index + 1}</span>
                  <div>
                    <strong>{step[locale].title}</strong>
                    <p>{step[locale].desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="faq-section" id="faq">
            <h2 className="section-title">{FAQ[locale].title}</h2>
            <dl className="faq-list">
              {FAQ[locale].items.map((item) => (
                <div key={item.q} className="faq-item">
                  <dt>{item.q}</dt>
                  <dd>{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="cta-section" id="connexion">
            <div className="cta-card">
              <h2 className="section-title">{t.ctaCardTitle}</h2>
              <p className="section-sub">{t.ctaCardSub}</p>
              <div className="card auth-card">
                <h2>{isRegisterMode ? t.register : t.login}</h2>
                <p className="auth-sub">{t.authSub}</p>
                <form onSubmit={handleAuthSubmit}>
                  <label>
                    {t.email}
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </label>
                  <label>
                    {t.password}
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                  </label>
                  {authError && <p className="error-text">{authError}</p>}
                  <button type="submit">{isRegisterMode ? t.register : t.login}</button>
                </form>
                <div className="auth-divider"><span>{t.orDivider}</span></div>
                <a className="google-btn" href={api.googleLoginUrl()}>
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                  </svg>
                  {t.googleLogin}
                </a>
                <button className="link" onClick={() => setRegisterMode((v) => !v)}>
                  {isRegisterMode ? t.login : t.register}
                </button>
              </div>
            </div>
          </section>

          <footer className="site-footer">
            <div className="footer-grid">
              <div>
                <img className="footer-logo" src="/logo.png" alt={t.title} />
                <p>{t.footerDesc}</p>
              </div>
              <div>
                <strong>{t.footerGuides}</strong>
                {SEO_GUIDES.map((guide) => (
                  <p key={guide.href}><a className="footer-link" href={guide.href}>{guide[locale]}</a></p>
                ))}
              </div>
              <div>
                <strong>{t.footerLinks}</strong>
                <p><button type="button" className="link footer-link" onClick={() => openLegal("privacy")}>{t.footerPrivacy}</button></p>
                <p><button type="button" className="link footer-link" onClick={() => openLegal("terms")}>{t.footerTerms}</button></p>
                <p><button type="button" className="link footer-link" onClick={() => openLegal("sales")}>{t.footerSales}</button></p>
              </div>
              <div>
                <strong>{t.footerContact}</strong>
                <p><a href="mailto:contact@monpetitvoyageur.fr">contact@monpetitvoyageur.fr</a></p>
              </div>
            </div>
            <p className="footer-copy">© 2026 {t.title}. {t.footerRights}</p>
          </footer>
        </main>
            ) : user.billing_enabled && !user.has_access ? (
        <main className="layout paywall-page">
          <section className="card paywall">
            <h2>{t.planTitle}</h2>
            <p className="section-sub">{user.subscription_status === "past_due" || user.trial_used ? t.subscriptionRequired : t.planSub}</p>
            <PricingPlans t={t} trialUsed={user.trial_used} busy={billingBusy} onChoose={handleCheckout} />
            {billingMsg && <p className="error-text">{billingMsg}</p>}
          </section>
        </main>
            ) : page === "trips" ? (
        <main className="layout trips-page">
          <section className="card trips">
            <div className="trips-head">
              <div>
                <h3>{t.recentTrips}</h3>
                <p className="trips-hint">{t.tripsHint}</p>
              </div>
              <button type="button" className="secondary" onClick={() => setPage("planner")}>
                {t.navPlan}
              </button>
            </div>

            {trips.length === 0 ? (
              <div className="trips-empty">
                <span className="feature-icon">{featureIcons.compass}</span>
                <p>{t.tripsEmpty}</p>
                <button type="button" onClick={() => setPage("planner")}>
                  {t.tripsEmptyCta}
                </button>
              </div>
            ) : (
              <div className="trip-grid">
                {trips.map((trip) => {
                  const brief = trip.brief_json ?? {};
                  const dates = brief.exact_dates ?? {};
                  const isOpen = result?.trip_id === trip.id;
                  const destination = brief.destination ?? trip.title?.replace(/^Trip - /, "") ?? "";
                  const dateLabel =
                    dates.start && dates.end
                      ? `${formatDate(dates.start, locale)} → ${formatDate(dates.end, locale)}`
                      : brief.date_window ?? t.datesFlexible;
                  const facts = [
                    brief.duration_days ? `${brief.duration_days} ${t.daysShort}` : null,
                    brief.travelers_count ? `${brief.travelers_count} ${t.travelersShort}` : null,
                    brief.budget_total ? `${brief.budget_total} ${brief.currency ?? "EUR"}` : null
                  ].filter(Boolean);
                  return (
                    <article key={trip.id} className={`trip-card${isOpen ? " is-open" : ""}`}>
                      <div className="trip-card-head">
                        <span className="trip-card-icon">{featureIcons.map}</span>
                        {isOpen && <span className="tag">{t.tripOpen}</span>}
                      </div>
                      <h4>{destination || trip.title}</h4>
                      <p className="trip-card-dates">{dateLabel}</p>
                      {facts.length > 0 && <p className="trip-card-facts">{facts.join(" · ")}</p>}
                      <small>
                        {t.updatedOn} {formatDate(trip.updated_at, locale)}
                      </small>
                      <button type="button" onClick={() => openTrip(trip)}>
                        {t.openTrip}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      ) : (
        <main className="layout">
          <section className="card planner">
            <h2>{t.plannerTitle}</h2>
            <form onSubmit={handlePlan}>
              <div className="question-block">
                <span className="question-label">{t.styleQuestion}</span>
                <div className="style-chips">
                  {TRAVEL_STYLES.map((style) => (
                    <button
                      key={style.key}
                      type="button"
                      className={`style-chip ${styles.includes(style.key) ? "selected" : ""}`}
                      onClick={() => toggleStyle(style.key)}
                    >
                      {style[locale]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-grid">
                <label>
                  {t.budgetLabel}
                  <input type="number" min={100} step={50} value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} placeholder="1500" />
                </label>
                <label>
                  {t.continentLabel}
                  <select value={continentKey} onChange={(e) => handleContinentChange(e.target.value)}>
                    <option value="">{t.anyDestination}</option>
                    {DESTINATION_CATALOGUE.map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry[locale]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.countryLabel}
                  <select value={countryName} onChange={(e) => handleCountryChange(e.target.value)} disabled={!continent}>
                    <option value="">{continent ? t.anyCountry : t.pickContinentFirst}</option>
                    {(continent?.countries ?? []).map((entry) => (
                      <option key={entry.name} value={entry.name}>
                        {placeLabel(entry, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                {isUnitedStates && (
                  <label>
                    {t.stateLabel}
                    <select value={stateName} onChange={(e) => handleStateChange(e.target.value)}>
                      <option value="">{t.anyState}</option>
                      {US_STATES.map((entry) => (
                        <option key={entry.name} value={entry.name}>
                          {placeLabel(entry, locale)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  {t.cityLabel}
                  <select value={cityName} onChange={(e) => setCityName(e.target.value)} disabled={!cityOptions.length}>
                    <option value="">
                      {cityOptions.length ? t.anyCity : isUnitedStates ? t.pickStateFirst : t.pickCountryFirst}
                    </option>

                    {cityOptions.map((entry) => (
                      <option key={entry.name} value={entry.name}>
                        {placeLabel(entry, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                {isUnitedStates && (
                  <label>
                    {t.statesCountLabel}
                    <select value={statesCount} onChange={(e) => setStatesCount(e.target.value)}>
                      <option value="">{t.statesCountAny}</option>
                      {US_STATE_COUNTS.map((count) => (
                        <option key={count} value={String(count)}>
                          {count === 1 ? t.oneState : `${count} ${t.severalStates}`}
                        </option>
                      ))}
                    </select>
                    <small className="field-hint">{t.statesCountHint}</small>
                  </label>
                )}

                <label>
                  {t.durationLabel}
                  <input type="number" min={2} max={90} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="7" />
                </label>
                <label>
                  {t.travelersLabel}
                  <input type="number" min={1} max={30} value={travelers} onChange={(e) => setTravelers(e.target.value)} />
                </label>
                <label>
                  {t.paceLabel}
                  <select value={pace} onChange={(e) => setPace(e.target.value)}>
                    <option value="slow">{t.paceSlow}</option>
                    <option value="moderate">{t.paceModerate}</option>
                    <option value="fast">{t.paceFast}</option>
                  </select>
                </label>
                <label>
                  {t.shapeLabel}
                  <select value={tripShape} onChange={(e) => setTripShape(e.target.value)}>
                    <option value="base">{t.shapeBase}</option>
                    <option value="roadtrip">{t.shapeRoadtrip}</option>
                  </select>
                </label>
                <label>
                  {t.departureLabel}
                  <input type="text" value={departure} onChange={(e) => setDeparture(e.target.value)} placeholder="Paris" />
                </label>
                <label>
                  {t.monthLabel}
                  <select value={month} onChange={(e) => setMonth(e.target.value)}>
                    <option value="">{t.anyMonth}</option>
                    {MONTHS[locale].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                {t.freeTextLabel}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t.plannerPlaceholder}
                  rows={3}
                />
              </label>

              <button type="submit" disabled={!canSubmit}>
                {planning ? t.loading : t.planTrip}
              </button>
              {planError && <p className="error-text">{planError}</p>}
            </form>
          </section>

          {result && (
            <section className="card results">
              <h3>{t.travelerSummary}</h3>
              <p>{result.traveler_summary}</p>

              {result.trip_id && (
                <div className="guide-cta">
                  <div>
                    <strong>{t.guideTitle}</strong>
                    <p>{t.guideSub}</p>
                  </div>
                  <div className="guide-actions">
                    <button onClick={() => handleGuide("download")} disabled={guideBusy}>
                      {guideBusy ? t.guideBusy : t.downloadGuide}
                    </button>
                    <button className="secondary" onClick={() => handleGuide("pdf")} disabled={guideBusy}>
                      {t.downloadPdf}
                    </button>
                    <button className="secondary" onClick={() => handleGuide("preview")} disabled={guideBusy}>
                      {t.previewGuide}
                    </button>
                  </div>
                  <div className="guide-email">
                    <input
                      type="email"
                      value={emailTo}
                      onChange={(event) => setEmailTo(event.target.value)}
                      placeholder={user?.email ?? t.emailPlaceholder}
                      aria-label={t.emailGuide}
                    />
                    <button className="secondary" onClick={handleEmailGuide} disabled={guideBusy}>
                      {t.emailGuide}
                    </button>
                  </div>
                  {guideSent && <p className="success-text">{guideSent}</p>}
                  {guideError && <p className="error-text">{guideError}</p>}
                </div>
              )}

              {budget && (
                <>
                  <h4>{t.budget}</h4>
                  <p>
                    {budget.estimated_total?.min} – {budget.estimated_total?.max} {budget.estimated_total?.currency}{" "}
                    <span className={`badge ${budget.feasibility === "good" ? "ok" : "warn"}`}>{budget.feasibility}</span>
                  </p>
                </>
              )}

              <h4>{t.flightsHotels}</h4>
              {(research?.price_calendar ?? []).length > 0 && (
                <div className="price-strip" aria-label={t.calendarTitle}>
                  <p className="price-strip-title">
                    {t.calendarTitle}
                    <small>{research?.calendar_source === "travelpayouts" ? t.calendarSourceCalendar : t.calendarSourceSampled}</small>
                  </p>
                  <div className="price-strip-days">
                    {(research.price_calendar as any[]).map((day) => (
                      <div key={day.date} className={`price-day${day.chosen ? " is-chosen" : ""}`} title={day.date}>
                        <span>{Number(day.date.slice(8, 10))}</span>
                        <strong>{day.price} €</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(research?.internal_flights ?? []).length > 0 && (
                <div className="internal-flights">
                  <p className="internal-flights-title">{t.internalFlightsTitle}</p>
                  {(research.internal_flights as any[]).map((leg) => (
                    <p key={`${leg.day}-${leg.from}-${leg.to}`} className="internal-flight">
                      <strong>
                        {t.dayShort} {leg.day} · {leg.from} → {leg.to}
                      </strong>
                      {leg.search_links.map((link: any) => (
                        <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                          {link.label} ↗
                        </a>
                      ))}
                    </p>
                  ))}
                </div>
              )}
              <div className="compact-grid">
                {(research?.recommended_flights ?? []).slice(0, 3).map((f: any, idx: number) => (

                  <article key={`flight-${idx}`}>
                    <span className="tag">{t.flightTag}</span>
                    <br />
                    <strong>{f.label}</strong>
                    <p>
                      {f.price ?? "?"} {f.currency ?? "EUR"} {budgetBadge(f.budget_fit)}
                    </p>
                    <small>
                      {[
                        f.total_duration,
                        f.stops == null ? null : f.stops === 0 ? t.direct : `${f.stops} ${t.stops}`,
                        (f.notes ?? []).find((n: string) => n.startsWith("Carrier:"))?.replace("Carrier: ", "")
                      ]
                        .filter(Boolean)
                        .join(" · ") || "-"}
                    </small>
                    {f.booking_url && (
                      <a className="book-link" href={f.booking_url} target="_blank" rel="noreferrer">
                        {t.book} ↗
                      </a>
                    )}
                  </article>
                ))}
                {stays.slice(0, 3).map((s: any, idx: number) => (
                  <article key={`stay-${idx}`} className={chosenStayIndex === idx ? "stay-card chosen" : "stay-card"}>
                    {s.photo_url && <img className="stay-photo" src={s.photo_url} alt={s.name} loading="lazy" />}
                    <span className="tag">{t.stayTag}</span>
                    <br />
                    <strong>{s.name}</strong>
                    <p>
                      {s.price_per_night ?? "?"} {s.currency ?? "EUR"}
                      {t.perNight} {budgetBadge(s.budget_fit)}
                    </p>
                    <small>
                      {[s.rating ? `${s.rating} ★` : null, s.area, (s.notes ?? [])[0]].filter(Boolean).join(" · ") || "-"}
                    </small>
                    {s.booking_url && (
                      <a className="book-link" href={s.booking_url} target="_blank" rel="noreferrer">
                        {t.book} ↗
                      </a>
                    )}
                    <button
                      type="button"
                      className={chosenStayIndex === idx ? "choose-stay chosen" : "choose-stay secondary"}
                      onClick={() => handleChooseStay(idx)}
                    >
                      {chosenStayIndex === idx ? t.chosenStay : t.chooseStay}
                    </button>
                  </article>
                ))}
              </div>
              {stays.length > 0 && chosenStayIndex === null && <p className="stay-hint"><small>{t.chooseStayHint}</small></p>}

              {carRental?.recommended && (
                <>
                  <h4>{t.carTitle}</h4>
                  <article className="car-card">
                    {carRental.recommended.photo?.url && (
                      <img className="car-photo" src={carRental.recommended.photo.url} alt={carRental.recommended.example_model ?? carRental.recommended.category} loading="lazy" />
                    )}
                    <div className="car-card-head">
                      <strong>{carRental.recommended.category}</strong>
                      <span className="badge ok">{t.carRecommended}</span>
                    </div>
                    {carRental.recommended.example_model && (
                      <p>
                        <small>
                          {t.carModel} : {carRental.recommended.example_model}
                        </small>
                      </p>
                    )}
                    <p>
                      {carRental.recommended.price_per_day_eur !== null && (
                        <>
                          ~{Math.round(carRental.recommended.price_per_day_eur)} {t.carPerDay}
                          {carRental.recommended.total_estimate_eur !== null && (
                            <>
                              {" · "}~{Math.round(carRental.recommended.total_estimate_eur)} € {t.carTotalLabel}
                            </>
                          )}
                        </>
                      )}
                    </p>
                    <p className="car-pickup">
                      <small>{carRental.recommended.pickup_note}</small>
                    </p>
                    <details>
                      <summary>{t.carAlerts}</summary>
                      <ul className="car-alerts">
                        {(carRental.alerts ?? []).map((alert: string) => (
                          <li key={alert}>{alert}</li>
                        ))}
                      </ul>
                    </details>
                    <div className="link-chips">
                      {(carRental.recommended.booking_links ?? []).map((link: any) => (
                        <a key={link.url} className="chip" href={link.url} target="_blank" rel="noreferrer">
                          {link.label} ↗
                        </a>
                      ))}
                    </div>
                  </article>
                </>
              )}

              {searchLinks.length > 0 && (
                <>
                  {((result.structured_json as any)?.itinerary?.forum_findings ?? []).length > 0 && (
                    <>
                      <h4>{t.forumTitle}</h4>
                      <ul className="forum-list">
                        {((result.structured_json as any).itinerary.forum_findings as any[])
                          .filter((finding) => /^https?:\/\//i.test(String(finding.url ?? "")))
                          .slice(0, 6)
                          .map((finding) => (
                          <li key={finding.url}>
                            <span className="tag">{finding.source || "Forum"}</span>
                            <strong>{finding.title}</strong>
                            {finding.snippet && <small>{finding.snippet}</small>}
                            <a className="book-link" href={finding.url} target="_blank" rel="noreferrer">
                              {t.readThread} ↗
                            </a>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <h4>{t.bookingLinks}</h4>
                  <div className="link-chips">
                    {searchLinks.map((link: any) => (
                      <a key={link.url} className="chip" href={link.url} target="_blank" rel="noreferrer">
                        {link.label} ↗
                      </a>
                    ))}
                  </div>
                </>
              )}

              {excursions.length > 0 && (
                <>
                  <h4>{t.excursionsTitle}</h4>
                  <div className="compact-grid excursion-grid">
                    {excursions.map((exc: any) => (
                      <article key={exc.title} className="day-card">
                        {exc.photo?.url && (
                          <img className="day-card-photo" src={exc.photo.url} alt={exc.title} loading="lazy" />
                        )}
                        <PhotoCredit photo={exc.photo} />
                        <span className="tag">{exc.style ?? t.excursionTag}</span>
                        <br />
                        <strong>{exc.title}</strong>
                        <p className="excursion-desc">
                          <small>{exc.description}</small>
                        </p>
                        <p className="excursion-meta">
                          {exc.duration && <span>{exc.duration}</span>}
                          {exc.price_estimate_eur !== null && (
                            <span>
                              {exc.price_estimate_eur === 0 ? t.freeLabel : `~${exc.price_estimate_eur} ${t.perPerson}`}
                            </span>
                          )}
                        </p>
                        {exc.booking_url && (
                          <a className="book-link" href={exc.booking_url} target="_blank" rel="noreferrer">
                            {t.book} ↗
                          </a>
                        )}
                      </article>
                    ))}
                  </div>
                </>
              )}

              {experienceLinks.length > 0 && (
                <>
                  <h4>{t.experiences}</h4>
                  <div className="link-chips">
                    {experienceLinks.map((link: any) => (
                      <a key={link.url} className="chip" href={link.url} target="_blank" rel="noreferrer">
                        {link.label} ↗
                      </a>
                    ))}
                  </div>
                </>
              )}

              {(itinerary?.itinerary_by_day ?? []).length > 0 && (
                <>
                  <h4>{t.itinerary}</h4>
                  <TripMap routes={mapRoutes} locale={locale} hotel={hotelPoint} />
                  <div className="compact-grid day-grid">
                    {itinerary.itinerary_by_day.map((day: any) => (
                      <article key={day.day} className="day-card">
                        {day.photo?.url && (
                          <img className="day-card-photo" src={day.photo.url} alt={day.title} loading="lazy" />
                        )}
                        <PhotoCredit photo={day.photo} />
                        <strong>{day.title}</strong>
                        {day.theme && <span className="tag">{day.theme}</span>}
                        {day.route?.to && (
                          <p className="day-route">
                            <small>
                              {[day.route.from, day.route.to].filter(Boolean).join(" → ")}
                              {day.route.duration ? ` · ${day.route.duration}` : ""}
                              {day.route.distance_km ? ` · ${day.route.distance_km} km` : ""}
                            </small>
                          </p>
                        )}
                        <p>
                          <small>
                            {t.morning}: {day.morning}
                            <br />
                            {t.afternoon}: {day.afternoon}
                            <br />
                            {t.evening}: {day.evening}
                          </small>
                        </p>
                        {day.lodging?.name && (
                          <p className={`day-facet day-lodging${day.lodging.is_change ? " day-lodging-change" : ""}`}>
                            <em>{day.lodging.is_change ? t.lodgingChange : t.lodgingSame}</em>
                            <small>
                              {day.lodging.name}
                              {day.lodging.town ? ` · ${day.lodging.town}` : ""}
                              {day.lodging.price_per_night_eur
                                ? ` · ${day.lodging.price_per_night_eur}${
                                    day.lodging.price_max_per_night_eur &&
                                    day.lodging.price_max_per_night_eur !== day.lodging.price_per_night_eur
                                      ? `–${day.lodging.price_max_per_night_eur}`
                                      : ""
                                  } € / ${locale === "fr" ? "nuit" : "night"}`
                                : ""}
                            </small>
                          </p>
                        )}
                        {(day.free_visits ?? []).length > 0 && (
                          <p className="day-facet">
                            <em>{t.freeVisitsLabel}</em>
                            <small>
                              {day.free_visits
                                .map((visit: any) => `${visit.name}${travelTimes[visit.name] ? ` (${legLabel(travelTimes[visit.name], locale)})` : ""}`)
                                .join(" · ")}
                            </small>
                          </p>
                        )}
                        {(day.paid_options ?? []).length > 0 && (
                          <div className="day-facet">
                            <em>{t.optionsLabel}</em>
                            <div className="option-list">
                              {day.paid_options.map((option: any) => {
                                const alt = option.local_alternative;
                                const channel: string = alt?.best_channel && alt.best_channel !== "unknown" ? alt.best_channel : alt?.typical_saving ? "unknown" : "";
                                const leg = travelTimes[option.title];
                                return (
                                  <div key={`${day.day}-${option.option_label}`} className="option-card">
                                    {option.photo?.url && <img className="option-photo" src={option.photo.url} alt={option.title} loading="lazy" />}
                                    <div className="option-body">
                                      <div className="option-head">
                                        <span className="tag">{option.option_label}</span>
                                        <strong>{option.title}</strong>
                                      </div>
                                      <small className="option-meta">
                                        {[
                                          option.category ? CATEGORY_LABELS[locale][option.category] ?? option.category : null,
                                          option.duration,
                                          option.price_from_eur != null ? `${option.price_source === "getyourguide" ? (locale === "fr" ? "dès " : "from ") : "~"}${option.price_from_eur} ${t.perPersonShort}` : null,
                                          day.date ? new Date(`${day.date}T12:00:00`).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long" }) : null
                                        ]
                                          .filter(Boolean)
                                          .join(" · ")}
                                      </small>
                                      {leg && (
                                        <small className="option-leg">
                                          {t.fromHotel} {legLabel(leg, locale)}
                                        </small>
                                      )}
                                      {option.crossing?.from_port && (
                                        <small className="option-crossing">
                                          {t.crossing} {option.crossing.from_port}
                                          {option.crossing.price_eur != null ? ` · ${option.crossing.price_eur} ${t.perPersonShort}` : ""}
                                          {option.crossing.note ? ` · ${option.crossing.note}` : ""}
                                        </small>
                                      )}
                                      {channel && (
                                        <small className="saving-hint">
                                          {(t.bestChannel as any)[channel]}
                                          {alt?.on_site_price_eur != null ? ` · ${alt.on_site_price_eur} ${t.perPersonShort} ${t.onSite}` : ""}
                                          {alt?.typical_saving ? ` · ${alt.typical_saving}` : ""}
                                          {alt?.advice ? ` — ${alt.advice}` : alt?.how_to_book ? ` — ${alt.how_to_book}` : ""}
                                        </small>
                                      )}
                                      <div className="link-chips">
                                        {(option.booking_links ?? []).map((link: any) => (
                                          <a key={link.url} className="chip" href={link.url} target="_blank" rel="noreferrer">
                                            {link.label} ↗
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {(day.restaurants ?? []).length > 0 && (
                          <p className="day-facet">
                            <em>{t.restaurantsLabel}</em>
                            <small>
                              {day.restaurants
                                .map((resto: any) => `${resto.name} (${resto.price_range}${resto.rating != null ? ` · ★ ${resto.rating}` : ""})`)
                                .join(" · ")}
                            </small>
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                </>
              )}

              <h4>{t.openVerifications}</h4>
              <ul>
                {result.open_verifications.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>

              <h4>{t.nextSteps}</h4>
              <ul>
                {result.next_steps.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>

              <details>
                <summary>{t.trace}</summary>
                <pre>{JSON.stringify(result.trace, null, 2)}</pre>
              </details>
            </section>
          )}
        </main>
      )}
    </div>
  );
}

export default function App() {
  const isPublishedAdmin = window.location.hostname.startsWith("mon-petit-voyageur-admin.");
  return isPublishedAdmin || window.location.pathname.startsWith("/admin") ? <AdminDashboard /> : <TravelerApp />;
}

// "2026-09-05" → "5 sept. 2026" in the reader's language; ISO timestamps too.
/**
 * Author and source of a photo, as the libraries (Pexels, Unsplash, Openverse)
 * and Wikimedia licenses require. Pexels asks for the link to pexels.com.
 */
function PhotoCredit({ photo }: { photo: any }) {
  if (!photo?.url || !photo.credit) return null;
  const isPexels = /pexels/i.test(photo.credit);
  return (
    <small className="photo-credit">
      {photo.source_url ? (
        <a href={photo.source_url} target="_blank" rel="noopener noreferrer">{photo.credit}</a>
      ) : (
        photo.credit
      )}
      {isPexels && (
        <>
          {" · "}
          <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a>
        </>
      )}
    </small>
  );
}

/** The two subscription plans, shown on the paywall. */
function PricingPlans({
  t,
  trialUsed,
  busy,
  onChoose
}: {
  t: (typeof text)["fr"] | (typeof text)["en"];
  trialUsed: boolean;
  busy: boolean;
  onChoose: (plan: "monthly" | "annual") => void;
}) {
  const cta = trialUsed ? t.planCta : t.planTrialCta;
  return (
    <div className="pricing">
      <div className="pricing-grid">
        <article className="plan-card">
          <h3>{t.planMonthlyName}</h3>
          <p className="plan-price">
            <strong>{t.planMonthlyPrice}</strong> <span>{t.planMonthlyPer}</span>
          </p>
          <ul className="plan-features">
            {t.planFeatures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <button type="button" onClick={() => onChoose("monthly")} disabled={busy}>
            {cta}
          </button>
        </article>
        <article className="plan-card is-featured">
          <span className="plan-badge">{t.planPopular}</span>
          <h3>{t.planAnnualName}</h3>
          <p className="plan-price">
            <strong>{t.planAnnualPrice}</strong> <span>{t.planAnnualPer}</span>
          </p>
          <p className="plan-save">{t.planAnnualNote}</p>
          <ul className="plan-features">
            {t.planFeatures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <button type="button" onClick={() => onChoose("annual")} disabled={busy}>
            {cta}
          </button>
        </article>
      </div>
      {trialUsed && <p className="plan-note">{t.planTrialUsedNote}</p>}
      <p className="plan-reassurance">{t.planReassurance}</p>
    </div>
  );
}

function formatDate(value: string, locale: "fr" | "en"): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
}
