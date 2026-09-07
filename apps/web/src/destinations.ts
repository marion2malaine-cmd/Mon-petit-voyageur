/**
 * The destination catalogue of the questionnaire, read top-down: continent,
 * then country — or, for the United States, state — then city.
 *
 * Two rules shaped it. Every entry is a place the flight search knows an
 * airport for (see AIRPORT_CODES in apps/api/src/tools/serpapi.ts), so a
 * chosen destination never degrades to a bare comparator home page. And every
 * level can be left on "peu importe": a traveler who only knows they want
 * Asia still gets a plan, because the destination matcher then does its job.
 */

export interface DestinationPlace {
  /** What is sent as the destination, and what the guide is written about. */
  name: string;
  en?: string;
}

export interface DestinationCountry extends DestinationPlace {
  cities: DestinationPlace[];
}

export interface DestinationContinent {
  key: string;
  fr: string;
  en: string;
  countries: DestinationCountry[];
}

/**
 * The United States are browsed by state rather than by country: "les
 * États-Unis" as a single destination says nothing about whether the trip is
 * Florida or California. The states listed are the ones travelers actually
 * fly to, each with its big cities.
 */
export const US_COUNTRY_NAME = "États-Unis";

export const DESTINATION_CATALOGUE: DestinationContinent[] = [
  {
    key: "europe",
    fr: "Europe",
    en: "Europe",
    countries: [
      { name: "France", cities: [{ name: "Paris" }, { name: "Nice" }, { name: "Marseille" }, { name: "Lyon" }, { name: "Bordeaux" }, { name: "Biarritz" }, { name: "Corse", en: "Corsica" }, { name: "Provence" }, { name: "Bretagne", en: "Brittany" }] },
      { name: "Espagne", en: "Spain", cities: [{ name: "Barcelone", en: "Barcelona" }, { name: "Madrid" }, { name: "Séville", en: "Seville" }, { name: "Valence", en: "Valencia" }, { name: "Malaga" }, { name: "Bilbao" }, { name: "Majorque", en: "Mallorca" }, { name: "Ibiza" }, { name: "Canaries", en: "Canary Islands" }] },
      { name: "Portugal", cities: [{ name: "Lisbonne", en: "Lisbon" }, { name: "Porto" }, { name: "Algarve" }, { name: "Madère", en: "Madeira" }, { name: "Açores", en: "Azores" }] },
      { name: "Italie", en: "Italy", cities: [{ name: "Rome" }, { name: "Venise", en: "Venice" }, { name: "Florence" }, { name: "Milan" }, { name: "Naples" }, { name: "Sicile", en: "Sicily" }, { name: "Sardaigne", en: "Sardinia" }, { name: "Pouilles", en: "Puglia" }] },
      { name: "Grèce", en: "Greece", cities: [{ name: "Athènes", en: "Athens" }, { name: "Crète", en: "Crete" }, { name: "Santorin", en: "Santorini" }, { name: "Mykonos" }, { name: "Rhodes" }, { name: "Corfou", en: "Corfu" }] },
      { name: "Royaume-Uni", en: "United Kingdom", cities: [{ name: "Londres", en: "London" }, { name: "Édimbourg", en: "Edinburgh" }] },
      { name: "Irlande", en: "Ireland", cities: [{ name: "Dublin" }] },
      { name: "Pays-Bas", en: "Netherlands", cities: [{ name: "Amsterdam" }] },
      { name: "Belgique", en: "Belgium", cities: [{ name: "Bruxelles", en: "Brussels" }, { name: "Bruges" }] },
      { name: "Allemagne", en: "Germany", cities: [{ name: "Berlin" }, { name: "Munich" }, { name: "Hambourg", en: "Hamburg" }, { name: "Francfort", en: "Frankfurt" }] },
      { name: "Autriche", en: "Austria", cities: [{ name: "Vienne", en: "Vienna" }] },
      { name: "Suisse", en: "Switzerland", cities: [{ name: "Zurich" }, { name: "Genève", en: "Geneva" }, { name: "Interlaken" }] },
      { name: "République tchèque", en: "Czech Republic", cities: [{ name: "Prague" }] },
      { name: "Hongrie", en: "Hungary", cities: [{ name: "Budapest" }] },
      { name: "Pologne", en: "Poland", cities: [{ name: "Cracovie", en: "Krakow" }, { name: "Varsovie", en: "Warsaw" }] },
      { name: "Croatie", en: "Croatia", cities: [{ name: "Dubrovnik" }, { name: "Split" }, { name: "Zagreb" }] },
      { name: "Danemark", en: "Denmark", cities: [{ name: "Copenhague", en: "Copenhagen" }] },
      { name: "Suède", en: "Sweden", cities: [{ name: "Stockholm" }] },
      { name: "Norvège", en: "Norway", cities: [{ name: "Oslo" }] },
      { name: "Finlande", en: "Finland", cities: [{ name: "Helsinki" }, { name: "Laponie", en: "Lapland" }] },
      { name: "Islande", en: "Iceland", cities: [{ name: "Reykjavik" }] },
      { name: "Malte", en: "Malta", cities: [{ name: "Malte", en: "Malta" }] },
      { name: "Chypre", en: "Cyprus", cities: [{ name: "Chypre", en: "Cyprus" }] },
      { name: "Turquie", en: "Turkey", cities: [{ name: "Istanbul" }, { name: "Cappadoce", en: "Cappadocia" }, { name: "Antalya" }, { name: "Bodrum" }, { name: "Izmir" }] }
    ]
  },
  {
    key: "north-america",
    fr: "Amérique du Nord",
    en: "North America",
    countries: [
      {
        name: US_COUNTRY_NAME,
        en: "United States",
        // Browsed by state — the second level below is a state, not a city.
        cities: []
      },
      { name: "Canada", cities: [{ name: "Montréal", en: "Montreal" }, { name: "Québec", en: "Quebec City" }, { name: "Toronto" }, { name: "Vancouver" }, { name: "Calgary" }, { name: "Ottawa" }] },
      { name: "Mexique", en: "Mexico", cities: [{ name: "Mexico" }, { name: "Cancún", en: "Cancun" }, { name: "Riviera Maya" }, { name: "Oaxaca" }, { name: "Guadalajara" }] }
    ]
  },
  {
    key: "caribbean",
    fr: "Caraïbes & Amérique centrale",
    en: "Caribbean & Central America",
    countries: [
      { name: "Guadeloupe", cities: [{ name: "Guadeloupe" }] },
      { name: "Martinique", cities: [{ name: "Martinique" }] },
      { name: "Cuba", cities: [{ name: "La Havane", en: "Havana" }] },
      { name: "République dominicaine", en: "Dominican Republic", cities: [{ name: "Punta Cana" }, { name: "Saint-Domingue", en: "Santo Domingo" }] },
      { name: "Saint-Martin", en: "Saint Martin", cities: [{ name: "Saint-Martin", en: "Saint Martin" }] },
      { name: "Costa Rica", cities: [{ name: "San José" }] },
      { name: "Panama", cities: [{ name: "Panama" }] }
    ]
  },
  {
    key: "south-america",
    fr: "Amérique du Sud",
    en: "South America",
    countries: [
      { name: "Pérou", en: "Peru", cities: [{ name: "Lima" }, { name: "Cusco" }] },
      { name: "Brésil", en: "Brazil", cities: [{ name: "Rio de Janeiro" }, { name: "São Paulo" }] },
      { name: "Argentine", en: "Argentina", cities: [{ name: "Buenos Aires" }] },
      { name: "Chili", en: "Chile", cities: [{ name: "Santiago" }] },
      { name: "Colombie", en: "Colombia", cities: [{ name: "Bogota" }, { name: "Carthagène", en: "Cartagena" }] },
      { name: "Bolivie", en: "Bolivia", cities: [{ name: "La Paz" }] }
    ]
  },
  {
    key: "africa",
    fr: "Afrique & océan Indien",
    en: "Africa & Indian Ocean",
    countries: [
      { name: "Maroc", en: "Morocco", cities: [{ name: "Marrakech" }, { name: "Essaouira" }, { name: "Fès", en: "Fez" }, { name: "Agadir" }, { name: "Tanger", en: "Tangier" }, { name: "Casablanca" }] },
      { name: "Tunisie", en: "Tunisia", cities: [{ name: "Tunis" }, { name: "Djerba" }] },
      { name: "Égypte", en: "Egypt", cities: [{ name: "Le Caire", en: "Cairo" }, { name: "Louxor", en: "Luxor" }, { name: "Hurghada" }] },
      { name: "Sénégal", en: "Senegal", cities: [{ name: "Dakar" }] },
      { name: "Cap-Vert", en: "Cape Verde", cities: [{ name: "Cap-Vert", en: "Cape Verde" }] },
      { name: "Kenya", cities: [{ name: "Nairobi" }] },
      { name: "Tanzanie", en: "Tanzania", cities: [{ name: "Zanzibar" }] },
      { name: "Afrique du Sud", en: "South Africa", cities: [{ name: "Le Cap", en: "Cape Town" }, { name: "Johannesburg" }] },
      { name: "Île Maurice", en: "Mauritius", cities: [{ name: "Île Maurice", en: "Mauritius" }] },
      { name: "La Réunion", en: "Réunion", cities: [{ name: "La Réunion", en: "Réunion" }] },
      { name: "Seychelles", cities: [{ name: "Seychelles" }] },
      { name: "Madagascar", cities: [{ name: "Antananarivo" }, { name: "Nosy Be" }] }
    ]
  },
  {
    key: "middle-east",
    fr: "Moyen-Orient",
    en: "Middle East",
    countries: [
      { name: "Émirats arabes unis", en: "United Arab Emirates", cities: [{ name: "Dubaï", en: "Dubai" }, { name: "Abou Dabi", en: "Abu Dhabi" }] },
      { name: "Jordanie", en: "Jordan", cities: [{ name: "Amman" }, { name: "Petra" }] },
      { name: "Oman", cities: [{ name: "Mascate", en: "Muscat" }] },
      { name: "Qatar", cities: [{ name: "Doha" }] },
      { name: "Israël", en: "Israel", cities: [{ name: "Tel Aviv" }] }
    ]
  },
  {
    key: "asia",
    fr: "Asie",
    en: "Asia",
    countries: [
      { name: "Japon", en: "Japan", cities: [{ name: "Tokyo" }, { name: "Kyoto" }, { name: "Osaka" }] },
      { name: "Thaïlande", en: "Thailand", cities: [{ name: "Bangkok" }, { name: "Phuket" }, { name: "Chiang Mai" }, { name: "Koh Samui" }] },
      { name: "Vietnam", cities: [{ name: "Hanoï", en: "Hanoi" }, { name: "Hô Chi Minh-Ville", en: "Ho Chi Minh City" }, { name: "Da Nang" }] },
      { name: "Cambodge", en: "Cambodia", cities: [{ name: "Siem Reap" }, { name: "Phnom Penh" }] },
      { name: "Laos", cities: [{ name: "Luang Prabang" }, { name: "Vientiane" }] },
      { name: "Indonésie", en: "Indonesia", cities: [{ name: "Bali" }, { name: "Jakarta" }] },
      { name: "Malaisie", en: "Malaysia", cities: [{ name: "Kuala Lumpur" }] },
      { name: "Singapour", en: "Singapore", cities: [{ name: "Singapour", en: "Singapore" }] },
      { name: "Philippines", cities: [{ name: "Manille", en: "Manila" }, { name: "Cebu" }] },
      { name: "Inde", en: "India", cities: [{ name: "Delhi" }, { name: "Mumbai" }, { name: "Jaipur" }, { name: "Goa" }, { name: "Kerala" }] },
      { name: "Sri Lanka", cities: [{ name: "Colombo" }] },
      { name: "Maldives", cities: [{ name: "Maldives" }] },
      { name: "Népal", en: "Nepal", cities: [{ name: "Katmandou", en: "Kathmandu" }] },
      { name: "Ouzbékistan", en: "Uzbekistan", cities: [{ name: "Tachkent", en: "Tashkent" }, { name: "Samarcande", en: "Samarkand" }] },
      { name: "Corée du Sud", en: "South Korea", cities: [{ name: "Séoul", en: "Seoul" }] },
      { name: "Chine", en: "China", cities: [{ name: "Pékin", en: "Beijing" }, { name: "Shanghai" }, { name: "Hong Kong" }] },
      { name: "Taïwan", en: "Taiwan", cities: [{ name: "Taipei" }] }
    ]
  },
  {
    key: "oceania",
    fr: "Océanie",
    en: "Oceania",
    countries: [
      { name: "Australie", en: "Australia", cities: [{ name: "Sydney" }, { name: "Melbourne" }] },
      { name: "Nouvelle-Zélande", en: "New Zealand", cities: [{ name: "Auckland" }, { name: "Christchurch" }] },
      { name: "Polynésie française", en: "French Polynesia", cities: [{ name: "Tahiti" }] },
      { name: "Nouvelle-Calédonie", en: "New Caledonia", cities: [{ name: "Nouméa", en: "Noumea" }] },
      { name: "Fidji", en: "Fiji", cities: [{ name: "Fidji", en: "Fiji" }] }
    ]
  }
];

