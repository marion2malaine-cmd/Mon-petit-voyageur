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

## 2026-09-08 — Mise en production, vérifiée

**Cause racine trouvée.** Les déploiements déclenchés par GitHub échouaient depuis le 2026-09-07 : `apps/api/src/server.ts` était commité en important `./admin`, `./tripEdits` et `journeyLegs` de `./guide/renderGuide`, trois éléments jamais ajoutés au dépôt (déploiement Railway `18b1e9d2`, commit `5cf0d230`, FAILED sur `Could not resolve "./admin"`). Seuls les `railway up` réussissaient, puisqu'ils téléversent les fichiers non commités : la production tournait sur du code absent du dépôt. Le rattachement GitHub, lui, était déjà en place sur les deux services — la note de mémoire qui le disait absent datait du 2026-09-06 et était périmée.

**Livré.** PR 2 (`fix-build-api-fichiers-manquants`, 3 fichiers, 94 tests API verts) fusionnée en premier, puis PR 1 (SEO). Railway a reconstruit `backend-api` (`fcf48ad9`, commit `b261dbe7`, SUCCESS) puis `frontend-web` (`78b35ac3`, commit `bab98af`, SUCCESS), chacun depuis son Dockerfile. Aucun `railway up`.

**Preuves en production** (UA GPTBot) : `/` 200, 16 683 octets lisibles sans JavaScript, 1 H1, FAQPage de 7 questions toutes présentes dans le HTML visible ; `/robots.txt` 200 `text/plain` ; `/sitemap.xml` 200 `application/xml`, 5 URL ; `/llms.txt` 200 ; les 4 guides 200, canonical propre, JSON-LD Article + BreadcrumbList + FAQPage ; `/slug/`, `/slug.html` et `/index.html` en 301 ; `/inexistant-test-404` en **404** — le soft 404 généralisé est corrigé ; `X-Robots-Tag: noindex` sur l'hôte Railway ; `api/health` `{"ok":true}`.

**Prochain run.** Le site est déployé et indexable. Priorité : créer la propriété Search Console `sc-domain:monpetitvoyageur.com` et soumettre le sitemap (action Marion), puis activer le SSL IONOS de la racine et recompresser `logo-hero.webp` (1,95 Mo, image LCP).

## 2026-09-08 — Passe CTR : titles, descriptions, données structurées

**Avant.** Titles descriptifs mais longs (jusqu'à 100 caractères, tronqués dans Google avant l'argument), descriptions factuelles sans promesse ni appel à l'action, JSON-LD sans Offer ni HowTo. Search Console absente : impossible de cibler les requêtes à fortes impressions / faible CTR.

**Fait.** Les 5 URLs (accueil + 4 guides) : title ≤ 80 caractères avant la marque, formulé comme la réponse à l'intention avec un bénéfice concret (« vols et hôtels au prix réel », « hôtel chaque nuit », « en 5 étapes », « sans se faire piéger ») ; description ≤ 190 caractères, question ou promesse puis « Inscription gratuite » sur les pages commerciales. JSON-LD : Offer gratuite sur SoftwareApplication (accueil + guides), HowTo sur `/budget-voyage` (5 étapes) et `/organiser-un-voyage-avec-l-ia` (6 étapes), chaque étape reprise du texte visible ; Article enrichi (isPartOf, about, keywords). `seo.test.ts` : longueurs title/description bornées, HowTo = visible. Home : `src/homeContent.ts` et `index.html` alignés (FR + EN). `ROUTINE.md` § 2 : règle CTR. Backlog : `ctr-review` (bloqué par Search Console), `backlinks` (action Marion, liste de cibles honnêtes).

**Non fait.** Aucune requête ciblée sur données réelles (pas de Search Console) ; aucun backlink (action manuelle de Marion) ; pas de nouvelle page. Pas de push ni de déploiement.

**Prochain run.** Marion : créer `sc-domain:monpetitvoyageur.com`, soumettre le sitemap, puis déployer. Routine : 28 jours après indexation, appliquer la règle CTR sur la première requête ≥ 50 impressions / CTR < 2 %.

## 2026-09-08 — Search Console créée, sitemap soumis, push de main

