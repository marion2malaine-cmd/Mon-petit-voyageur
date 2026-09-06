# Mon Petit Voyageur V1

Monorepo TypeScript avec:
- `apps/web`: interface React/Vite bilingue FR/EN
- `apps/api`: API Fastify (auth + orchestrateur skills + outils live)
- `packages/contracts`: schémas Zod et types partagés
- `.agents/skills`: 8 skills de planification voyage validées

## Fonctionnalités livrées

- **Programme jour par jour** où chaque journée est différente:
  - 3 à 5 **visites culturelles gratuites** par jour, jamais répétées sur le séjour
  - **3 options d'activité payante** par jour (Option A / B / C), de **3 catégories différentes**
    (culture, sport, découverte, farniente, gastronomie) mélangées selon les styles cochés dans le
    questionnaire et alternées d'un jour à l'autre, jamais la même activité deux fois ; jugées
    contre l'enveloppe activités du budget saisi (badge dans / hors budget) ; quand une offre
    GetYourGuide réelle correspond (1 recherche par destination), son **lien direct et son tarif
    « dès X € »** remplacent l'estimation, sinon le tarif est marqué indicatif ; Viator en secours
  - pour chaque activité, la **voie la moins chère**: agence locale, kiosque du port ou site
    officiel, avec l'économie typique et ce que rapportent les forums voyageurs
    (TripAdvisor, Routard, Reddit). Les liens sont ordonnés du moins cher au plus cher
  - **3 restaurants présélectionnés** par jour, **réels et bien notés, avec leur photo Google Maps**,
    les tables avec vue favorisées : cherchés sur Google Maps
    (via SerpApi) pour la zone de la journée, retenus à partir de 4,2 ★ et 50 avis, dans la gamme de
    prix du budget, jamais deux fois la même table ; note, nombre d'avis, adresse, site et itinéraire
    affichés. Une table que la recherche n'a pas confirmée est marquée « non vérifiée »
  - **bons plans repérés sur les forums** : les vrais fils TripAdvisor / Routard / Reddit sur la destination
    sont recherchés, injectés dans le prompt (les `forum_tip` s'y appuient) et listés dans le guide
  - déroulé horaire, conseils pratiques et plan B météo
- **Location de voiture** calée sur le budget: la catégorie la moins chère qui reste adaptée
  au groupe, avec l'estimation pour le séjour et des alertes explicites:
  - comptoir **dans le terminal** ou **navette obligatoire** hors aéroport
  - obligation de payer avec une **vraie carte de crédit** au nom du conducteur, sans quoi
    le loueur refuse la caution et impose son assurance
  - caution bloquée, politique carburant plein/plein, état des lieux photographié
- **Guide illustré téléchargeable** (HTML autonome, imprimable en PDF) reprenant la mise en
  page d'un guide papier, aux couleurs du site. Photos réelles et créditées via Wikipédia,
  Wikimedia Commons et Openverse — aucune clé requise
- **Travelpayouts Drive** chargé dans `apps/web/index.html` : convertit automatiquement les liens de réservation (Booking, Airbnb, Skyscanner…) en liens affiliés ; Viator garde son affiliation directe
- **Carte** : visites gratuites, sites payants (billets) et restaurants sans coordonnées sont géocodés via Nominatim, dans la limite de `GEOCODE_MAX_PER_PLAN` requêtes par plan (20), cache disque `data/geocode-cache.json`
- Authentification email + mot de passe, session JWT cookie httpOnly
- Orchestrateur central qui enchaîne les 8 skills
- Vols et hébergements: les outils live sont la source de vérité (prix, liens directs Google Flights / Google Hotels, statut), l'IA n'ajoute que conseils de transport et arbitrages — elle n'invente jamais un prix
- Chargement runtime des skills depuis `.agents/skills`
- Validation des sorties skills via Zod avec retry fallback
- Cerveau IA au choix: **DeepSeek** (`deepseek-v4-flash`, ≈ 1 centime par voyage ; un lot de jours mal formé est redemandé une fois) ou OpenAI, avec fallback local si aucune clé
- Outils live branchés:
  - `search_flights`, `search_hotels` (Google Flights / Google Hotels via SerpApi, prix live) — recherche lancée uniquement avec des dates exactes et un aéroport connu, réponses en cache 24 h sur disque, plafond mensuel local `SERPAPI_MONTHLY_CAP` (200 par défaut, plan gratuit 250)
  - `get_entry_requirements` (Sherpa)
  - `get_local_transport_info` (Google Maps Transit)
  - `get_weather` (Open-Meteo)
  - `get_exchange_rate` (Frankfurter)
- Liens de réservation générés automatiquement (pré-remplis avec destination, dates, voyageurs):
  - Vols: Skyscanner, Google Flights, Aviasales (marker d'affiliation `TRAVELPAYOUTS_MARKER`)
  - Hébergements: Booking.com, Airbnb
  - Excursions: GetYourGuide, Civitatis, **Viator avec lien d'affiliation** (`VIATOR_AFFILIATE_PID` / `VIATOR_AFFILIATE_MCID`, posé sur chaque lien Viator : activités, billets, page destination)
  - Restaurants: TripAdvisor, TheFork
  - Forums voyageurs: TripAdvisor, Routard
- **Billets d'abord, puis l'IA organise dans ce qui reste** : dates exactes → 1 recherche ; mois seul → **calendrier des prix du mois** (Travelpayouts / Aviasales, gratuit, `TRAVELPAYOUTS_TOKEN`) puis 1 seule recherche live sur le jour le moins cher ; aucune date → mois le moins cher sur les 6 prochains ; sans calendrier, repli sur `SERPAPI_FLEX_DATE_SAMPLES` départs échantillonnés (3). Le mois s'affiche jour par jour dans l'app, jour retenu en vert. Le budget restant (budget − vols − hébergement) est transmis à l'itinéraire : gammes de prix des restaurants, enveloppe activités, avertissement si les billets absorbent l'essentiel
- Budget défini en amont appliqué aux résultats (badges "dans le budget" / "au-dessus du budget")
- Dates estimées automatiquement depuis le mois mentionné ("en septembre" → dates concrètes)
- Persistance SQLite:
  - `users`
  - `trips`
  - `trip_runs`
- Endpoint `/api/trips/plan` qui retourne résumé + JSON structuré + trace
- Endpoint `/api/trips/:id/guide` qui retourne le guide illustré
  (`?format=html` pour l'afficher, `?embed=0` pour des photos distantes plutôt qu'intégrées)
- Endpoint `POST /api/trips/:id/guide/email` qui envoie le guide en pièce jointe
  (destinataire par défaut: le compte connecté). Renvoie `503 email_not_configured`
  tant que le SMTP n'est pas renseigné, plutôt que d'échouer en silence.

### Activer l'envoi par mail

Renseignez dans `.env` un SMTP au choix (Gmail, Brevo, Mailgun, OVH...):

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre.adresse@gmail.com
SMTP_PASS=mot-de-passe-application
```

> Avec Gmail, il faut la validation en 2 étapes puis un **mot de passe d'application**
> (le mot de passe du compte est refusé).

## Le guide

### Générer un guide sans lancer l'application

```bash
npm run guide:preview -w @mlt/api -- "10 jours en Crète en famille en août, budget 4000 €" guide.html
```

Le fichier produit est autonome: photos intégrées, ouvrable hors ligne, imprimable en PDF
depuis le navigateur (bouton en bas à droite).

### Comment le programme est construit

Un programme illustré complet ne tient pas dans une seule réponse d'IA (troncature à
~8000 tokens). La génération se fait donc en deux temps, dans
`apps/api/src/skills/itineraryPlanner.ts`:

1. **Plan d'ensemble** — l'IA répartit sur tout le séjour les thèmes, les zones et surtout
   les **noms exacts** attribués à chaque jour (visites gratuites, activités, restaurants).
   C'est ce qui garantit qu'aucun nom n'apparaît deux fois.
2. **Détail par lots** — chaque paire de jours est développée en parallèle à partir des noms
   déjà attribués.

Le prompt qui pilote tout cela est `.agents/skills/itinerary-builder/SKILL.md`, complété par
`references/itinerary_rules.md` (rythme, autocontrôle) et `references/free_culture_playbook.md`
(où trouver des visites gratuites dans n'importe quelle destination). Les fichiers
`references/*.md` sont automatiquement injectés dans le prompt au chargement de la skill.

> L'IA n'écrit jamais d'URL ni d'adresse d'image: elle produit des titres et des requêtes
> photo, et l'application reconstruit les liens (GetYourGuide, Viator, TheFork, Google Maps)
> et résout les photos. C'est ce qui évite les liens morts et les images inventées.

## Installation

```bash
npm install
```

## Configuration

1. Copier `.env.example` vers `.env`
2. Remplir les clés API nécessaires:
   - `DEEPSEEK_API_KEY` (recommandé, https://platform.deepseek.com) ou `OPENAI_API_KEY` — l'IA qui pilote les skills
   - `SERPAPI_API_KEY` (https://serpapi.com, 250 recherches/mois gratuites) — prix live vols + hôtels via Google Flights / Google Hotels
   - `SHERPA_API_KEY`, `GOOGLE_MAPS_API_KEY` (optionnels)

> Note: Skyscanner et Booking.com n'offrent pas d'API publique gratuite, et le portail
> Self-Service d'Amadeus a fermé en juillet 2026. Les prix live viennent de Google Flights
> et Google Hotels (via SerpApi, un plan de voyage ≈ 7 recherches : vols, hôtels, forums, puis une par zone pour les restaurants ; réponses en cache 24 h à 7 jours sur disque), et l'application génère des liens directs pré-remplis vers
> Skyscanner / Booking / GetYourGuide / TheFork pour réserver au tarif affiché.

## Lancement local

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:8787`

## Vérifications

```bash
npm run typecheck
npm run test
npm run build
```

## Skills

Les 8 skills sont dans `.agents/skills/*` avec:
- `SKILL.md`
- `agents/openai.yaml`

Validation exécutée avec le script skill-creator:
```bash
python3 /Users/MarionDEMALAINE/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/<skill>
```