/** The states of the United States, each with the cities travelers fly to. */
export const US_STATES: DestinationCountry[] = [
  { name: "New York", cities: [{ name: "New York" }] },
  { name: "Californie", en: "California", cities: [{ name: "Los Angeles" }, { name: "San Francisco" }, { name: "San Diego" }] },
  { name: "Floride", en: "Florida", cities: [{ name: "Miami" }, { name: "Orlando" }, { name: "Key West" }, { name: "Tampa" }, { name: "Fort Lauderdale" }] },
  { name: "Nevada", cities: [{ name: "Las Vegas" }] },
  { name: "Illinois", cities: [{ name: "Chicago" }] },
  { name: "Massachusetts", cities: [{ name: "Boston" }] },
  { name: "Washington DC", en: "Washington DC", cities: [{ name: "Washington DC" }] },
  { name: "Louisiane", en: "Louisiana", cities: [{ name: "La Nouvelle-Orléans", en: "New Orleans" }] },
  { name: "Texas", cities: [{ name: "Houston" }, { name: "Dallas" }, { name: "Austin" }, { name: "San Antonio" }] },
  { name: "Arizona", cities: [{ name: "Phoenix" }] },
  { name: "Colorado", cities: [{ name: "Denver" }] },
  { name: "Utah", cities: [{ name: "Salt Lake City" }] },
  { name: "Washington", cities: [{ name: "Seattle" }] },
  { name: "Oregon", cities: [{ name: "Portland" }] },
  { name: "Géorgie", en: "Georgia", cities: [{ name: "Atlanta" }, { name: "Savannah" }] },
  { name: "Pennsylvanie", en: "Pennsylvania", cities: [{ name: "Philadelphie", en: "Philadelphia" }] },
  { name: "Tennessee", cities: [{ name: "Nashville" }, { name: "Memphis" }] },
  { name: "Caroline du Sud", en: "South Carolina", cities: [{ name: "Charleston" }] },
  { name: "Michigan", cities: [{ name: "Detroit" }] },
  { name: "Minnesota", cities: [{ name: "Minneapolis" }] },
  { name: "Hawaï", en: "Hawaii", cities: [{ name: "Honolulu" }, { name: "Maui" }] },
  { name: "Alaska", cities: [{ name: "Anchorage" }] }
];

/** The label of a place in the traveler's language. */
export function placeLabel(place: DestinationPlace, locale: "fr" | "en"): string {
  return locale === "en" ? place.en ?? place.name : place.name;
}
