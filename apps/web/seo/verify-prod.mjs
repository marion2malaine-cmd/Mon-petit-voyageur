#!/usr/bin/env node
// Détecteur de dérive entre le dépôt (source de vérité) et la production.
//
// Pourquoi ce fichier existe : le 2026-09-12, la routine a découvert que la
// production servait encore la version du 2026-09-08. Trois commits corrigeant
// des affirmations devenues fausses (« Inscription gratuite » alors que Stripe
// live facture, /admin et /mobile ouverts aux crawlers génératifs) étaient
// restés locaux pendant plus de 24 h. Les tests étaient verts, le build vert,
// le journal complet : rien dans le système ne regardait ce que le site
// racontait réellement aux robots.
//
// Ce script ne contient AUCUNE valeur attendue en dur. Il relit le dépôt
// (index.html, state.json, public/robots.txt, server.mjs, appTranslations.ts)
// et vérifie que la production dit la même chose. Toute valeur qu'on changerait
// dans le produit se propage donc ici automatiquement.
//
//   npm run seo:verify-prod -w @mlt/web
//
// Sortie : un tableau OK / ÉCHEC, code de sortie 1 si une vérification échoue.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readHomeHead, readState, STATE_PATH } from "./build.mjs";
import { SITE_URL } from "./site.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(here, "..");
const UA = "Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)";
const DELAY_MS = 1000; // le mode opératoire impose 1 s entre deux requêtes
const MISSING_URL = "/inexistant-verif-" + Date.now().toString(36);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
// `detail` s'affiche toujours (une mesure) ; `whenFail` seulement en cas
// d'échec (une explication), pour qu'une ligne OK ne porte jamais le texte
// d'un problème qui n'a pas eu lieu.
function check(name, ok, detail = "", whenFail = "") {
  results.push({ name, ok, detail: ok ? detail : (whenFail || detail) });
}

async function fetchUrl(pathname) {
  await sleep(DELAY_MS);
  const res = await fetch(SITE_URL + pathname, {
    headers: { "User-Agent": UA },
    redirect: "manual"
  });
  const body = res.status < 400 || res.status === 404 ? await res.text() : "";
  return { status: res.status, headers: res.headers, body };
}

// --- Ce que le dépôt affirme -------------------------------------------------

function expectations() {
  const state = readState();
  const home = readHomeHead();
  const robotsTxt = fs.readFileSync(path.join(WEB_DIR, "public/robots.txt"), "utf8");
  const serverMjs = fs.readFileSync(path.join(WEB_DIR, "server.mjs"), "utf8");
  const translations = fs.readFileSync(path.join(WEB_DIR, "src/appTranslations.ts"), "utf8");

  // Routes privées : la liste vient de server.mjs, pas d'une copie.
  const spa = serverMjs.match(/const SPA_PREFIXES = \[([^\]]*)\]/)?.[1] ?? "";
  const privateRoutes = [...spa.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  // Groupes d'agents déclarés dans robots.txt.
  const agents = [...robotsTxt.matchAll(/^User-agent:\s*(.+)$/gm)].map((m) => m[1].trim());

  // Prix du paywall, lus dans les traductions françaises.
  const numeric = (label) => {
    const raw = translations.match(new RegExp(`${label}: "([^"]*)"`))?.[1] ?? "";
    return raw.replace(/[^0-9,.]/g, "").replace(",", ".").replace(/\.$/, "");
  };

  return {
    state,
    home,
    privateRoutes,
    agents,
    robotsTxt,
    pageUrls: Object.keys(state.pages),
    prices: [numeric("planMonthlyPrice"), numeric("planAnnualPrice")].filter(Boolean)
  };
}

// --- Vérifications -----------------------------------------------------------

async function verifyPages(exp) {
  for (const url of exp.pageUrls) {
    const { status, body } = await fetchUrl(url);
    if (status !== 200) {
      check(`${url} · 200`, false, `reçu ${status}`);
      continue;
    }
    check(`${url} · 200`, true);

    const h1Count = (body.match(/<h1[\s>]/g) || []).length;
    check(`${url} · un seul H1`, h1Count === 1, `${h1Count} trouvé(s)`);

    const title = body.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? "";
    const description = body.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
    const canonical = body.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? "";
    check(`${url} · title + description`, Boolean(title && description),
      `title ${title.length} car., description ${description.length} car.`);
    check(`${url} · canonical`, canonical === SITE_URL + (url === "/" ? "/" : url),
      `déclaré ${canonical || "(aucun)"}`);

    // La page ne doit jamais se dire gratuite : le paywall est actif.
    check(`${url} · aucune « Inscription gratuite »`, !body.includes("Inscription gratuite"));

    // L'accueil doit servir exactement le head du dépôt.
    if (url === "/") {
      check("/ · title identique au dépôt", title === exp.home.title,
        title === exp.home.title ? "" : `prod « ${title} » ≠ dépôt « ${exp.home.title} »`);
      check("/ · description identique au dépôt", description === exp.home.description,
        description === exp.home.description ? "" : "la production sert une autre description");

      const offers = [...body.matchAll(/"price":\s*"([0-9.]+)"/g)].map((m) => m[1]);
      const same = exp.prices.every((p) => offers.includes(p)) && offers.length === exp.prices.length;
      check("/ · prix JSON-LD = prix du paywall", same,
        `prod [${offers.join(", ")}] vs paywall [${exp.prices.join(", ")}]`);

      const visible = exp.prices.every((p) => body.includes(p.replace(".", ",")));
      check("/ · prix lisibles dans le texte visible", visible);
    }
  }
}

