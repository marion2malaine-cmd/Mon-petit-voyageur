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