**Fait.** Propriété `sc-domain:monpetitvoyageur.com` créée et validée automatiquement (IONOS relié à Google comme fournisseur DNS : aucun enregistrement TXT à poser). Sitemap envoyé, état « Réussite », 5 URL découvertes. Inspection de `/` : dernière exploration Googlebot le 06/09 à 14:57 en **404** (période des déploiements cassés, corrigée le 08) ; indexation demandée. `main` poussé (commit 72a7277) : Railway reconstruit `frontend-web` avec les nouveaux titles/descriptions/JSON-LD.

**Prochain run.** Vérifier dans Search Console que `/` et les 4 guides passent en « indexée » ; demander l'indexation des 4 guides si toujours absents ; premières données Performances sous 48 h ; règle CTR après 28 jours.

## 2026-09-09 — Indexation confirmée, chemin critique et images de partage

**Avant.** Les 5 URL étaient déployées mais leur indexation n'était pas vérifiée. `src/styles.css` chargeait Google Fonts par `@import` (chaîne bloquante : styles.css puis fonts.googleapis.com). `og:image` pointait sur `logo-hero.webp`, une **WebP animée de 1,95 Mo** — que la plupart des plateformes de partage n'affichent pas —, sans `og:image:width/height/alt` ni `twitter:image` malgré `twitter:card=summary_large_image`. Les pages guides déclaraient le logo `width="160" height="44"` alors que l'image fait 800×534 (ratio 1,50 contre 3,64 annoncé) : décalage de mise en page au chargement. `logo.png` pesait 568 Ko pour un affichage de 66 à 176 px.

**Mesuré.** Production (UA GPTBot, 9 URL) : `/` 200, les 4 guides 200, `/robots.txt` `text/plain`, `/sitemap.xml` `application/xml`, `/llms.txt` 200, `/inexistant-test-404-routine` **404**. Search Console : **les 5 URL sont indexées** (inspection du 09/09) — c'était l'objectif du run précédent ; fils d'Ariane valide sur les 4 guides, HTTPS OK. Sitemap « Opération effectuée », 5 pages découvertes. Performances : **0 clic, 0 impression**, données arrêtées au 06/09 (avant indexation) et rapport Indexation encore en « traitement des données » → règle CTR inapplicable, à revoir vers le 06/10.

**Piège consigné.** L'inspection d'URL affiche la « canonique déclarée » de l'URL *précédente* quand on enchaîne les inspections sans rechargement complet : `/planificateur-voyage-ia` semblait déclarer `/`, et `/budget-voyage` semblait déclarer `/planificateur-voyage-ia`. Contre-vérifié : curl Googlebot desktop **et** smartphone, `dist/`, un seul `<link rel=canonical>` par page, aucun en-tête `Link` — toutes les canoniques sont correctes. Recharger la page d'inspection à froid avant de conclure à une anomalie.

**Fait.** (1) `@import` retiré de `src/styles.css`, remplacé par `preconnect` googleapis + gstatic et `<link rel=stylesheet>` dans `index.html` — backlog `cwv-fonts` clos ; les 5 fontes se chargent, vérifié au navigateur. (2) Nouvelle `og-image.jpg` 1200×630 (88 Ko), composée de la carte de marque sur le bleu profond `#123746` du site, posée sur l'accueil **et** les 4 guides avec `og:image:width/height/alt` et `twitter:image` ; `image` de l'`Article` JSON-LD alignée. (3) `logo.png` 568 Ko → **61 Ko** (480×320, PNG8). (4) Logo d'en-tête des guides déclaré `66x44` : le ratio annoncé correspond enfin à l'image (1,500 = 1,500, vérifié au navigateur), source de décalage supprimée. (5) Carte fixe `logo-hero-static.webp` (95 Ko) servie via `<picture>` aux visiteurs en `prefers-reduced-motion`, avec `preload` conditionnel — poids réduit pour eux et conformité WCAG 2.2.2. (6) 4 nouveaux tests dans `seo.test.ts` : tout fichier image référencé existe dans `public/`, `og:image` fixe 1200×630 + alt + `twitter:image` sur les 5 pages, dimensions réelles du JPEG lues dans son marqueur SOF, repli mouvement réduit et budgets de poids. 28 tests verts, build OK.

