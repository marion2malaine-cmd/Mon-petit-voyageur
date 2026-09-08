// Public homepage copy shared between the React landing (App.tsx) and the
// crawler-facing static HTML in index.html (checked by src/test/seo.test.ts so
// the two never drift). Everything here describes what the product really
// does today — no feature, price or figure that the app does not ship.

export type HomeLocale = "fr" | "en";

export const SITE_URL = "https://www.monpetitvoyageur.com";

export const SEO = {
  fr: {
    title: "Mon Petit Voyageur · Planificateur de voyage et road trip IA",
    description:
      "Décrivez votre voyage, l'IA de Mon Petit Voyageur crée l'itinéraire jour par jour : vols et hôtels au prix réel, activités, restaurants, budget et guide illustré."
  },
  en: {
    title: "My Little Traveler · AI trip and road trip planner",
    description:
      "Describe your trip and My Little Traveler's AI builds the day-by-day itinerary: real flight and hotel prices, activities, restaurants, budget and an illustrated guide."
  }
} as const;

export const EYEBROW = {
  fr: "Planificateur de voyage et road trip par IA",
  en: "AI trip and road trip planner"
} as const;

export const FEATURES = [
  {
    icon: "compass",
    fr: { title: "Destination optimale", desc: "Notre IA analyse vos préférences et trouve la destination parfaite selon votre budget, style et période." },
    en: { title: "Optimal destination", desc: "Our AI analyzes your preferences and finds the perfect destination for your budget, style and dates." }
  },
  {
    icon: "plane",
    fr: { title: "Billets au meilleur prix", desc: "Comparaison des vols en temps réel et liens directs Skyscanner et Google Flights pré-remplis." },
    en: { title: "Tickets at the best price", desc: "Real-time flight comparison with pre-filled Skyscanner and Google Flights links." }
  },
  {
    icon: "map",
    fr: { title: "Itinéraire sur mesure", desc: "Planning jour par jour personnalisé selon votre typologie de voyage, avec options de repli météo." },
    en: { title: "Tailor-made itinerary", desc: "Day-by-day plan personalized to your travel style, with weather backup options." }
  },
  {
    icon: "bed",
    fr: { title: "Hébergements dans le budget", desc: "Sélection dans votre enveloppe, avec recherches Booking et Airbnb pré-remplies." },
    en: { title: "Stays within budget", desc: "Picks within your envelope, with pre-filled Booking and Airbnb searches." }
  },
  {
    icon: "ticket",
    fr: { title: "Excursions & activités", desc: "Suggestions concrètes avec durée et prix par personne, réservables sur GetYourGuide et Civitatis." },
    en: { title: "Tours & activities", desc: "Concrete suggestions with duration and per-person price, bookable on GetYourGuide and Civitatis." }
  },
  {
    icon: "dining",
    fr: { title: "Restaurants & bonnes tables", desc: "Les meilleures adresses locales via TheFork et TripAdvisor, réservation en un clic." },
    en: { title: "Restaurants & great tables", desc: "The best local spots via TheFork and TripAdvisor, one-click booking." }
  }
] as const;

export const STEPS = [
  {
    fr: { title: "Répondez au questionnaire", desc: "Partagez vos préférences : budget, style de voyage, période, durée et ville de départ." },
    en: { title: "Answer the questionnaire", desc: "Share your preferences: budget, travel style, dates, duration and departure city." }
  },
  {
    fr: { title: "Découvrez votre itinéraire personnalisé", desc: "Notre IA génère un planning complet avec vols, hébergements, activités et tous les détails pratiques." },
    en: { title: "Discover your personalized itinerary", desc: "Our AI generates a full plan with flights, stays, activities and all the practical details." }
  },
  {
    fr: { title: "Réservez au meilleur tarif", desc: "Chaque proposition est accompagnée de liens pré-remplis : Skyscanner, Booking, GetYourGuide, TheFork." },
    en: { title: "Book at the best price", desc: "Every suggestion comes with pre-filled links: Skyscanner, Booking, GetYourGuide, TheFork." }
  },
  {
    fr: { title: "Partez l'esprit tranquille", desc: "Checklist de valise, formalités d'entrée et vérifications restantes : rien n'est oublié." },
    en: { title: "Leave with peace of mind", desc: "Packing checklist, entry requirements and open verifications: nothing is forgotten." }
  }
] as const;

/** Plain-language definition of the service: the answer a search engine or an
 *  AI assistant should be able to quote when asked what Mon Petit Voyageur is. */
