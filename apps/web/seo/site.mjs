// Shared SEO configuration and HTML layout for the static, crawlable pages of
// www.monpetitvoyageur.com. Everything here is deterministic: no network, no
// dates computed at build time (dates live in state.json / the page modules).

export const SITE_URL = "https://www.monpetitvoyageur.com";
export const SITE_NAME = "Mon Petit Voyageur";
export const CONTACT_EMAIL = "contact@monpetitvoyageur.fr";

// Legal identity as displayed in the app's legal pages (apps/web/src/legalContent.ts).
export const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  legalName: "MARA LABS",
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/logo.png`,
  email: CONTACT_EMAIL,
  address: {
    "@type": "PostalAddress",
    streetAddress: "41 rue Jacquemars Giélée",
    postalCode: "59800",
    addressLocality: "Lille",
    addressCountry: "FR"
  }
};

export const WEBSITE = {
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: `${SITE_URL}/`,
  name: SITE_NAME,
  inLanguage: "fr-FR",
  publisher: { "@id": `${SITE_URL}/#organization` }
};

// Only what the product really does today (README + apps/web/src/App.tsx).
export const SOFTWARE = {
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#app`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  applicationCategory: "TravelApplication",
  operatingSystem: "Web",
  inLanguage: ["fr", "en"],
  description:
    "Planificateur de voyage assisté par intelligence artificielle : à partir de votre budget, de votre style et de vos dates, Mon Petit Voyageur propose une destination, compare les vols et hébergements, construit un itinéraire jour par jour (visites, activités, restaurants) et produit un guide illustré téléchargeable.",
  featureList: [
    "Suggestion de destination selon budget, style et période",
    "Comparaison de vols et d'hébergements avec liens de réservation pré-remplis",
    "Itinéraire jour par jour avec activités, restaurants et plan B météo",
    "Road trip par étapes avec hôtel chaque nuit et temps de route",
    "Guide illustré téléchargeable et imprimable"
  ],
  // Stripe est configuré en production depuis le 2026-09-10 : l'accès est
  // réservé aux comptes en essai ou abonnés. Ces prix doivent rester ceux du
  // paywall (src/appTranslations.ts) et rester visibles dans le texte des
  // pages — un test compare les deux.
  offers: [
    { "@type": "Offer", name: "Abonnement mensuel", price: "5.99", priceCurrency: "EUR", description: "5,99 € par mois après 7 jours d'essai gratuit, sans engagement", availability: "https://schema.org/InStock", url: `${SITE_URL}/#connexion` },
    { "@type": "Offer", name: "Abonnement annuel", price: "49", priceCurrency: "EUR", description: "49 € par an après 7 jours d'essai gratuit, sans engagement", availability: "https://schema.org/InStock", url: `${SITE_URL}/#connexion` }
  ],
  provider: { "@id": `${SITE_URL}/#organization` }
};

// Internal URLs a page is allowed to link to (besides the pages themselves).
export const APP_ANCHORS = ["/", "/#connexion", "/#how", "/?legal=privacy", "/?legal=terms", "/?legal=sales"];

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function jsonLd(objects) {
  const graph = { "@context": "https://schema.org", "@graph": objects };
  // "</script>" inside JSON would close the tag: escape it.
  return `<script type="application/ld+json">${JSON.stringify(graph).replace(/<\//g, "<\\/")}</script>`;
}

export function breadcrumb(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

/** HowTo derived from a numbered method visible in the page body (step names must appear in the HTML). */
export function howToSchema(page, url) {
  return {
    "@type": "HowTo",
    "@id": `${url}#howto`,
    name: page.howTo.name,
    description: page.howTo.description,
    inLanguage: "fr-FR",
    step: page.howTo.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text, url: `${url}#etape-${i + 1}` }))
  };
}

export function faqSchema(faq) {
  return {
    "@type": "FAQPage",
    mainEntity: faq.map((entry) => ({
      "@type": "Question",
      name: entry.q,
      acceptedAnswer: { "@type": "Answer", text: entry.a }
    }))
  };
}

