# Mode opératoire exécutable de la routine SEO/GEO — www.monpetitvoyageur.com

Ce fichier est l'**annexe opératoire** de la routine planifiée `~/.claude/scheduled-tasks/routine-mon-petit-voyageurb/SKILL.md` (quotidienne, 9 h). La mission stratégique complète est dans ce SKILL.md ; ici se trouvent les commandes, fichiers et garde-fous concrets que chaque exécution doit suivre. Réponds en français, décide seul, note tes choix.

## 0. Garde-fou anti-doublon (à faire en premier)

Deux exécutions simultanées se sont télescopées le 2026-09-08. Avant toute chose :

```bash
cd /Users/MarionDEMALAINE/my-little-traveler && LOCK=apps/web/seo/.run.lock; if [ -f "$LOCK" ] && [ $(( $(date +%s) - $(stat -f %m "$LOCK") )) -lt 7200 ]; then echo "VERROU ACTIF: $(cat $LOCK)"; else date "+%Y-%m-%dT%H:%M:%S" > "$LOCK"; echo "verrou posé"; fi
```

Si « VERROU ACTIF » s'affiche (autre exécution depuis moins de 2 h) : arrête-toi en répondant seulement « Routine MPV : exécution déjà en cours, pas d'action ». Sinon continue et **supprime `apps/web/seo/.run.lock` à la toute fin**. Ne commit jamais ce fichier.

Un verrou vieux de plus de 2 h est périmé : la commande l'écrase d'elle-même. Dans ce cas, **vérifie que le run précédent a bien laissé une entrée dans `journal.md`** ; s'il n'y en a pas, il s'est interrompu — signale-le en tête de rapport et reprends son « prochain run ». (Arrivé le 2026-09-10 : verrou posé à 09:23, aucune entrée de journal.)

## 1. Recharger la mémoire (avant toute décision)

- `apps/web/seo/README.md` — architecture du système (pages statiques `seo/pages/*.mjs`, `seo/build.mjs`, `server.mjs`, `index.html` pré-rendu, tests).
- `apps/web/seo/state.json` — inventaire de chaque URL (type, cluster, intention, mots-clés, dates, title, H1, liens, indexabilité, changements, problèmes ouverts, opportunités), registre `intents`, `backlog` scoré, `comparatifs`, `kpi`, `history`.
- `apps/web/seo/journal.md` — au moins les 3 dernières entrées.
- Mémoire projet `~/.claude/projects/-Users-MarionDEMALAINE-my-little-traveler/memory/` : `mpv-seo-routine.md`, `mpv-deploiement.md`, `pas-de-guide-generique.md`.

Vérité produit (ne jamais inventer une fonctionnalité) : `README.md`, `apps/web/src/App.tsx`, `apps/web/src/homeContent.ts`, `apps/api`.

**Deux vérités produit à revérifier à chaque run, parce qu'elles rendraient le SEO mensonger en changeant :**

- **Abonnement.** `apps/api/src/billing.ts` → `hasActiveAccess()` laisse l'application ouverte tant que `STRIPE_SECRET_KEY` est absente ; le paywall (`PricingPlans`, `src/App.tsx`) ne s'affiche que si l'API renvoie `billing_enabled`. Tant que Stripe n'est pas configuré en production, « Inscription gratuite » et l'`Offer` `price: "0"` de l'accueil sont **vrais**. Dès que Stripe est branché, ils deviennent **faux** : mettre à jour l'`Offer` JSON-LD, les descriptions et `llms.txt` avec les tarifs réels lus dans `src/appTranslations.ts` (`planMonthlyPrice`, `planAnnualPrice`, `planSub`). Backlog : `stripe-seo-offer`.
- **Surfaces privées.** `server.mjs → SPA_PREFIXES` (`/admin`, `/mobile`) sert la coquille de l'accueil telle quelle. Toute nouvelle route de ce type doit être ajoutée à `public/robots.txt` **dans chaque groupe d'agents** : un groupe `robots.txt` n'hérite jamais des règles de `User-agent: *`, donc déclarer `User-agent: GPTBot` sans `Disallow` lui rouvre tout ce que `*` ferme (corrigé le 2026-09-11). Le test `seo.test.ts` le vérifie groupe par groupe, plus l'en-tête `X-Robots-Tag: noindex, nofollow`.

