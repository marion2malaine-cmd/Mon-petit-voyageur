# Journal SEO/GEO — www.monpetitvoyageur.com

Une entrée par run de la routine (`~/.claude/scheduled-tasks/routine-mon-petit-voyageurb`). Format : date | actions | preuves | reste à faire. L'état structuré est dans `state.json` (source de vérité de l'inventaire, des intentions couvertes et de l'historique).

## 2026-09-08 — Run 1 : audit initial et fondations

**Avant.** SPA React servie par `vite preview` : `<title>` générique « Mon Petit Voyageur », aucune meta description, aucun canonical, aucun Open Graph, aucune donnée structurée, pas de robots.txt ni de sitemap.xml, contenu absent du HTML sans JavaScript (1 098 octets de coquille), toutes les URLs (y compris /robots.txt, /sitemap.xml, /inexistant) répondaient 200 avec la SPA (soft 404). Racine https://monpetitvoyageur.com en erreur TLS (SSL IONOS non activé), http:// racine → 302 vers www. Aucune routine SEO ni mémoire n'existait pour ce projet (celles trouvées concernent ToutMonImmo et TYMI Baby).

**Fait.**
- `apps/web/index.html` : title, description, canonical, robots, OG/Twitter, JSON-LD (Organization, WebSite, SoftwareApplication), coquille HTML statique dans `#root` (H1, tagline, fonctionnalités, étapes, liens guides) visible par les crawlers sans JS ; React la remplace au montage.
- `apps/web/seo/` : système de pages statiques (`site.mjs` layout + `pages/*.mjs` + `build.mjs`), 4 pages créées (voir state.json → history), `sitemap.xml`, `llms.txt`, `404.html` générés au build.
- `apps/web/public/robots.txt` : tout autorisé (dont GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Google-Extended), /admin et /mobile exclus, ligne Sitemap.
- `apps/web/server.mjs` remplace `vite preview` en production (Dockerfile.web) : vrais 404, 301 `/x.html` → `/x` et `/x/` → `/x`, cache immutable des assets, gzip, `X-Robots-Tag: noindex` sur les hôtes non canoniques (*.up.railway.app).
- React : tagline enrichie (« planificateur de voyage IA »), colonne « Guides » dans le footer (liens vers les 4 pages) → aucune page orpheline.
- Tests `src/test/seo.test.ts` : 1 H1, title/description, canonical, JSON-LD valide et FAQ = visible, liens internes connus, sitemap/robots cohérents, state.json synchronisé, intentions uniques.
- Routine : mode opératoire exécutable écrit dans `apps/web/seo/ROUTINE.md` (verrou anti-doublon, rechargement de state.json + journal, boucle ANALYSER → … → PRÉPARER, max 1 page nouvelle par run, registre d'intentions, tests/build, enregistrement) et rattaché au prompt planifié `~/.claude/scheduled-tasks/routine-mon-petit-voyageurb/SKILL.md` (Marion a remplacé ce prompt par une version longue pendant le run ; l'annexe y est référencée en fin de fichier).
- Home : sections « Qu'est-ce que Mon Petit Voyageur ? » et FAQ (7 questions) ajoutées à la landing React par une seconde exécution parallèle de la routine (`src/homeContent.ts` partagé), reprises dans la coquille statique et le JSON-LD FAQPage d'`index.html`.

**Incident.** Deux exécutions de cette routine ont tourné en même temps (05:27 et 05:33) : fichiers écrasés mutuellement (index.html, seo.test.ts, robots.txt), doublon d'audit TYMI Baby. Verrou `apps/web/seo/.run.lock` ajouté au mode opératoire. Build Docker non testable (démon Docker arrêté sur le Mac) ; le serveur a été validé en local avec Node 22 (`node apps/web/server.mjs`) sur toutes les URLs.

**Non fait (volontairement).** Pas de déploiement Railway (action manuelle de Marion, voir backlog `deploy-seo-v1`) ; pas de page destination ni de comparatif (données à vérifier, pas de ferme de pages) ; Search Console non disponible.

**Prochain run.** Vérifier si le déploiement a eu lieu (`curl -sI -A GPTBot https://www.monpetitvoyageur.com/sitemap.xml` → 200 XML) ; si oui, passer aux items du backlog par score ; sinon, ne rien créer de plus et le signaler.