// Same identity as the app (styles.css "Riviera"): deep blue, cream, terracotta,
// DM Sans + Instrument Serif. Kept inline so each page is self-contained.
export const PAGE_CSS = `
:root{--bg:#f4f5f2;--fg:#123248;--primary:#0b526b;--primary-dark:#073c50;--pale:#e3eff1;--muted:#60727b;--card:#fffefa;--border:#d8ddd9;--terracotta:#c9694f;--sand:#d7b888;--deep:#09394d;--sans:"DM Sans",ui-sans-serif,system-ui,sans-serif;--display:"Instrument Serif",Georgia,serif}
*{box-sizing:border-box}
body{margin:0;font-family:var(--sans);color:var(--fg);background:var(--bg);font-size:17px;line-height:1.6}
a{color:var(--primary)}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:86px;padding:1rem max(1.2rem,calc((100vw - 1200px)/2));background:var(--deep);color:#fff}
.topbar img{height:44px;width:auto;display:block}
.topbar nav{display:flex;flex-wrap:wrap;gap:.3rem 1.1rem;font-size:.92rem}
.topbar nav a{color:#d7e4e6;text-decoration:none}
.topbar nav a:hover,.topbar nav a[aria-current]{color:#fff;text-decoration:underline}
.hero{padding:3.6rem max(1.2rem,calc((100vw - 1200px)/2)) 3rem;color:#fff;background:radial-gradient(circle at 82% 25%,rgba(215,184,136,.28),transparent 18rem),linear-gradient(135deg,#07364a,#0b6079)}
.hero .crumbs{font-size:.85rem;color:#b8cbd1;margin:0 0 1.2rem}
.hero .crumbs a{color:#d7e4e6}
.hero h1{font-family:var(--display);font-weight:400;font-size:clamp(2.2rem,5vw,3.6rem);letter-spacing:-.03em;line-height:1.08;margin:0 0 1rem;max-width:22ch}
.hero .lead{font-size:1.15rem;color:#d7e4e6;max-width:64ch;margin:0}
.hero .meta{font-size:.82rem;color:#b8cbd1;margin:1.2rem 0 0}
main{max-width:860px;margin:0 auto;padding:2.4rem 1.2rem 3rem}
main h2{font-family:var(--display);font-weight:400;font-size:1.9rem;letter-spacing:-.02em;margin:2.2rem 0 .7rem;color:var(--deep)}
main h3{font-size:1.1rem;margin:1.5rem 0 .4rem}
main p,main li{max-width:70ch}
main ul,main ol{padding-left:1.3rem}
main li{margin:.3rem 0}
.summary{background:var(--card);border:1px solid var(--border);border-left:4px solid var(--terracotta);border-radius:14px;padding:1rem 1.2rem;margin:0 0 1.5rem}
.summary p{margin:0}
table{border-collapse:collapse;width:100%;margin:1rem 0 1.4rem;font-size:.95rem;background:var(--card)}
th,td{border:1px solid var(--border);padding:.6rem .7rem;text-align:left;vertical-align:top}
th{background:var(--pale);font-weight:600}
.table-wrap{overflow-x:auto}
.faq details{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:.7rem 1rem;margin:.6rem 0}
.faq summary{cursor:pointer;font-weight:600}
.faq details p{margin:.6rem 0 .2rem}
.cta{margin:2.4rem 0 0;padding:1.6rem;border-radius:18px;background:var(--deep);color:#fff}
.cta h2{color:#fff;margin-top:0}
.cta p{color:#d7e4e6}
.button{display:inline-block;padding:.85rem 1.4rem;border-radius:999px;background:var(--terracotta);color:#fff;font-weight:600;text-decoration:none}
.button:hover{background:#b35a42}
.related{margin-top:2.4rem;padding-top:1.4rem;border-top:1px solid var(--border)}
.related ul{list-style:none;padding:0;display:grid;gap:.6rem}
.related a{display:block;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:.8rem 1rem;text-decoration:none;color:var(--fg)}
.related a:hover{border-color:var(--primary)}
.related small{display:block;color:var(--muted)}
footer{background:#fbf9f7;border-top:1px solid var(--border);padding:2.2rem max(1.2rem,calc((100vw - 1200px)/2)) 1.4rem;font-size:.92rem;color:var(--muted)}
footer .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.6rem;max-width:1200px;margin:0 auto 1.4rem}
footer strong{display:block;color:var(--fg);margin-bottom:.5rem}
footer a{color:var(--muted);text-decoration:none}
footer a:hover{color:var(--primary-dark);text-decoration:underline}
footer p{margin:.25rem 0}
@media (max-width:640px){.topbar{flex-direction:column;align-items:flex-start}.hero{padding-top:2.4rem;padding-bottom:2.2rem}}
`;

/**
 * Wraps a page module into a full HTML document.
 * @param page  { slug, title, description, h1, lead, body, faq, related, datePublished, dateModified, schemaType, cluster, intent }
 * @param allPages  every page module (used for the header navigation)
 */