## 2. Mesurer (lecture seule, ≤ 10 requêtes, 1 s entre requêtes)

- Prod : `curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" -A GPTBot https://www.monpetitvoyageur.com/<url>` pour `/`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, chaque page de `state.json` et une URL inexistante (attendu 404). **Si `/sitemap.xml` renvoie du HTML, la version SEO n'est pas déployée** : le signaler en tête de rapport, ne rien créer de nouveau, limiter le run aux corrections dans le repo et redonner la commande de déploiement.
- HTML sans JS : `curl -s -A GPTBot <url> | grep -c "<h1"` = 1, title et description présents.
- Search Console `sc-domain:monpetitvoyageur.com` (Chrome MCP) si la propriété existe : 28 j vs 28 j précédents, requêtes/pages, positions 4-10 et 8-20, CTR faible à fortes impressions ; consigner dans `state.json → kpi` et une ligne de baromètre dans `journal.md`. Sinon noter « Search Console indisponible ».
- **Piège de l'inspection d'URL** : en enchaînant les inspections dans la barre du haut sans rechargement complet, le panneau garde la « canonique déclarée » de l'URL précédente. Avant de signaler une anomalie de canonique, recharger la page d'inspection à froid **et** contre-vérifier par `curl -s -A Googlebot <url> | grep canonical` (desktop et smartphone) plus le contenu de `dist/`.
- **Avant de recompresser une image**, lire son format réel (`webpmux -info`, `magick identify`) : `/logo-hero.webp` est une animation de 36 images, qu'un `cwebp` détruirait. Une réduction qui dégrade le rendu voulu par Marion est une décision à lui remonter avec des tailles mesurées, pas à appliquer seul.
- **Règle CTR** (dès que Search Console existe) : requêtes 28 j avec ≥ 50 impressions, CTR < 2 % et position ≤ 15 → la page ciblée reçoit un title (≤ 80 caractères avant « | Mon Petit Voyageur ») et une description (≤ 190 caractères) qui répondent mot pour mot à la requête, avec un bénéfice concret et « Inscription gratuite » si la page est commerciale. Une page par run, requête et date consignées dans `state.json → kpi`, relecture 28 j après.
- **Poids réel de la landing** (ne pas se fier aux tailles de chunks) : `dist/index.html` ne précharge que `assets/index-*.js` ; `mapbox-gl` (1,86 Mo) et `three` (688 Ko) sont en import dynamique et **ne sont pas chargés sur l'accueil** — mesuré au navigateur le 2026-09-11 : 4 requêtes, ~650 Ko transférés, dont 99 Ko de JavaScript gzippé. Avant de rouvrir un chantier « bundle lourd », relire le réseau réel.
- Repo : `npm run test -w @mlt/web` vert avant de toucher quoi que ce soit.

## 3. Décider

- Consulter `state.json → intents` avant toute idée de page : intention couverte = enrichir la page existante, jamais une nouvelle URL. Une combinaison destination + durée ne justifie pas une URL.
- Scorer chaque opportunité dans `backlog` (impact organique, valeur commerciale, potentiel GEO, demande, position connue, difficulté, temps, risque, cannibalisation, contribution au cluster) ; traiter le meilleur score réalisable dans le run.
- Maximum **1 nouvelle page par run**, avec intention documentée, utilité réelle, contenu spécifique et vérifié. Comparatifs : concurrents, fonctionnalités et prix vérifiés le jour même, source et date dans la page. Aucune statistique, avis, chiffre, partenaire ou fonctionnalité inventé.

## 4. Agir (voir `README.md` § « Ajouter ou modifier une page »)