**Non fait, et pourquoi.** `logo-hero.webp` reste à **1,95 Mo** : c'est l'image LCP. Le format est déjà optimal — ré-encodages libwebp mesurés à q68 (1,85 Mo), q70 (1,85 Mo), q80 `-min_size` (2,03 Mo) : **aucun gain**. La note du backlog (`cwebp -q 80 -resize`) était fausse : le fichier est une **animation de 36 images** à 70 ms, qu'un `cwebp` aurait détruite. Réduire ce fichier est donc une décision *visuelle*, pas technique — elle revient à Marion. Options mesurées : **A)** 18 images = 1,10 Mo, animation deux fois moins fluide ; **B)** toile 688 px = 1,30 Mo ; **C)** toile 480 px = 0,83 Mo, flou car la carte s'affiche jusqu'à 544 px CSS ; **D)** carte fixe = **0,095 Mo (−95 %)**, qualité identique mais l'avion ne vole plus. Recommandation : **D**, en réanimant l'avion en CSS par-dessus la carte fixe si le mouvement compte (l'animation ne concerne que la zone de l'avion, en haut à droite). Aucune page créée : aucune intention non couverte ne le justifiait, et sans données de performance rien ne permet d'en prioriser une. `apex-https` et `backlinks` restent des actions Marion. Pas de push ni de déploiement.

**Prochain run.** Vérifier que le déploiement a eu lieu (`curl -s https://www.monpetitvoyageur.com/og-image.jpg -o /dev/null -w '%{http_code} %{content_type}'` → `200 image/jpeg`) ; relever les premières impressions dans Search Console (attendues à partir du ~16/09) ; relancer Marion sur `hero-poids-decision`, `apex-https` et `backlinks`.

## 2026-09-09 — Déploiement, puis l'image LCP divisée par quatre sans toucher au dessin

**Déployé et vérifié.** `main` poussé (commit 4447e96), Railway a reconstruit `frontend-web`. Production contrôlée : `og-image.jpg` 200 `image/jpeg` 88 016 o, `logo.png` 200 `image/png` 61 479 o, l'accueil sert bien `og:image` + `og:image:width/height/alt` et le `<link>` de polices. La passe du matin est en ligne.

**Le vrai déblocage : l'AVIF animé.** Marion veut que l'avion continue de voler — donc aucune des quatre options dégradantes (moins d'images, toile réduite, carte fixe) n'était acceptable. Analyse des images : ce n'est pas seulement l'avion qui bouge, la carte s'incline et le globe du « V » tourne ; d'où l'échec des ré-encodages WebP (le codec n'a plus de marge). En revanche **AV1 compresse la séquence bien mieux que WebP** : `avifenc --timescale 1000 --duration 70 -q 62 --qalpha 70` produit les **mêmes 36 images à 70 ms, alpha compris, pour 490 480 o au lieu de 1 950 088 o — −75 %**. Écart avec l'original mesuré au RMSE : **0,4 % sur l'image 0, 1,1 % sur l'image 18** — invisible à l'œil, contrôlé image par image après `avifdec`.

**Servi via `<picture>`** : `<source type="image/avif">` d'abord, la WebP restant le `<img src>` de repli pour les navigateurs sans AVIF (Firefox < 113 affichera une carte fixe — dégradation bénigne). `preload` ajusté sur l'AVIF avec `type="image/avif"`, que les navigateurs sans support ignorent d'eux-mêmes.

**Bug attrapé au passage.** `server.mjs` n'avait pas d'entrée `.avif` dans sa table MIME et servait le fichier en `application/octet-stream`, ce qui empêche son affichage. Corrigé, plus un test qui vérifie que **chaque extension réellement référencée** possède un type MIME déclaré — la même erreur ne peut plus passer.

**Décision de Marion.** Son Chrome annonce `prefers-reduced-motion: reduce` : avec le repli accessibilité que j'avais ajouté le matin, elle n'aurait jamais vu l'avion voler. Elle a tranché pour que l'animation soit servie à tout le monde ; le `<source>` `prefers-reduced-motion` a été retiré et `logo-hero-static.webp` supprimé. Un test interdit désormais la réintroduction d'un repli qui remplacerait l'animation par une image fixe.

**Vérifié.** 30 tests verts, build OK, `/logo-hero.avif` servi en `image/avif` (490 480 o), `/logo-hero-static.webp` en 404. Dans Chrome : la source retenue est bien `logo-hero.avif` malgré `reduce`, et deux captures espacées montrent **l'avion à deux positions différentes** — l'animation tourne.

