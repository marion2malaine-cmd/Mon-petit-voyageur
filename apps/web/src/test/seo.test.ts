// Guards for the SEO system (apps/web/seo + index.html + server.mjs).
// Every strategic page must stay indexable, unique in intent, correctly linked
// and consistent with seo/state.json (the routine's memory).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { loadPages, readState, readHomeHead, renderSite, syncState, internalLinks } from "../../seo/build.mjs";
import { SITE_URL, APP_ANCHORS } from "../../seo/site.mjs";
import { SEO, EYEBROW, ABOUT, FAQ, FEATURES, STEPS, PRICING } from "../homeContent";
import { text as appText } from "../appTranslations";

const webRoot = path.resolve(__dirname, "../..");
const pages = await loadPages();
const state = readState();
const files = renderSite(pages, state);
const indexHtml = fs.readFileSync(path.join(webRoot, "index.html"), "utf8");
const robots = fs.readFileSync(path.join(webRoot, "public/robots.txt"), "utf8");
/** Surfaces privées de l'application : jamais explorées, jamais indexées. */
const APP_ROUTES = ["/admin", "/mobile"];

function count(html: string, re: RegExp) {
  return (html.match(re) ?? []).length;
}
function jsonLdBlocks(html: string) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}
function textOf(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("pages SEO statiques", () => {
  it("existent et ont un slug, une intention et un cluster", () => {
    expect(pages.length).toBeGreaterThanOrEqual(4);
    for (const p of pages) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(p.intent).toBeTruthy();
      expect(p.cluster).toBeTruthy();
      expect(p.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.dateModified >= p.datePublished).toBe(true);
    }
  });

  it("ont exactement un H1, un title et une description spécifiques, un canonical cohérent", () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const p of pages) {
      const html = files.get(`${p.slug}.html`)!;
      expect(count(html, /<h1[\s>]/g)).toBe(1);
      expect(p.title.length).toBeGreaterThan(30);
      expect(p.title.length).toBeLessThanOrEqual(110);
      // Google truncates around 60 characters: the part before the brand must stand alone.
      expect(p.title.split(" | ")[0].length, `${p.slug} : titre trop long avant la marque`).toBeLessThanOrEqual(80);
      expect(p.description.length, `${p.slug} : description trop longue pour un extrait complet`).toBeLessThanOrEqual(190);
      expect(p.description.length).toBeGreaterThanOrEqual(80);
      expect(p.description.length).toBeLessThanOrEqual(200);
      expect(titles.has(p.title)).toBe(false);
      expect(descriptions.has(p.description)).toBe(false);
      titles.add(p.title);
      descriptions.add(p.description);
      expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/${p.slug}">`);
      expect(html).toContain('<meta name="robots" content="index, follow');
      expect(html).toContain('<html lang="fr">');
    }
  });

  it("portent des données structurées valides et conformes au contenu visible", () => {
    for (const p of pages) {
      const html = files.get(`${p.slug}.html`)!;
      const blocks = jsonLdBlocks(html);
      expect(blocks.length).toBe(1);
      const graph = blocks[0]["@graph"];
      const types = graph.map((g: any) => g["@type"]);
      expect(types).toContain("Organization");
      expect(types).toContain("WebSite");
      expect(types).toContain("BreadcrumbList");
      expect(types).toContain(p.schemaType);
      const faq = graph.find((g: any) => g["@type"] === "FAQPage");
      const visible = textOf(html);
      if (p.faq?.length) {
        expect(faq.mainEntity.length).toBe(p.faq.length);
        for (const q of faq.mainEntity) {
          expect(visible).toContain(q.name);
          expect(visible).toContain(q.acceptedAnswer.text);
        }
      } else {
        expect(faq).toBeUndefined();
      }
      const howTo = graph.find((g: any) => g["@type"] === "HowTo");
      if (p.howTo) {
        expect(howTo.step.length).toBe(p.howTo.steps.length);
        for (const step of howTo.step) expect(visible, `${p.slug} : étape HowTo « ${step.name} » invisible`).toContain(step.name);
      } else {
        expect(howTo).toBeUndefined();
      }
      const main = graph.find((g: any) => g["@type"] === p.schemaType);
      if (p.schemaType === "Article") expect(main.headline).toBe(p.h1);
      expect(visible).toContain(p.h1);
    }
  });

  it("n'ont que des liens internes connus, sont reliées à l'accueil et à au moins une page complémentaire", () => {
    const known = new Set([...APP_ANCHORS, ...pages.map((p) => `/${p.slug}`)]);
    for (const p of pages) {
      const html = files.get(`${p.slug}.html`)!;
      const links = internalLinks(html);
      for (const href of links) expect(known.has(href), `${p.slug} → ${href}`).toBe(true);
      expect(links).toContain("/");
      expect(links).toContain("/#connexion");
      const siblings = links.filter((l) => l !== `/${p.slug}` && pages.some((q) => `/${q.slug}` === l));
      expect(siblings.length, `${p.slug} doit lier au moins une autre page`).toBeGreaterThanOrEqual(1);
      // Contextual links inside the body, not only the navigation.
      expect(count(p.body, /href="\/[a-z0-9-]+"/g), `${p.slug} : lien contextuel dans le corps`).toBeGreaterThanOrEqual(1);
    }
  });

  it("couvrent des intentions distinctes (anti-cannibalisation)", () => {
    const intents = pages.map((p) => p.intent.toLowerCase().trim());
    expect(new Set(intents).size).toBe(intents.length);
    const h1s = pages.map((p) => p.h1);
    expect(new Set(h1s).size).toBe(h1s.length);
  });
});

