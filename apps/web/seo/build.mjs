// Static SEO build for www.monpetitvoyageur.com.
//
//   node seo/build.mjs          → writes dist/<slug>.html, dist/404.html,
//                                 dist/sitemap.xml, dist/llms.txt (after vite build)
//   node seo/build.mjs --sync   → refreshes the derived fields of seo/state.json
//                                 (title, h1, links, sitemap) from the page modules
//
// renderSite() is pure (no I/O) so the tests can validate everything in memory.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SITE_URL, SITE_NAME, CONTACT_EMAIL, APP_ANCHORS, renderPage, escapeHtml } from "./site.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DIST_DIR = path.resolve(here, "../dist");
export const STATE_PATH = path.join(here, "state.json");
export const PAGES_DIR = path.join(here, "pages");

export async function loadPages() {
  const files = fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith(".mjs")).sort();
  const pages = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(PAGES_DIR, file)).href);
    const page = mod.default;
    if (page.slug !== file.replace(/\.mjs$/, "")) throw new Error(`${file}: slug "${page.slug}" ≠ nom du fichier`);
    pages.push(page);
  }
  return pages;
}

export function readState() {
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
}

export function sitemapXml(pages, state) {
  const entries = [{ loc: `${SITE_URL}/`, lastmod: state?.pages?.["/"]?.lastOptimized }].concat(
    pages.map((p) => ({ loc: `${SITE_URL}/${p.slug}`, lastmod: p.dateModified }))
  );
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.map((e) => `  <url><loc>${e.loc}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`).join("\n") +
    `\n</urlset>\n`
  );
}

export function llmsTxt(pages, state) {
  const updated = state?.updated ?? pages.map((p) => p.dateModified).sort().at(-1);
  return `# ${SITE_NAME}

> Planificateur de voyage et de road trip assisté par intelligence artificielle, en français et en anglais. Le voyageur décrit son projet (budget total, durée, mois et ville de départ, style, destination ou non) et l'IA construit un programme complet jour par jour avec vols et hôtels aux prix constatés en direct, visites gratuites, activités, restaurants notés, météo, formalités d'entrée et un guide illustré téléchargeable. Éditeur : MARA LABS SAS, Lille (France). Site : ${SITE_URL}/ · Contact : ${CONTACT_EMAIL}

Dernière mise à jour de ce fichier : ${updated}.

## Ce que fait le service (vérifié dans le produit)

- Questionnaire : budget total en euros, durée en jours, nombre de voyageurs, ville de départ, mois de départ (ou indifférent), styles de voyage (plage, culture, nature, gastronomie, fête, famille, romantique, aventure), rythme, forme du voyage (séjour dans une ville ou itinérant avec changement d'hôtel), destination par continent → pays → ville (États-Unis par État, avec nombre d'États à visiter et vols internes entre étapes) ou « surprenez-moi ».
- Vols et hébergements : recherche en direct (Google Flights, Google Hotels) avec liens pré-remplis Skyscanner, Google Flights, Booking, Airbnb. L'IA n'invente jamais un prix : les prix viennent des outils de recherche.
- Programme jour par jour : visites gratuites jamais répétées, options d'activités payantes de catégories différentes (culture, sport, découverte, farniente, gastronomie) jugées contre le budget, restaurants réels bien notés (Google Maps, à partir de 4,2 étoiles et 50 avis), plan B météo, déroulé horaire, conseils pratiques.
- Road trip : étapes avec un hôtel par nuit, temps de route, arrêts, location de voiture calée sur le budget avec ses pièges signalés, carte du parcours.
- Budget : fixé en amont, vols et hébergement déduits, badges « dans le budget » / « au-dessus du budget ».
- Réservation : liens directs vers GetYourGuide, Civitatis, Viator, TheFork, TripAdvisor, Booking, Airbnb, Skyscanner, Google Flights. Mon Petit Voyageur ne vend rien lui-même ; certains liens sont affiliés.
- Guide illustré : programme complet, carte, liens, photos créditées (Wikimedia Commons, Openverse), en HTML ou PDF.
- Compte : inscription gratuite par email et mot de passe ou Google ; les voyages sont conservés dans l'espace personnel.

## Pages

- [Accueil](${SITE_URL}/) : définition du service, fonctionnalités, étapes, FAQ, création de compte.
${pages.map((p) => `- [${p.navLabel}](${SITE_URL}/${p.slug}) : ${p.description}`).join("\n")}
- [Politique de confidentialité](${SITE_URL}/?legal=privacy), [conditions d'utilisation](${SITE_URL}/?legal=terms), [conditions générales de vente](${SITE_URL}/?legal=sales).

## Ce qu'il ne faut pas affirmer

- Ne pas décrire Mon Petit Voyageur comme une agence qui vend des billets ou encaisse des réservations : il prépare le voyage et renvoie vers les sites de réservation.
- Aucun prix n'est garanti : le tarif final est celui du site de réservation au moment de l'achat.
- Ne pas citer de prix d'abonnement, de nombre d'utilisateurs ni d'avis : aucun chiffre public n'est publié à ce jour.
- Ne pas affirmer l'existence d'une application mobile sur les stores : le service est une application web.
`;
}