**Prochain run.** Vérifier l'AVIF en production (`curl -sI https://www.monpetitvoyageur.com/logo-hero.avif` → `200 image/avif`) et mesurer le LCP réel maintenant que l'image critique est passée de 1,95 Mo à 490 Ko. Relever les premières impressions Search Console (~16/09).

## 2026-09-09 — HTTPS de la racine réparé, AVIF en production

**AVIF déployé et vérifié.** `main` poussé (97645c8), Railway a reconstruit. Production : `/logo-hero.avif` répond **200 `image/avif`, 490 480 o** ; le HTML d'accueil référence `logo-hero.avif` avec `logo-hero.webp` en repli. L'image LCP est passée de 1,95 Mo à 490 Ko en production, l'avion vole toujours.

**Racine HTTPS : cause trouvée et corrigée.** Le domaine racine était correctement configuré en redirection vers `www`, mais **aucun certificat SSL ne lui était attaché** — le handshake TLS échouait donc avant même la redirection. Le compte IONOS disposait de **deux certificats « SSL Starter Wildcard » inclus et non configurés** (portefeuille 1/3 utilisé) : l'un a été affecté à `monpetitvoyageur.com`, **sans achat** (portefeuille désormais 2/3).

**Piège à retenir.** Le bouton « Activer » de la fiche domaine **et** le bouton « Configurer un certificat » mènent tous deux à une page de vente où tout est « Acheter ». Le chemin gratuit est : *Domaines & SSL > Certificats > carte SSL Starter Wildcard > « Activer maintenant » > sélection du domaine*. La page de configuration finale n'affiche aucun prix — c'est le signe qu'on consomme bien un certificat inclus.

**Preuves.** Certificat émis par Sectigo (Public Server Authentication CA DV R36), `CN=*.monpetitvoyageur.com`, SAN = `*.monpetitvoyageur.com` **et** `monpetitvoyageur.com`, valide du 09/09/2026 au 08/03/2027 (180 jours, nouvelle norme IONOS). `https://monpetitvoyageur.com/` → **302** vers `https://www.monpetitvoyageur.com/` → **200**, chaîne suivie de bout en bout.

**Réserve.** La redirection est un **302** (temporaire), pas un 301 : sans gravité ici puisque la racine n'a jamais été indexée et que tous les canonical pointent sur `www`, mais consigné en backlog (`apex-301`). Relevé aussi : un appel sur trois met ~18 s côté redirection IONOS contre ~2,5 s pour les autres.

**Prochain run.** Mesurer le LCP réel maintenant que l'image critique est divisée par quatre ; relever les premières impressions Search Console (~16/09) ; relancer Marion sur les backlinks, seul item ouvert qui dépende d'elle.

## 2026-09-11 — Dix crawlers avaient la clé de l'app privée ; la mémoire disait faux sur trois points

**Reprise.** Le verrou du 2026-09-10 09:23 était encore là sans entrée de journal : le run précédent s'est interrompu. Verrou périmé (> 2 h) écrasé, reprise de son « prochain run ».

**Avant.** `public/robots.txt` fermait `/admin` et `/mobile` dans le groupe `User-agent: *`, puis listait dix agents nommés (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, anthropic-ai, PerplexityBot, Google-Extended, Applebot-Extended, Bingbot) avec pour seule règle `Allow: /`. Or **un groupe robots.txt n'hérite de rien** : en voulant accueillir les moteurs génératifs, on leur ouvrait exactement les deux surfaces fermées à tout le monde. Vérifié en production : `/mobile` et `/admin` renvoient **200 avec la coquille HTML de l'accueil** — même title, même canonical vers `/`, `robots: index, follow`. Le `noindex` de `/admin` que notait le journal du 08/09 est posé en JavaScript par `src/seo.ts` : il n'existe pas pour un crawler qui ne l'exécute pas.

**Mesuré.** Production (UA GPTBot, 9 URL) : `/` 200, les 4 guides 200, `robots.txt` `text/plain`, `sitemap.xml` `application/xml` (5 URL), `llms.txt` 200, `/inexistant-test-404-routine-0911` **404** ; un seul `<h1>`, title, description et canonical corrects sur les 5 pages, toutes en `index, follow`. Search Console : **première impression du site** — 1 impression, 0 clic, position moyenne 99, requête « ia en voyage » ; le graphique s'arrête au 08/09 (retard de traitement) et le rapport Indexation reste en « traitement des données en cours ». Trop peu pour décider quoi que ce soit : la règle CTR demande ≥ 50 impressions.