export function renderPage(page, allPages) {
  const url = `${SITE_URL}/${page.slug}`;
  const nav = allPages
    .map((p) => `<a href="/${p.slug}"${p.slug === page.slug ? ' aria-current="page"' : ""}>${escapeHtml(p.navLabel)}</a>`)
    .join("");

  const faqHtml = page.faq?.length
    ? `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">Questions fréquentes</h2>${page.faq
        .map((f) => `<details><summary>${escapeHtml(f.q)}</summary><p>${escapeHtml(f.a)}</p></details>`)
        .join("")}</section>`
    : "";

  const relatedHtml = page.related?.length
    ? `<nav class="related" aria-labelledby="related-title"><h2 id="related-title">À lire aussi</h2><ul>${page.related
        .map((r) => {
          const target = allPages.find((p) => p.slug === r);
          if (!target) throw new Error(`Page ${page.slug}: related slug inconnu "${r}"`);
          return `<li><a href="/${target.slug}">${escapeHtml(target.navLabel)}<small>${escapeHtml(target.description)}</small></a></li>`;
        })
        .join("")}</ul></nav>`
    : "";

  const mainSchema =
    page.schemaType === "Article"
      ? {
          "@type": "Article",
          "@id": `${url}#article`,
          headline: page.h1,
          description: page.description,
          inLanguage: "fr-FR",
          datePublished: page.datePublished,
          dateModified: page.dateModified,
          author: { "@id": `${SITE_URL}/#organization` },
          publisher: { "@id": `${SITE_URL}/#organization` },
          mainEntityOfPage: url,
          image: `${SITE_URL}/og-image.jpg`,
          isPartOf: { "@id": `${SITE_URL}/#website` },
          about: { "@id": `${SITE_URL}/#app` },
          keywords: page.secondaryKeywords?.join(", ")
        }
      : {
          "@type": "WebPage",
          "@id": url,
          url,
          name: page.title,
          description: page.description,
          inLanguage: "fr-FR",
          datePublished: page.datePublished,
          dateModified: page.dateModified,
          isPartOf: { "@id": `${SITE_URL}/#website` },
          about: { "@id": `${SITE_URL}/#app` }
        };

  const graph = [ORGANIZATION, WEBSITE, SOFTWARE, mainSchema, breadcrumb([{ name: "Accueil", url: `${SITE_URL}/` }, { name: page.navLabel, url }])];
  if (page.howTo) graph.push(howToSchema(page, url));
  if (page.faq?.length) graph.push(faqSchema(page.faq));

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)}</title>
<meta name="description" content="${escapeHtml(page.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#123746">
<link rel="icon" type="image/png" href="/favicon.png">
<meta property="og:type" content="${page.schemaType === "Article" ? "article" : "website"}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${escapeHtml(page.title)}">
<meta property="og:description" content="${escapeHtml(page.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE_URL}/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Mon Petit Voyageur — voyages sur mesure, orchestrés par l'IA">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE_URL}/og-image.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap">
<style>${PAGE_CSS}</style>
${jsonLd(graph)}
</head>
<body>
<header class="topbar">
<a href="/" aria-label="${SITE_NAME} — accueil"><img src="/logo.png" alt="${SITE_NAME}" width="66" height="44"></a>
<nav aria-label="Guides">${nav}</nav>
</header>
<section class="hero">
<p class="crumbs"><a href="/">Accueil</a> › ${escapeHtml(page.navLabel)}</p>
<h1>${escapeHtml(page.h1)}</h1>
<p class="lead">${escapeHtml(page.lead)}</p>
<p class="meta">Publié le ${formatDate(page.datePublished)}${page.dateModified !== page.datePublished ? ` · mis à jour le ${formatDate(page.dateModified)}` : ""} · ${SITE_NAME}</p>
</section>
<main>
${page.body}
${faqHtml}
<aside class="cta">
<h2>${escapeHtml(page.ctaTitle ?? "Créez votre voyage avec Mon Petit Voyageur")}</h2>
<p>${escapeHtml(page.ctaText ?? "Répondez au questionnaire, l'IA construit l'itinéraire, vous réservez avec les liens fournis. 7 jours d'essai gratuit, puis 5,99 € par mois ou 49 € par an, sans engagement.")}</p>
<a class="button" href="/#connexion">Commencer mon voyage</a>
</aside>
${relatedHtml}
</main>
<footer>
<div class="grid">
<div><strong>${SITE_NAME}</strong><p>Planificateur de voyage assisté par IA, édité par MARA LABS à Lille.</p></div>
<div><strong>Guides</strong>${allPages.map((p) => `<p><a href="/${p.slug}">${escapeHtml(p.navLabel)}</a></p>`).join("")}</div>
<div><strong>Liens utiles</strong><p><a href="/#connexion">Créer mon voyage</a></p><p><a href="/?legal=privacy">Politique de confidentialité</a></p><p><a href="/?legal=terms">Conditions d'utilisation</a></p><p><a href="/?legal=sales">Conditions générales de vente</a></p></div>
<div><strong>Contact</strong><p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p></div>
</div>
<p>© 2026 ${SITE_NAME}. Tous droits réservés.</p>
</footer>
</body>
</html>
`;
}

export function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${d} ${months[m - 1]} ${y}`;
}