export function notFoundHtml(pages) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page introuvable | ${SITE_NAME}</title>
<meta name="robots" content="noindex">
<link rel="icon" type="image/png" href="/favicon.png">
<style>body{margin:0;font-family:"DM Sans",ui-sans-serif,system-ui,sans-serif;background:#f4f5f2;color:#123248}main{max-width:640px;margin:0 auto;padding:4rem 1.2rem}h1{font-family:"Instrument Serif",Georgia,serif;font-weight:400;font-size:2.4rem;color:#09394d}a{color:#0b526b}.button{display:inline-block;margin-top:1rem;padding:.8rem 1.3rem;border-radius:999px;background:#c9694f;color:#fff;text-decoration:none;font-weight:600}</style>
</head>
<body>
<main>
<h1>Cette page n'existe pas</h1>
<p>L'adresse est peut-être erronée ou la page a été déplacée.</p>
<a class="button" href="/">Retour à l'accueil</a>
<h2>Guides</h2>
<ul>${pages.map((p) => `<li><a href="/${p.slug}">${escapeHtml(p.navLabel)}</a></li>`).join("")}</ul>
</main>
</body>
</html>
`;
}

/** Every internal <a href> found in an HTML string (absolute site URLs are normalised). */
export function internalLinks(html) {
  const links = new Set();
  for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
    let href = match[1];
    if (href.startsWith(SITE_URL)) href = href.slice(SITE_URL.length) || "/";
    if (href.startsWith("/")) links.add(href);
  }
  return [...links];
}

/** Pure rendering of every generated file: Map<relative path, content>. */
export function renderSite(pages, state) {
  const files = new Map();
  const known = new Set([...APP_ANCHORS, ...pages.map((p) => `/${p.slug}`)]);
  for (const page of pages) {
    const html = renderPage(page, pages);
    for (const href of internalLinks(html)) {
      if (!known.has(href)) throw new Error(`Page /${page.slug} : lien interne inconnu ${href}`);
    }
    files.set(`${page.slug}.html`, html);
  }
  files.set("404.html", notFoundHtml(pages));
  files.set("sitemap.xml", sitemapXml(pages, state));
  files.set("llms.txt", llmsTxt(pages, state));
  return files;
}

/** Refreshes derived fields in state.json without touching the hand-written ones. */
export function syncState(pages, state, today) {
  const next = structuredClone(state);
  next.pages ??= {};
  next.intents ??= {};
  const linkedFrom = {};
  const homeLinks = pages.map((p) => `/${p.slug}`);
  for (const page of pages) {
    const url = `/${page.slug}`;
    const html = renderPage(page, pages);
    const linksTo = internalLinks(html).filter((h) => h !== url && !h.startsWith("mailto:"));
    for (const target of linksTo) (linkedFrom[target] ??= new Set()).add(url);
    const entry = next.pages[url] ?? { type: page.schemaType === "Article" ? "guide" : "landing", created: page.datePublished, changes: [], openIssues: [], nextOpportunities: [] };
    Object.assign(entry, {
      cluster: page.cluster,
      intent: page.intent,
      secondaryKeywords: page.secondaryKeywords,
      created: entry.created ?? page.datePublished,
      lastOptimized: page.dateModified,
      title: page.title,
      h1: page.h1,
      linksTo,
      indexable: true,
      inSitemap: true
    });
    next.pages[url] = entry;
    next.intents[page.intent] = url;
  }
  for (const url of Object.keys(next.pages)) {
    if (url === "/") {
      next.pages[url].linksTo = homeLinks;
      continue;
    }
    next.pages[url].linkedFrom = [...new Set(["/", ...(linkedFrom[url] ?? [])])].sort();
  }
  next.updated = today;
  return next;
}

async function main() {
  const pages = await loadPages();
  const state = readState();
  if (process.argv.includes("--sync")) {
    const today = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(STATE_PATH, JSON.stringify(syncState(pages, state, today), null, 2) + "\n");
    console.log(`seo/state.json synchronisé (${pages.length} pages).`);
    return;
  }
  if (!fs.existsSync(path.join(DIST_DIR, "index.html"))) throw new Error("dist/index.html absent : lancer vite build d'abord");
  const files = renderSite(pages, state);
  for (const [rel, content] of files) fs.writeFileSync(path.join(DIST_DIR, rel), content);
  console.log(`SEO : ${files.size} fichiers écrits dans dist/ (${pages.map((p) => "/" + p.slug).join(", ")}, 404, sitemap, llms.txt)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