async function verifyTechnical(exp) {
  const robots = await fetchUrl("/robots.txt");
  check("/robots.txt · text/plain", robots.headers.get("content-type")?.includes("text/plain") ?? false,
    robots.headers.get("content-type") ?? "");
  check("/robots.txt · identique au dépôt", robots.body.trim() === exp.robotsTxt.trim(),
    "", "la production sert un robots.txt différent");

  // Un groupe robots.txt n'hérite jamais de « User-agent: * » : chaque groupe
  // servi en production doit fermer lui-même les routes privées.
  const groups = robots.body.split(/^User-agent:/m).slice(1);
  for (const route of exp.privateRoutes) {
    const openGroups = groups
      .filter((g) => !new RegExp(`^Disallow:\\s*${route}\\s*$`, "m").test(g))
      .map((g) => g.split("\n")[0].trim());
    check(`robots.txt · ${route} fermé dans chaque groupe`, openGroups.length === 0,
      openGroups.length ? `ouvert pour : ${openGroups.join(", ")}` : `${groups.length} groupes`);
  }

  for (const route of exp.privateRoutes) {
    const res = await fetchUrl(route);
    const tag = res.headers.get("x-robots-tag") ?? "";
    check(`${route} · X-Robots-Tag noindex`, tag.includes("noindex"), tag || "(en-tête absent)");
  }

  const sitemap = await fetchUrl("/sitemap.xml");
  check("/sitemap.xml · XML", sitemap.headers.get("content-type")?.includes("xml") ?? false,
    sitemap.headers.get("content-type") ?? "");
  const missing = exp.pageUrls.filter((u) => !sitemap.body.includes(SITE_URL + (u === "/" ? "/" : u)));
  check("/sitemap.xml · toutes les URL du dépôt", missing.length === 0,
    missing.length ? `absentes : ${missing.join(", ")}` : `${exp.pageUrls.length} URL`);

  const llms = await fetchUrl("/llms.txt");
  check("/llms.txt · 200", llms.status === 200, String(llms.status));

  // Les moteurs génératifs lisent ce fichier comme une consigne. Il doit publier
  // les tarifs réels…
  const quoted = exp.prices.filter((p) => llms.body.includes(p.replace(".", ",")));
  check("/llms.txt · tarifs du paywall publiés", quoted.length === exp.prices.length,
    `${quoted.length}/${exp.prices.length} prix trouvés`);

  // …et ne jamais interdire de citer ce qu'il publie lui-même (contradiction
  // trouvée le 2026-09-12 : les tarifs étaient donnés puis déclarés non publics).
  check("/llms.txt · aucune interdiction de citer les tarifs",
    !/Ne pas citer[^\n]*prix d'abonnement/i.test(llms.body),
    "", "une consigne interdit de citer un prix que le fichier publie");

  const notFound = await fetchUrl(MISSING_URL);
  check("URL inexistante · 404", notFound.status === 404, String(notFound.status));
}

// --- Rapport -----------------------------------------------------------------

async function main() {
  const exp = expectations();
  console.log(`Vérification de ${SITE_URL} contre le dépôt (état du ${exp.state.updated})\n`);

  await verifyPages(exp);
  await verifyTechnical(exp);

  const width = Math.max(...results.map((r) => r.name.length));
  for (const r of results) {
    const mark = r.ok ? "  OK  " : "ÉCHEC ";
    console.log(`${mark} ${r.name.padEnd(width)}  ${r.detail}`.trimEnd());
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications passées.`);
  if (failed.length) {
    console.log(
      "\nLa production ne dit pas ce que dit le dépôt. Cause la plus fréquente :\n" +
      "des commits SEO non poussés (`git log --oneline origin/main..HEAD`).\n" +
      "Le déploiement passe par un push sur main — jamais par `railway up`."
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Vérification impossible :", err.message);
    process.exitCode = 1;
  });
}

export { expectations, STATE_PATH };