## 2026-09-08 — Run 1 bis (seconde exécution simultanée, fusionnée)

**Contexte.** Deux exécutions de la routine ont tourné en même temps (03:27 et 03:33 UTC) et ont écrit les mêmes fichiers. La première a livré le système complet (pages statiques, server.mjs, state.json, commit 73c4453) en intégrant les sections « Qu'est-ce que Mon Petit Voyageur ? » et FAQ écrites par la seconde. Cette entrée consigne ce que la seconde a ajouté après fusion.

**Fait.** `src/seo.ts` (head côté client : canonical/title des pages légales, noindex /admin, /mobile et chemins inconnus, lang FR/EN) branché dans `App.tsx` ; liens légaux du footer en vrais liens ; H1 dupliqué de l'en-tête connecté supprimé ; `.run.lock` ignoré par git ; `.claude/launch.json` : `web-preview` = `node apps/web/server.mjs`. Vérification locale complète (voir `state.json → history`, entrée « mesure »). Audit technique TYMI Baby en lecture seule archivé dans `~/lullalog/marketing/growth-2026/audits/2026-09-08-audit-technique-seo.md` (107/107 URL en 200, 0 P1, `/alternatives` et `/privacy` orphelines en prod, fontes TTF 1,46 Mo) — sa routine propre publie, celle-ci ne touche pas au dépôt lullalog.

**Non fait.** Pas de push ni de déploiement (action Marion). Search Console absente : aucune mesure d'impressions possible.

**Prochain run.** Poser le verrou en premier (§ 0 de ROUTINE.md). Vérifier `curl -s -A GPTBot https://www.monpetitvoyageur.com/sitemap.xml` : XML = déployé → traiter le backlog par score (search-console, apex-https, images-poids) ; HTML = signaler et ne rien créer.

## 2026-09-08 — Run 1 ter (troisième exécution simultanée : vérification indépendante)

**Contexte.** La tâche planifiée a été lancée trois fois entre 05:27 et 05:33 (deux sessions d'écriture, plus celle-ci). Pour ne pas écraser le travail des deux premières, cette exécution n'a rien écrit avant leur fin et a servi de contrôle indépendant du résultat fusionné (commits 73c4453, b07cd92, d524bc3 sur `main`, PR n° 1 ouverte, non poussés sur `origin/main`).

**Vérifié.** `npm run build -w @mlt/web` OK (7 fichiers SEO dans dist) ; 22 tests verts ; script de contrôle sur `dist/` : 6 pages HTML avec un seul H1, title et description uniques, canonical, JSON-LD valides (Organization, WebSite, SoftwareApplication, FAQPage, Article/WebPage, BreadcrumbList), 5 URL de sitemap toutes servies, liens internes tous résolus ; `server.mjs` : `/` et 4 guides 200, `/slug/`, `/slug.html`, `/index.html` 301, `/inexistant` 404, `robots.txt` text/plain, `sitemap.xml` application/xml, `llms.txt` 200, `X-Robots-Tag: noindex` sur hôte `*.up.railway.app` ; navigateur 375 px et 1 280 px : aucun débordement horizontal, 7 questions de FAQ sur l'accueil, `/admin` en `noindex, nofollow`. Seul écart relevé : `404.html` sans description ni canonical, sans conséquence (page noindex).

**Prod.** Toujours l'ancienne version : `/sitemap.xml`, `/robots.txt` et `/inexistant` renvoient le HTML de la SPA en 200. Déploiement à déclencher par Marion via les Dockerfiles (voir README « Déploiement »).

**Routine.** Marion a remplacé le prompt planifié pendant le run (version de 1 309 lignes, 05:52-05:54) : elle fait foi. L'annexe opératoire ajoutée en fin de prompt renvoie à `seo/ROUTINE.md`. À corriger côté planification : la tâche `routine-tymi-baby` (09:08) doublonne `tymi-seo-geo-aso-quotidien` (09:01) sur le même dépôt lullalog ; ne garder qu'une des deux.

**Prochain run.** Poser le verrou ; vérifier le déploiement (`curl -s -A GPTBot https://www.monpetitvoyageur.com/sitemap.xml` → XML) ; si déployé, créer la propriété Search Console et passer au backlog par score ; sinon signaler et ne rien créer.