**Fait.** (1) `Disallow: /admin` et `Disallow: /mobile` ajoutés **dans chaque groupe** de `robots.txt`. (2) `server.mjs` renvoie `X-Robots-Tag: noindex, nofollow` sur les routes applicatives (`/mobile*`, `/admin*`) — l'accueil et les guides n'y touchent pas. (3) `seo/build.mjs` : `readHomeHead()` relit title, description, H1, canonical et indexabilité de l'accueil **dans `index.html`** au lieu de faire confiance à une copie manuelle — la mémoire enregistrait encore un title abandonné depuis le 08/09. (4) Trois tests ajoutés (35 verts) : chaque groupe robots ferme les routes privées, `server.mjs` porte le `noindex`, `state.json` décrit l'accueil tel qu'il est servi. Les trois échouent bien si on réintroduit le défaut (vérifié par mutation). (5) `state.json` : nouvelle section `privateRoutes` (pourquoi `/admin` et `/mobile` ne sont pas des orphelines à corriger), KPI Search Console, six entrées d'historique. (6) Annexe opératoire rendue à la tâche planifiée : le prompt du 08/09 avait perdu le pointeur vers `seo/ROUTINE.md`, le verrou et la mémoire — un run pouvait donc repartir de zéro. (7) `ROUTINE.md` : verrou périmé, vérités produit à revérifier, poids réel de la landing, `--sync` de l'accueil.

**Corrigé dans la mémoire, parce que c'était faux.** Le problème ouvert « bundle JS lourd (three.js, mapbox) chargé sur la landing », noté deux fois les 08 et 09/09, est infirmé : mesure au navigateur sur le `dist` de production, l'accueil télécharge **4 ressources, ~650 Ko, dont 99 Ko de JavaScript gzippé** ; `mapbox-gl` (1,86 Mo) et `three` (688 Ko) sont en import dynamique et ne sont jamais demandés. Chantier retiré pour ne pas y envoyer les prochains runs.

**Nouvelle vérité produit à surveiller.** Le produit a gagné un abonnement (5,99 €/mois, 49 €/an, essai 7 jours ; formule « Voyage Premium » à 9,99 €/mois sur `/mobile`), mais `hasActiveAccess()` laisse l'application **ouverte tant que `STRIPE_SECRET_KEY` est absente**, et le paywall ne s'affiche que si l'API renvoie `billing_enabled`. Donc « Inscription gratuite » et l'`Offer` `price: "0"` de l'accueil sont **exacts aujourd'hui** — et deviendront mensongers le jour où Stripe sera branché. Rien n'a été modifié ; le déclencheur et la liste exacte des textes à mettre à jour sont dans `backlog → stripe-seo-offer` et dans `ROUTINE.md`.

**Non fait, et pourquoi.** Aucune page créée. Le comparatif « meilleurs planificateurs de voyage IA » a été instruit puis écarté : seul `layla.ai` publie un tarif (« For $49/year… », consulté le 11/09) ; `mindtrip.ai/pricing` et `tripplanner.ai` n'affichent aucun prix, et leurs fonctionnalités ne sont pas vérifiables sans créer un compte chez chacun. Un tableau dont la moitié des cases vaudrait « tarif non public » n'a pas l'utilité réelle qu'exige la règle « une page = une intention et un service rendu » ; la recherche est consignée dans le backlog avec un angle de repli (comparer des méthodes plutôt que des prix). `backlinks` et la vérification des aperçus de partage restent des actions de Marion. Pas de push, pas de déploiement.

**Prochain run.** Vérifier le déploiement de cette passe : `curl -s -A GPTBot https://www.monpetitvoyageur.com/robots.txt | grep -A3 "User-agent: GPTBot"` doit montrer les deux `Disallow`, et `curl -sI https://www.monpetitvoyageur.com/mobile | grep -i x-robots-tag` doit renvoyer `noindex, nofollow`. Puis relever Search Console vers le 18/09 (les impressions devraient enfin couvrir la période post-indexation) et relancer Marion sur les backlinks, seul chantier ouvert qui ne dépende que d'elle.