describe("sitemap, robots, llms.txt, 404", () => {
  it("le sitemap liste l'accueil et toutes les pages, rien d'autre", () => {
    const sitemap = files.get("sitemap.xml")!;
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([`${SITE_URL}/`, ...pages.map((p) => `${SITE_URL}/${p.slug}`)]);
    expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it("robots.txt autorise les crawlers, exclut l'app privée et déclare le sitemap", () => {
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "OAI-SearchBot"]) expect(robots).toContain(`User-agent: ${bot}`);
    for (const p of pages) expect(robots).not.toContain(`Disallow: /${p.slug}`);
  });

  // Un groupe robots.txt n'hérite de rien : les règles de "User-agent: *" ne
  // s'appliquent pas aux agents nommés. Sans cette garde, déclarer GPTBot ou
  // ClaudeBot leur ouvrait /admin et /mobile, fermés à tous les autres.
  it("chaque groupe robots.txt, agents nommés compris, ferme /admin et /mobile", () => {
    const groups = robots
      .split(/\n\s*\n/)
      .filter((block) => /^User-agent:/m.test(block))
      .map((block) => ({
        agents: [...block.matchAll(/^User-agent:\s*(.+)$/gm)].map((m) => m[1].trim()),
        disallows: [...block.matchAll(/^Disallow:\s*(.+)$/gm)].map((m) => m[1].trim())
      }));
    expect(groups.length).toBeGreaterThanOrEqual(2);
    for (const group of groups) {
      for (const route of APP_ROUTES) {
        expect(group.disallows, `robots.txt : le groupe ${group.agents.join(", ")} n'interdit pas ${route}`).toContain(route);
      }
    }
  });

  it("llms.txt décrit le site et référence chaque page", () => {
    const llms = files.get("llms.txt")!;
    for (const p of pages) expect(llms).toContain(`${SITE_URL}/${p.slug}`);
    expect(llms).toContain("MARA LABS");
  });

  // Trouvé en production le 2026-09-12 : le fichier publiait « 5,99 € par mois
  // ou 49 € par an » puis, vingt lignes plus bas, « Ne pas citer de prix
  // d'abonnement […] aucun chiffre public n'est publié ». Un moteur génératif
  // lit les deux et retient la consigne : il tait le tarif que nous voulons
  // précisément le voir énoncer.
  it("llms.txt publie les tarifs sans interdire de les citer", () => {
    const llms = files.get("llms.txt")!;
    expect(llms).toContain("5,99 €");
    expect(llms).toContain("49 €");
    expect(llms).not.toMatch(/Ne pas citer[^\n]*prix d'abonnement/i);
  });

  it("la page 404 est noindex et renvoie vers l'accueil", () => {
    const html = files.get("404.html")!;
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain('href="/"');
  });
});

// Stripe est branché en production depuis le 2026-09-10 : l'application est
// fermée aux comptes sans essai ni abonnement. Des données structurées qui
// annonceraient « gratuit », ou un prix inventé, mentiraient à Google comme
// aux moteurs génératifs.
describe("tarifs : données structurées = produit réel", () => {
  it("les prix déclarés sont ceux du paywall de l'application", () => {
    expect(PRICING.monthly.display.fr).toBe(appText.fr.planMonthlyPrice);
    expect(PRICING.annual.display.fr).toBe(appText.fr.planAnnualPrice);
    expect(PRICING.monthly.display.en).toBe(appText.en.planMonthlyPrice);
  });

  it("aucune page ne promet plus un service gratuit", () => {
    for (const [name, html] of [["index.html", indexHtml], ...files] as [string, string][]) {
      if (name.endsWith(".xml")) continue;
      expect(html, `${name} annonce encore « Inscription gratuite »`).not.toContain("Inscription gratuite");
    }
    expect(SEO.fr.description).toContain(PRICING.monthly.display.fr);
  });

  // La coquille statique (lue par les crawlers) et la page React (lue par le
  // visiteur et par Googlebot après rendu) doivent dire la même chose du prix.
  it("le bloc d'appel à l'action dit la même chose dans la coquille statique et dans React", () => {
    const shell = indexHtml.match(/<p class="section-sub">(Laissez[^<]+)<\/p>/)?.[1];
    expect(shell).toBe(appText.fr.ctaCardSub);
    expect(shell).toContain(PRICING.monthly.display.fr);
  });

  it("l'Offer de chaque page porte les vrais montants, et ces montants sont visibles dans le texte", () => {
    const amounts = [PRICING.monthly.amount, PRICING.annual.amount];
    for (const [name, html] of [["index.html", indexHtml], ...files] as [string, string][]) {
      if (!html.includes('"SoftwareApplication"')) continue;
      const app = jsonLdBlocks(html.replace(/<script type="application\/ld\+json">\s*/g, '<script type="application/ld+json">'))
        .flatMap((b) => b["@graph"] ?? [b])
        .find((g: any) => g["@type"] === "SoftwareApplication");
      const offers = [app.offers].flat();
      expect(offers.map((o: any) => o.price).sort(), `${name} : offres inattendues`).toEqual([...amounts].sort());
      for (const offer of offers) {
        expect(offer.priceCurrency).toBe(PRICING.currency);
        expect(Number(offer.price), `${name} : un prix à 0 rouvrirait la promesse « gratuit »`).toBeGreaterThan(0);
      }
      // Ce que la page déclare à Google doit se lire sur la page.
      const visible = textOf(html);
      expect(visible, `${name} : le prix mensuel n'apparaît pas dans le texte visible`).toContain(PRICING.monthly.display.fr);
      expect(visible, `${name} : la durée d'essai n'apparaît pas dans le texte visible`).toContain(`${PRICING.trialDays} jours d'essai`);
    }
  });
});

describe("index.html (accueil)", () => {
  // La mémoire de la routine doit dire la vérité : le title de l'accueil y a
  // dérivé de deux versions parce qu'il y était recopié à la main.
  it("est décrit dans state.json tel qu'il est réellement servi (title, description, H1)", () => {
    const head = readHomeHead(indexHtml);
    const synced = syncState(pages, state, state.updated).pages["/"];
    expect(head.title).toBe(SEO.fr.title);
    expect(synced.title).toBe(head.title);
    expect(synced.description).toBe(head.description);
    expect(synced.h1).toBe(head.h1);
    expect(synced.indexable).toBe(true);
  });

  it("a un title et une description spécifiques (= homeContent), un canonical, Open Graph et JSON-LD", () => {
    expect(indexHtml).toContain(`<title>${SEO.fr.title}</title>`);
    expect(indexHtml).toContain(`<meta name="description" content="${SEO.fr.description}" />`);
    expect(SEO.fr.description.length).toBeGreaterThanOrEqual(80);
    expect(SEO.fr.description.length).toBeLessThanOrEqual(200);
    expect(indexHtml).toContain(`<link rel="canonical" href="${SITE_URL}/" />`);
    expect(indexHtml).toContain('property="og:title"');
    const blocks = jsonLdBlocks(indexHtml.replace(/<script type="application\/ld\+json">\s*/g, '<script type="application/ld+json">'));
    expect(blocks.length).toBe(1);
    const types = blocks[0]["@graph"].map((g: any) => g["@type"]);
    expect(types).toEqual(["Organization", "WebSite", "SoftwareApplication", "FAQPage"]);
    const faq = blocks[0]["@graph"].find((g: any) => g["@type"] === "FAQPage");
    expect(faq.mainEntity.map((q: any) => [q.name, q.acceptedAnswer.text])).toEqual(FAQ.fr.items.map((i) => [i.q, i.a]));
  });

  it("expose la landing en HTML statique identique aux textes React (un seul H1, définition, FAQ visible, liens vers chaque guide)", () => {
    expect(count(indexHtml, /<h1[\s>]/g)).toBe(1);
    const visible = textOf(indexHtml).replace(/&amp;/g, "&");
    expect(visible).toContain("planificateur de voyage IA");
    expect(visible).toContain(EYEBROW.fr);
    expect(visible).toContain(ABOUT.fr.title);
    for (const paragraph of ABOUT.fr.paragraphs) expect(visible).toContain(paragraph);
    for (const item of FAQ.fr.items) {
      expect(visible).toContain(item.q);
      expect(visible).toContain(item.a);
    }
    for (const f of FEATURES) expect(visible).toContain(f.fr.title);
    for (const s of STEPS) expect(visible).toContain(s.fr.title);
    for (const p of pages) expect(indexHtml).toContain(`href="/${p.slug}"`);
    expect(indexHtml).toContain('id="connexion"');
  });
});

describe("seo/state.json (mémoire de la routine)", () => {
  it("est synchronisé avec les pages (npm run seo:sync) et couvre chaque intention", () => {
    const synced = syncState(pages, state, state.updated);
    for (const p of pages) {
      const url = `/${p.slug}`;
      expect(state.pages[url], `state.json : entrée manquante pour ${url}`).toBeDefined();
      expect(state.pages[url].title).toBe(p.title);
      expect(state.pages[url].h1).toBe(p.h1);
      expect(state.pages[url].intent).toBe(p.intent);
      expect(state.pages[url].lastOptimized).toBe(p.dateModified);
      expect(state.intents[p.intent]).toBe(url);
      expect(state.pages[url].linksTo).toEqual(synced.pages[url].linksTo);
      expect(state.pages[url].linkedFrom).toContain("/");
    }
    expect(state.pages["/"]).toBeDefined();
    expect(Array.isArray(state.history)).toBe(true);
    for (const p of pages) {
      expect(state.history.some((h: any) => h.url === `/${p.slug}` && h.action === "création"), `history : création de /${p.slug}`).toBe(true);
    }
    for (const h of state.history) {
      expect(h.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(h.url && h.action && h.justification).toBeTruthy();
    }
  });
});

describe("images de partage et poids des ressources", () => {
  // Une animation WebP ne s'affiche pas comme aperçu de partage : og:image doit
  // rester une image fixe 1200x630, et tout fichier référencé doit exister.
  const referenced = new Set<string>();
  for (const html of [indexHtml, ...files.values()]) {
    for (const m of html.matchAll(/(?:src|href|content|srcset|srcSet)="(\/[^"]+\.(?:png|jpe?g|webp|svg|gif))"/g)) referenced.add(m[1]);
    for (const m of html.matchAll(/content="https:\/\/www\.monpetitvoyageur\.com(\/[^"]+\.(?:png|jpe?g|webp|svg|gif))"/g)) referenced.add(m[1]);
  }

  it("server.mjs déclare un type MIME pour chaque extension servie (un AVIF en octet-stream ne s'affiche pas)", () => {
    const server = fs.readFileSync(path.join(webRoot, "server.mjs"), "utf8");
    const mime = server.slice(server.indexOf("const MIME"), server.indexOf("const COMPRESSIBLE"));
    for (const rel of referenced) {
      const ext = path.extname(rel);
      expect(mime, `server.mjs : type MIME manquant pour ${ext} (servi en application/octet-stream)`).toContain(`"${ext}"`);
    }
    expect(mime).toContain('".avif": "image/avif"');
  });

  // /mobile et /admin renvoient la coquille de l'accueil telle quelle : sans
  // en-tête explicite, un crawler qui ignore robots.txt indexerait l'accueil
  // en double sous ces chemins.
  it("server.mjs répond noindex sur les routes privées de l'app (/mobile, /admin)", () => {
    const server = fs.readFileSync(path.join(webRoot, "server.mjs"), "utf8");
    const prefixes = server.match(/const SPA_PREFIXES = \[([^\]]*)\]/)?.[1] ?? "";
    for (const route of APP_ROUTES) expect(prefixes).toContain(`"${route}"`);
    const branch = server.slice(server.indexOf("SPA_PREFIXES.some"), server.indexOf("// Real files"));
    expect(branch, "server.mjs : les routes privées doivent porter X-Robots-Tag: noindex").toContain('"X-Robots-Tag": "noindex, nofollow"');
  });

  it("ne référence que des fichiers présents dans public/", () => {
    expect(referenced.size).toBeGreaterThan(0);
    for (const rel of referenced) {
      expect(fs.existsSync(path.join(webRoot, "public", rel.replace(/^\//, ""))), `public${rel} manquant`).toBe(true);
    }
  });

  it("déclare une og:image fixe 1200x630 avec alt et twitter:image sur l'accueil et chaque guide", () => {
    for (const [name, html] of [["index.html", indexHtml] as const, ...[...files.entries()].filter(([n]) => n.endsWith(".html") && n !== "404.html")]) {
      const og = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
      expect(og, `${name} : og:image manquante`).toBe(`${SITE_URL}/og-image.jpg`);
      expect(html, `${name} : og:image:width`).toMatch(/<meta property="og:image:width" content="1200"/);
      expect(html, `${name} : og:image:height`).toMatch(/<meta property="og:image:height" content="630"/);
      expect(html, `${name} : og:image:alt`).toMatch(/<meta property="og:image:alt" content="[^"]{10,}"/);
      expect(html, `${name} : twitter:image`).toMatch(/<meta name="twitter:image" content="[^"]+og-image\.jpg"/);
    }
  });

  it("l'og:image fait bien 1200x630 et reste sous 300 Ko", () => {
    const file = path.join(webRoot, "public/og-image.jpg");
    const buf = fs.readFileSync(file);
    expect(buf.byteLength).toBeLessThan(300 * 1024);
    // Dimensions lues dans le marqueur SOF0/SOF2 du JPEG.
    let i = 2;
    let size: [number, number] | null = null;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        size = [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
        break;
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    expect(size).toEqual([1200, 630]);
  });

  it("sert l'animation en AVIF (même rendu, quatre fois plus léger) avec la WebP en repli", () => {
    // L'ordre des <source> compte : mouvement réduit d'abord, puis AVIF, la WebP restant le <img> de repli.
    const picture = indexHtml.match(/<picture>[\s\S]*?<\/picture>/)![0];
    const order = [...picture.matchAll(/<(source|img)[^>]*(?:srcset|src)="([^"]+)"/g)].map((m) => m[2]);
    expect(order).toEqual(["/logo-hero.avif", "/logo-hero.webp"]);
    expect(picture).toMatch(/<source srcset="\/logo-hero\.avif" type="image\/avif"/);
    expect(indexHtml).toMatch(/rel="preload"[^>]+logo-hero\.avif[^>]+type="image\/avif"/);
    // L'animation doit rester servie à tout le monde : aucun repli qui la remplace par une image fixe.
    expect(picture).not.toMatch(/prefers-reduced-motion/);
    const avif = fs.statSync(path.join(webRoot, "public/logo-hero.avif")).size;
    const webp = fs.statSync(path.join(webRoot, "public/logo-hero.webp")).size;
    expect(avif).toBeLessThan(700 * 1024);
    expect(avif).toBeLessThan(webp / 2);
  });

  it("garde les ressources de marque sous leur budget de poids", () => {
    const logo = fs.statSync(path.join(webRoot, "public/logo.png")).size;
    expect(logo).toBeLessThan(100 * 1024);
    expect(fs.existsSync(path.join(webRoot, "public/logo-hero-static.webp"))).toBe(false);
  });
});
