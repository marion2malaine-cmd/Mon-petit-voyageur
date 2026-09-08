// Per-view <head> updates for the single-page app. index.html ships the
// crawler-facing defaults (title, description, canonical, JSON-LD); this only
// adjusts them when the visitor moves to a legal page, an app-only route
// (/mobile, /admin) or an unknown path, so those never get indexed as the home.
import { SEO, SITE_URL, type HomeLocale } from "./homeContent";

export interface SeoState {
  title: string;
  description?: string;
  /** Absolute canonical URL. */
  canonical?: string;
  /** true → <meta name="robots" content="noindex, nofollow">. */
  noindex?: boolean;
  lang?: HomeLocale;
}

function setMeta(selector: string, attrs: Record<string, string>, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function applySeo(state: SeoState) {
  document.title = state.title;
  if (state.lang) document.documentElement.lang = state.lang;
  if (state.description) {
    setMeta('meta[name="description"]', { name: "description" }, state.description);
    setMeta('meta[property="og:description"]', { property: "og:description" }, state.description);
  }
  setMeta('meta[property="og:title"]', { property: "og:title" }, state.title);
  if (state.canonical) {
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = state.canonical;
    setMeta('meta[property="og:url"]', { property: "og:url" }, state.canonical);
  }
  setMeta('meta[name="robots"]', { name: "robots" }, state.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
}

/** Public routes the SPA really serves; anything else is a soft 404 that must
 *  not be indexed (the static host answers 200 for every path). */
export const PUBLIC_PATHS = ["/", "/mobile", "/admin"] as const;

export function isKnownPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => (p === "/" ? pathname === "/" || pathname === "/index.html" : pathname.startsWith(p)));
}

export function homeSeo(locale: HomeLocale): SeoState {
  return { title: SEO[locale].title, description: SEO[locale].description, canonical: `${SITE_URL}/`, lang: locale };
}

export function legalSeo(locale: HomeLocale, key: string, docTitle: string): SeoState {
  const brand = locale === "fr" ? "Mon Petit Voyageur" : "My Little Traveler";
  return { title: `${docTitle} · ${brand}`, canonical: `${SITE_URL}/?legal=${key}`, lang: locale };
}

export function appOnlySeo(title: string): SeoState {
  return { title, noindex: true };
}

export function notFoundSeo(locale: HomeLocale): SeoState {
  return { title: locale === "fr" ? "Page introuvable · Mon Petit Voyageur" : "Page not found · My Little Traveler", noindex: true, lang: locale };
}