- Page = module `seo/pages/<slug>.mjs` : title spécifique, description 80-200 caractères, un H1, corps HTML avec ≥ 1 lien contextuel, FAQ visible = FAQPage, `related` 2-3 pages, `dateModified` à jour.
- Lien depuis la home : `SEO_GUIDES` dans `src/App.tsx` **et** footer statique de `index.html`. Aucune orpheline, profondeur ≤ 2 clics.
- Home : textes partagés `src/homeContent.ts` ↔ coquille statique `index.html` (le test garantit l'égalité) ; JSON-LD = visible uniquement.
- Technique : `public/robots.txt` ; sitemap, llms.txt et 404 générés par `seo/build.mjs` ; `server.mjs` (404 réels, 301 `.html`/slash, noindex hors hôte canonique). Ne jamais remettre `vite preview` en production.

## 5. Tester

```bash
cd /Users/MarionDEMALAINE/my-little-traveler && npm run seo:sync -w @mlt/web && npm run test -w @mlt/web && npm run build -w @mlt/web
```

Puis `PORT=4180 node apps/web/server.mjs &`, `curl -sI http://localhost:4180/<slug>` (200), `/<slug>/` (301), `/inexistant` (404), `pkill -f "node server.mjs"`. Pages modifiées vérifiées en mobile et desktop (Browser pane sur le serveur local) quand la mise en page change.

## 6. Enregistrer

- `npm run seo:sync -w @mlt/web` recalcule aussi le title, la description, le H1 et le canonical de l'accueil **en les relisant dans `index.html`** (`readHomeHead()` dans `build.mjs`) : ces champs étaient recopiés à la main dans `state.json` et avaient dérivé de deux versions. Ne plus jamais les saisir à la main.
- `state.json` : une entrée `history` par action (date, url, action ∈ {audit, optimisation, création, fusion, technique, maillage, mesure}, justification) ; `changes`, `openIssues`, `nextOpportunities`, `backlog`, `kpi` à jour.
- `journal.md` : entrée datée (avant / fait / non fait / prochain run), dernière ligne = prochaine action recommandée et preuve attendue.
- Commit local des seuls fichiers SEO, `git add` fichier par fichier (jamais `git add -A` : le dépôt contient du travail non commité de Marion), message « SEO : … », dernière ligne `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Pas de push, pas de déploiement** : c'est l'action de Marion. **N'utilise jamais `railway up`** et ne l'écris dans aucun rapport (règle de Marion du 2026-09-08 : il téléverse le dossier courant, donc le travail non commité, d'où des erreurs de build). Le déploiement passe par les Dockerfiles (`Dockerfile.web`, `Dockerfile.api`) construits par Railway depuis le dépôt Git. Preuve attendue après déploiement : `curl -s -A GPTBot https://www.monpetitvoyageur.com/sitemap.xml` renvoie du XML et `/inexistant` renvoie 404.

## 7. Critères de sortie de chaque run

100 % des URLs dans `state.json` · 1 H1 par page · title + description spécifiques · canonical cohérent · aucune page stratégique bloquée · 0 lien interne cassé et 0 nouvelle 404 (test `seo.test.ts`) · 0 page créée sans intention documentée · JSON-LD valide = visible · build et tests verts · chaque action consignée.

## 8. TYMI Baby : contrôle seulement

TYMI Baby a sa propre routine quotidienne (`tymi-seo-geo-aso-quotidien`, source de vérité `/Users/MarionDEMALAINE/lullalog/marketing/growth-2026/routine-seo-geo.md`, mémoire `seo-state.json` + `seo-inventory.json`, journal `journal.md`). Ne pas refaire son travail (deux agents sur le même dépôt se télescopent). Contrôle de vitalité en lecture seule : dernière entrée de `journal.md` (< 3 jours ?), mémoire présente, `curl -sI -A GPTBot https://www.tymibaby.com/sitemap.xml` (200 ?). Alerte en tête de rapport si la routine n'a pas tourné depuis 3 jours ou si la mémoire manque.