export const ABOUT = {
  fr: {
    title: "Qu'est-ce que Mon Petit Voyageur ?",
    paragraphs: [
      "Mon Petit Voyageur est un planificateur de voyage assisté par intelligence artificielle, édité par MARA LABS à Lille. Vous décrivez votre projet — budget total, durée, mois de départ, ville de départ, style de voyage et, si vous le souhaitez, une destination — et l'IA construit un programme complet, jour par jour.",
      "Chaque plan réunit les vols et hébergements aux prix constatés en direct, des visites gratuites, des activités payantes de catégories variées, des restaurants bien notés, la météo et les formalités d'entrée, puis un guide illustré à télécharger ou recevoir par email. Le voyage peut être un séjour dans une ville ou un road trip par étapes, avec les temps de route et la carte."
    ]
  },
  en: {
    title: "What is My Little Traveler?",
    paragraphs: [
      "My Little Traveler is an AI-assisted trip planner published by MARA LABS in Lille, France. You describe your project — total budget, length, departure month and city, travel style and, if you like, a destination — and the AI builds a complete day-by-day program.",
      "Each plan gathers flights and stays at live prices, free visits, paid activities across varied categories, well-rated restaurants, the weather and entry requirements, then an illustrated guide to download or receive by email. The trip can be a stay in one city or a multi-stage road trip, with driving times and a map."
    ]
  }
} as const;

/** Visible FAQ. The FAQPage JSON-LD in index.html must list exactly the French
 *  questions and answers below (enforced by src/test/seo.test.ts). */
export const FAQ = {
  fr: {
    title: "Questions fréquentes",
    items: [
      {
        q: "Comment l'IA organise-t-elle mon voyage ?",
        a: "Vous répondez à un court questionnaire (budget, durée, période, style, ville de départ). L'IA choisit ou confirme la destination, recherche les vols et les hôtels aux prix réels, puis écrit le programme jour par jour : visites gratuites, activités payantes, restaurants notés, plan B météo. Les prix affichés viennent des outils de recherche en direct, jamais de l'IA."
      },
      {
        q: "Peut-on planifier un road trip par étapes ?",
        a: "Oui. Au questionnaire, choisissez « Itinérant » : le programme enchaîne les étapes avec un hôtel par tronçon, les temps de route entre villes et une carte du parcours. Aux États-Unis, vous indiquez combien d'États visiter et les vols internes entre étapes sont recherchés."
      },
      {
        q: "Le budget que j'indique est-il respecté ?",
        a: "Le budget total est fixé en amont. Vols et hébergement en sont déduits, et le reste guide le choix des activités et la gamme de prix des restaurants. Chaque proposition porte un badge « dans le budget » ou « au-dessus du budget »."
      },
      {
        q: "Où et comment réserver ?",
        a: "Chaque vol, hôtel, activité et restaurant est accompagné d'un lien pré-rempli vers le site de réservation : Google Flights, Skyscanner, Booking, Airbnb, GetYourGuide, Civitatis, Viator, TheFork ou TripAdvisor. Mon Petit Voyageur ne vend rien lui-même ; certains liens sont affiliés, sans surcoût pour vous."
      },
      {
        q: "Que contient le guide illustré ?",
        a: "Le programme complet jour par jour, les adresses, la carte, les liens de réservation et des photos créditées (Wikimedia Commons, Openverse). Il se télécharge en HTML ou PDF et peut être envoyé par email."
      },
      {
        q: "Quelles destinations sont couvertes ?",
        a: "Le monde entier : vous choisissez un continent, un pays, un État américain ou une ville, ou vous laissez l'IA proposer une destination adaptée à votre budget, votre période et votre style de voyage."
      },
      {
        q: "Faut-il un compte pour créer un voyage ?",
        a: "Oui : l'inscription se fait par email et mot de passe ou avec un compte Google. Vos voyages sont conservés dans votre espace, avec leur programme et leur guide."
      }
    ]
  },
  en: {
    title: "Frequently asked questions",
    items: [
      {
        q: "How does the AI organize my trip?",
        a: "You answer a short questionnaire (budget, length, dates, style, departure city). The AI picks or confirms the destination, searches flights and hotels at real prices, then writes the day-by-day program: free visits, paid activities, rated restaurants, weather backup. Prices come from live search tools, never from the AI."
      },
      {
        q: "Can I plan a multi-stage road trip?",
        a: "Yes. In the questionnaire choose “Touring”: the program chains stages with one hotel per leg, driving times between cities and a route map. In the United States you say how many states to visit and domestic flights between stages are searched."
      },
      {
        q: "Is my budget respected?",
        a: "The total budget is set up front. Flights and stays are deducted, and the remainder guides the activities and the restaurants' price range. Every suggestion carries a “within budget” or “over budget” badge."
      },
      {
        q: "Where and how do I book?",
        a: "Every flight, hotel, activity and restaurant comes with a pre-filled link to the booking site: Google Flights, Skyscanner, Booking, Airbnb, GetYourGuide, Civitatis, Viator, TheFork or TripAdvisor. My Little Traveler sells nothing itself; some links are affiliated, at no extra cost to you."
      },
      {
        q: "What is in the illustrated guide?",
        a: "The full day-by-day program, addresses, the map, booking links and credited photos (Wikimedia Commons, Openverse). It downloads as HTML or PDF and can be sent by email."
      },
      {
        q: "Which destinations are covered?",
        a: "The whole world: pick a continent, a country, a US state or a city, or let the AI suggest a destination that fits your budget, dates and travel style."
      },
      {
        q: "Do I need an account to create a trip?",
        a: "Yes: sign up with email and password or with a Google account. Your trips are kept in your space, with their program and guide."
      }
    ]
  }
} as const;
