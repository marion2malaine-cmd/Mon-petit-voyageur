# SEO / GEO de www.monpetitvoyageur.com

Ce dossier est la **source de vérité du système SEO** du site : les pages éditoriales statiques, leur génération, la mémoire de la routine et son journal. La routine planifiée (`~/.claude/scheduled-tasks/routine-mon-petit-voyageurb/SKILL.md`, tous les jours à 9 h) lit ce dossier avant d'agir et y enregistre ce qu'elle fait.

## Positionnement

**Mon Petit Voyageur = planification de voyages et de road trips assistée par IA, budget d'abord, tout réservable via des liens.** Aucune fonctionnalité, prix, chiffre ou partenaire ne doit être affirmé s'il n'existe pas dans le produit (`README.md`, `apps/web/src/App.tsx`, `apps/api`). Pas de keyword stuffing.

## Fichiers

| Fichier | Rôle |
|---|---|
| `site.mjs` | Config (URL, organisation MARA LABS, schéma SoftwareApplication), CSS et layout HTML des pages |
| `pages/<slug>.mjs` | Une page = un module : slug, intention, cluster, title, description, H1, corps HTML, FAQ, pages liées |
| `build.mjs` | `node seo/build.mjs` écrit `dist/<slug>.html`, `dist/404.html`, `dist/sitemap.xml`, `dist/llms.txt` après `vite build` ; `--sync` met à jour `state.json` |
| `state.json` | **Mémoire** : inventaire des URLs (type, cluster, intention, mots-clés, dates, title, H1, liens, indexabilité, changements, problèmes ouverts, opportunités), registre `intents`, `backlog` scoré, `history` des actions, `kpi` |
| `journal.md` | Une entrée lisible par run : avant / fait / non fait / prochain run |
| `../public/robots.txt` | Statique (copié dans dist) |
| `../index.html` | Home : head SEO + coquille HTML pré-rendue dans `#root` (React la remplace) |
| `../server.mjs` | Serveur de production (Dockerfile.web) : vrais 404, 301 `.html`/slash, cache, gzip, noindex hors hôte canonique |
| `../src/test/seo.test.ts` | Garde-fous (1 H1, title/description, canonical, JSON-LD = visible, liens internes, sitemap, state synchronisé, intentions uniques) |

## Ajouter ou modifier une page

1. Vérifier dans `state.json → intents` que l'intention n'est **pas déjà couverte** (sinon enrichir la page existante).
2. Créer `pages/<slug>.mjs` sur le modèle des pages existantes (contenu réel, FAQ visible = JSON-LD, ≥ 1 lien contextuel dans le corps, `related` vers 2-3 pages).
3. Ajouter le lien dans `SEO_GUIDES` (`src/App.tsx`) **et** dans la coquille statique de `index.html` (footer « Guides »).
4. `npm run seo:sync -w @mlt/web` puis compléter à la main dans `state.json` : `history` (date, url, action, justification), `openIssues`, `nextOpportunities`.
5. `npm run test -w @mlt/web` et `npm run build -w @mlt/web` verts.
6. Vérifier localement : `PORT=4180 node apps/web/server.mjs` puis `curl -sI http://localhost:4180/<slug>` (200), `/<slug>/` (301), `/inexistant` (404).

## Règles

- Une page = une intention identifiable et une utilité réelle. Zéro page programmatique.
- Une exécution de la routine peut légitimement ne créer aucune page ; maximum 1 nouvelle page par run.
- JSON-LD uniquement pour ce qui est visible ; FAQPage seulement avec une FAQ affichée.
- Comparatifs : concurrents, fonctionnalités et prix vérifiés le jour même, sources datées dans la page.
- Aucune statistique inventée, aucun faux avis, aucun faux backlink.

## Déploiement

Le front est déployé manuellement : `railway up -s frontend-web --detach` (voir la mémoire `mpv-deploiement`). Preuve après déploiement : `curl -s -A GPTBot https://www.monpetitvoyageur.com/sitemap.xml` renvoie du XML et `curl -sI https://www.monpetitvoyageur.com/inexistant` renvoie 404.
