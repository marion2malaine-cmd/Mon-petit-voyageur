import type { Photo } from "@mlt/contracts";
import type { AppConfig } from "../config";

// Wikimedia asks every API client to identify itself.
const USER_AGENT = "MonPetitVoyageur/1.0 (https://github.com/mon-petit-voyageur; guide generator)";
// An image source that has not answered in four seconds will not save the
// guide: every query walks several sources, so a generous timeout multiplies
// into half a minute of waiting for one card. The next source is tried instead.
const TIMEOUT_MS = 4000;

// A ten-day guide needs well over a hundred illustrations, and each one is a
// couple of round-trips to Wikipedia, Openverse or Pexels. At four at a time
// that was two minutes of the plan spent waiting on images; twelve keeps every
// source comfortably inside its rate limits and turns those minutes into
// seconds.
const MAX_PARALLEL = Number(process.env.PHOTO_MAX_PARALLEL ?? 12);



// Words that carry no meaning when matching a place name against an article
// title, plus the generic travel vocabulary the LLM adds to its queries.
const STOPWORDS = new Set([
  "de", "du", "des", "la", "le", "les", "l", "un", "une", "et", "a", "au", "aux", "en", "d", "the", "of", "in",
  "and", "at", "to", "sur", "dans", "pres", "near", "old", "vieux", "vieille", "view", "vue", "photo", "food",
  "restaurant", "cuisine", "taverne", "tavern", "plat", "dish", "visite", "visit", "tour", "traditional",
  "traditionnel", "traditionnelle", "site", "ville", "city", "town", "village",
  // Category words: they describe what a place is, never which one it is. Kept
  // out of scoring so the proper noun decides the match — otherwise the museum
  // of Heraklion outranks Phaistos on the word "archéologique".
  "palais", "palace", "musee", "museum", "eglise", "church", "cathedrale", "cathedral", "monastere", "monastery",
  "chateau", "castle", "forteresse", "fortress", "fort", "plage", "beach", "grotte", "cave", "gorges", "gorge",
  "plateau", "port", "harbour", "harbor", "marche", "market", "jardin", "garden", "parc", "park", "place",
  "square", "rue", "street", "quartier", "district", "archeologique", "archaeological", "archeologie",
  "archaeology", "ruines", "ruins", "belvedere", "viewpoint", "panorama", "panoramique", "lac", "lake",
  "montagne", "mountain", "sentier", "trail", "cascade", "waterfall", "pont", "bridge", "tour",
  // Day titles are sentences ("Journée famille : nature et animaux"): their
  // calendar and party words describe the trip, never the place.
  "journee", "journees", "jour", "jours", "day", "days", "excursion", "excursions", "famille", "family",
  "matin", "morning", "soir", "evening", "autour", "around"
]);

// A .png or .svg on Commons is usually a diagram, a plan or a coat of arms,
// never the photograph a travel guide needs.
const NON_PHOTO_PATTERN = /(plan|planol|carte|map|schema|schéma|diagram|logo|flag|drapeau|blason|coat.of.arms|seal|icon|chart|graph|timeline)/i;

// A guide is regenerated often with overlapping places: resolving the same
// query twice per process is pure latency.
const cache = new Map<string, Photo>();

export interface PhotoContext {
  config: AppConfig;
  locale: "fr" | "en";
  /**
   * The trip destination, which appears in every query. Knowing it is what
   * keeps a generic "Crete" island photo from winning over the article about
   * the specific palace the query is really about.
   */
  destination?: string | null;
}

/**
 * Resolves an image search query to a real, credited photo.
 *
 * The LLM only ever proposes `query`; URLs come from here. Sources are tried
 * from the most topically precise (a Wikipedia article about the exact place)
 * to the most generic, and a failure returns a photo with a null url so the
 * guide renders an elegant placeholder instead of a broken image.
 */
export async function findPhoto(ctx: PhotoContext, query: string): Promise<Photo> {
  const normalized = query.trim();
  // Tests are hermetic: never reach out to Wikipedia/Commons/Openverse.
  if (!normalized || process.env.NODE_ENV === "test") {
    return emptyPhoto(query);
  }

  const cacheKey = `${ctx.locale}:${normalized.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Named places live in encyclopedias; food and atmosphere shots do not, so
  // photo libraries are tried first for those.
  const isGenericSubject = /(food|cuisine|restaurant|taverne|tavern|dish|plat|gastronom|market stall|street food)/i.test(
    normalized
  );

  // The title guard is applied to every subject. Relaxing it for dishes and
  // restaurants let a full-text hit on any word ("Ant-Man premiere" for a fish
  // restaurant) illustrate the card; a blank beats a stranger's portrait.
  const destinationTokens = new Set(meaningfulTokens(ctx.destination ?? ""));
  // Encyclopedic search wants every word present: "Balos lagoon beach Crete
  // family" finds nothing while "Balos Crète" finds the lagoon. When the full
  // query fails, the proper nouns alone are searched.
  const simplified = properNounQuery(normalized, ctx.destination ?? "", destinationTokens);
  const encyclopedic = [
    () => fromWikipedia(normalized, ctx.locale, true, destinationTokens),
    () => fromWikimediaCommons(normalized, true, destinationTokens),
    ...(simplified
      ? [
          () => fromWikipedia(simplified, ctx.locale, true, destinationTokens),
          () => fromWikimediaCommons(simplified, true, destinationTokens)
        ]
      : [])
  ];
  const libraries = [
    () => fromOpenverse(normalized),
    () => fromUnsplash(normalized, ctx.config.UNSPLASH_ACCESS_KEY),
    () => fromPexels(normalized, ctx.config.PEXELS_API_KEY)
  ];

  // Sources are tried in order of what they are good at, and the first image
  // that really renders wins. Asking the two families at once was measured and
  // rejected: it doubles the load on Wikipedia and Openverse, which answer
  // slower under it, and every card ended up waiting longer.
  const preferred = await firstWorking(isGenericSubject ? [...libraries, ...encyclopedic] : [...encyclopedic, ...libraries]);


  // The simplified query may have found it; the card still describes what was
  // asked for.
  const found = preferred ? { ...preferred, query: normalized } : emptyPhoto(normalized);

  cache.set(cacheKey, found);
  return found;
}

/**
 * The first source of a family that answers with an image that really renders.
 *
 * Sources inside a family stay in order — the full query before the simplified
 * one — because they are the same family's decreasing degrees of certainty.
 */
async function firstWorking(resolvers: (() => Promise<Photo | null>)[]): Promise<Photo | null> {
  for (const resolve of resolvers) {
    try {
      const photo = await resolve();
      // A resolver can return a URL that does not actually render: Wikimedia
      // refuses to thumbnail an image wider than its source or too large to
      // process, and answers 400. Validating here means a broken image never
      // reaches the page or the guide — the next source is tried instead.
      if (photo?.url && (await imageWorks(scalePhoto(photo, MAX_USABLE_WIDTH).url!))) return photo;
    } catch {
      // Never let an image lookup break a trip plan.
    }
  }
  return null;
}


// The widest a card ever displays; validation uses it so the exact URL the
// page will request is the one that gets checked.
const MAX_USABLE_WIDTH = 1200;

/** Confirms a URL returns a real image, so a 400/404 never becomes a broken tag. */
async function imageWorks(url: string): Promise<boolean> {
  if (!url || url.startsWith("data:")) return true;
  try {
    const response = await fetchWithTimeout(url, { method: "HEAD", headers: { "User-Agent": USER_AGENT } });
    return response.ok && (response.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

/**
 * Resolves many queries with a bounded number of concurrent requests.
 *
 * The workers pull from a shared queue rather than advancing in fixed batches:
 * a batch waited for its slowest image before starting the next one, so a
 * single ten-second lookup idled eleven workers, and a hundred illustrations
 * took nearly two minutes instead of the sum of their own times.
 */
export async function findPhotos(ctx: PhotoContext, queries: string[]): Promise<Map<string, Photo>> {
  const unique = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
  const results = new Map<string, Photo>();

  let next = 0;
  const worker = async () => {
    for (let index = next++; index < unique.length; index = next++) {
      const query = unique[index];
      results.set(query, await findPhoto(ctx, query));
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL, unique.length) }, worker));


  return results;
}

/**
 * Inlines a photo as a data URI so a downloaded guide still shows its images
 * offline, on a plane or abroad without data. Oversized files are left as
 * remote URLs rather than bloating the document.
 */
export async function embedPhoto(photo: Photo, maxBytes = 400_000): Promise<Photo> {
  if (!photo.url || photo.url.startsWith("data:")) {
    return photo;
  }

  try {
    const response = await fetchWithTimeout(photo.url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) return photo;

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return photo;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) return photo;

    const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`;
    return { ...photo, url: dataUri, thumb_url: dataUri };
  } catch {
    return photo;
  }
}

/**
 * Rewrites a photo to the width it is actually displayed at.
 *
 * A guide embeds well over a hundred images; serving a 1200px file into a
 * 210px card is what turned the document into tens of megabytes. Wikimedia
 * thumbnail URLs carry their width, so a smaller variant is one substitution
 * away; other sources fall back to whatever thumbnail they exposed.
 */
export function scalePhoto(photo: Photo, width: number): Photo {
  if (!photo.url || photo.url.startsWith("data:")) return photo;

  // Wikimedia thumbnails are served only at the widths its API handed out:
  // rewriting "1280px-" to "1200px-" or "520px-" answers 400 on both
  // upload.wikimedia.org and thumb.wikimedia.org, which silently discarded
  // every Commons photo. Those URLs are therefore kept exactly as received.
  if (/\/\/(upload|thumb)\.wikimedia\.org\//.test(photo.url)) return photo;

  // Other sources: their own preview is the smaller option.
  if (width <= 600 && photo.thumb_url && photo.thumb_url !== photo.url) {
    return { ...photo, url: photo.thumb_url };
  }

  return photo;
}

export function resetPhotoCache(): void {
  cache.clear();
  openverseFailures = 0;
}

function emptyPhoto(query: string): Photo {
  return { query, url: null, thumb_url: null, credit: null, source_url: null, license: null };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Wikimedia throttles bursts with 429 and says how long to wait; a short
// pause and one more attempt turn most of those into answers.
const RETRY_DELAYS_MS = [1000, 2000];

async function fetchJson(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = TIMEOUT_MS
): Promise<any | null> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetchWithTimeout(url, { headers: { "User-Agent": USER_AGENT, ...headers } }, timeoutMs);
    if (response.status === 429 && attempt < RETRY_DELAYS_MS.length) {
      const retryAfter = Number(response.headers.get("retry-after")) * 1000;
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter || RETRY_DELAYS_MS[attempt], 3000)));
      continue;
    }
    if (!response.ok) return null;
    return response.json();
  }
}

// The lead image of the Wikipedia article about the place: by far the most
// reliable way to illustrate a named monument, town or site — provided the
// article really is about that place. Full-text search happily returns an
// article about naval history for a query about a flea market, so the title
// has to be checked against the query before the image is accepted.
async function fromWikipedia(
  query: string,
  locale: "fr" | "en",
  strict: boolean,
  destinationTokens: Set<string>
): Promise<Photo | null> {
  const languages = locale === "fr" ? ["fr", "en"] : ["en"];

  for (const language of languages) {
    const titles = rankCandidates(query, await searchWikipediaTitles(language, query), destinationTokens)
      .filter((title) => !strict || isRelevant(query, title, destinationTokens))
      .slice(0, MAX_WIKIPEDIA_CANDIDATES);
    if (!titles.length) continue;

    // One request for every candidate: a guide resolves dozens of places and
    // Wikimedia answers 429 well before a call per title gets through.
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      titles: titles.join("|"),
      redirects: "1",
      prop: "pageimages|info",
      piprop: "original|thumbnail",
      pithumbsize: "1200",
      inprop: "url"
    });

    const data = await fetchJson(`https://${language}.wikipedia.org/w/api.php?${params}`);
    const pages: any[] = data?.query?.pages ?? [];
    // Back in ranked order: the API returns pages in its own.
    const byTitle = new Map(pages.map((page) => [String(page.title ?? "").toLowerCase(), page]));
    const ordered = [
      ...titles.map((title) => byTitle.get(title.toLowerCase())).filter(Boolean),
      ...pages.filter((page) => !titles.some((title) => title.toLowerCase() === String(page.title ?? "").toLowerCase()))
    ];

    for (const page of ordered) {
      // The 1200px thumbnail is preferred over the original: full-size
      // Wikimedia files often weigh several megabytes each, and the guide
      // embeds a hundred of them.
      const url = page?.thumbnail?.source ?? page?.original?.source;
      if (!url || NON_PHOTO_PATTERN.test(url)) continue;
      // Same rule as Commons: a lead image that is a .png or .svg is a montage,
      // a plan or an emblem, not the photograph the guide needs.
      if (/\.(svg|png|gif|tiff?)(\?|$)/i.test(url)) continue;

      return {
        query,
        url,
        thumb_url: page.thumbnail?.source ?? url,
        credit: `Wikipedia — ${page.title}`,
        source_url: page.fullurl ?? `https://${language}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
        license: "CC BY-SA / domaine public (voir la page source)"
      };
    }
  }

  return null;
}

const MAX_WIKIPEDIA_CANDIDATES = 5;

/**
 * Candidate article titles, best first.
 *
 * opensearch matches title prefixes, which is the most precise hit when the
 * query is exactly a place name, but it finds nothing for "Plage d'Elafonissi
 * Crète". Full-text search catches those; the relevance guard then rejects the
 * loose matches full-text search is prone to.
 */
async function searchWikipediaTitles(language: string, query: string): Promise<string[]> {
  const titles: string[] = [];

  const openSearchParams = new URLSearchParams({
    action: "opensearch",
    format: "json",
    search: query,
    limit: "5",
    namespace: "0"
  });
  const openSearch = await fetchJson(`https://${language}.wikipedia.org/w/api.php?${openSearchParams}`);
  if (Array.isArray(openSearch?.[1])) titles.push(...(openSearch[1] as string[]));

  const fullTextParams = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    list: "search",
    srsearch: query,
    srlimit: "5",
    srnamespace: "0"
  });
  const fullText = await fetchJson(`https://${language}.wikipedia.org/w/api.php?${fullTextParams}`);
  for (const hit of fullText?.query?.search ?? []) {
    if (hit?.title) titles.push(hit.title);
  }

  return [...new Set(titles)];
}

// Commons has far more photos than Wikipedia articles, useful for places
// without their own article (a beach, a village square, a market).
async function fromWikimediaCommons(
  query: string,
  strict: boolean,
  destinationTokens: Set<string>
): Promise<Photo | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "10",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1200"
  });

  const data = await fetchJson(`https://commons.wikimedia.org/w/api.php?${params}`);
  const pages: any[] = (data?.query?.pages ?? []).slice().sort(
    (left: any, right: any) =>
      scoreCandidate(query, String(right.title ?? ""), destinationTokens) -
      scoreCandidate(query, String(left.title ?? ""), destinationTokens)
  );

  for (const page of pages) {
    const info = page?.imageinfo?.[0];
    const url = info?.thumburl ?? info?.url;
    const title = String(page.title ?? "").replace(/^File:/i, "");
    if (!url) continue;
    // Diagrams, plans and coats of arms pollute Commons search results, and a
    // file whose name shares nothing with the query is not that place.
    if (/\.(svg|png|gif|tif|tiff)$/i.test(info.url ?? url)) continue;
    if (NON_PHOTO_PATTERN.test(title)) continue;
    if (strict && !isRelevant(query, title, destinationTokens)) continue;

    const metadata = info.extmetadata ?? {};
    return {
      query,
      url,
      thumb_url: info.thumburl ?? url,
      credit: stripHtml(metadata.Artist?.value) ?? "Wikimedia Commons",
      source_url: info.descriptionurl ?? null,
      license: stripHtml(metadata.LicenseShortName?.value) ?? "Wikimedia Commons"
    };
  }

  return null;
}

/**
 * Accepts a candidate only when its title shares a meaningful word with the
 * query. This is what stops an unrelated article from sneaking into the guide.
 */
function isRelevant(query: string, candidateTitle: string, destinationTokens: Set<string>): boolean {
  const titleTokens = meaningfulTokens(candidateTitle);
  const matches = (token: string) => titleTokens.some((other) => tokensMatch(token, other));

  // The LLM writes queries like "Knossos palais fresques reconstitution" or
  // "Chania Venetian harbor": the capitalised words name the place, the rest
  // describes the shot and never appears in an article or file title. So the
  // proper nouns decide — every one after the first word must match (the
  // first may just be a sentence start), and at least one must match overall.
  // "Siege of Chania" fails "Chania Venetian harbor" on "Venetian".
  const proper: { token: string; first: boolean }[] = [];
  query.split(/\s+/).forEach((word, index) => {
    if (!/^\p{Lu}/u.test(word)) return;
    for (const token of meaningfulTokens(word)) {
      if (!destinationTokens.has(token)) proper.push({ token, first: index === 0 });
    }
  });
  if (proper.length) {
    return proper.some((entry) => matches(entry.token)) && proper.filter((entry) => !entry.first).every((entry) => matches(entry.token));
  }

  // No proper noun ("meze plate Crete", "beach coast Crete"): any distinctive
  // word will do, and a query reduced to the destination can only match the
  // region itself.
  const distinctive = [...new Set(meaningfulTokens(query).filter((token) => !destinationTokens.has(token)))];
  if (!distinctive.length) return scoreCandidate(query, candidateTitle, destinationTokens) > 0;
  return distinctive.some(matches);
}

/**
 * The query reduced to its capitalised words plus the destination's last
 * segment ("Héraklion, Crète" → "Crète"), or null when that would change
 * nothing or leave no place name at all.
 */
function properNounQuery(query: string, destination: string, destinationTokens: Set<string>): string | null {
  const words = query.split(/\s+/).filter((word) => /^\p{Lu}/u.test(word));
  const named = words.flatMap(meaningfulTokens).filter((token) => !destinationTokens.has(token));
  if (!named.length) return null;

  const region = destination.split(",").map((part) => part.trim()).filter(Boolean).pop() ?? "";
  const regionTokens = meaningfulTokens(region);
  const present = new Set(words.flatMap(meaningfulTokens));
  const parts = regionTokens.length && !regionTokens.every((token) => present.has(token)) ? [...words, region] : words;

  const simplified = parts.join(" ");
  return simplified.toLowerCase() === query.toLowerCase() ? null : simplified;
}

// Place names survive translation and declension imperfectly, so a prefix
// match on 5 characters counts (Réthymnon matches Rethymno).
function tokensMatch(token: string, other: string): boolean {
  return (
    token === other ||
    (token.length >= 5 && (other.startsWith(token.slice(0, 5)) || token.startsWith(other.slice(0, 5))))
  );
}

/** Orders candidates by how specifically they match the query, best first. */
function rankCandidates(query: string, candidates: string[], destinationTokens: Set<string>): string[] {
  return candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(query, candidate, destinationTokens) }))
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.candidate);
}

/**
 * Scores a candidate title against the query.
 *
 * Matching the destination barely counts — it is in every query of the guide —
 * whereas matching a distinctive word (the palace, the gorge, the village) is
 * what actually identifies the subject. Longer words weigh more.
 */
function scoreCandidate(query: string, candidateTitle: string, destinationTokens: Set<string>): number {
  const queryTokens = meaningfulTokens(query);
  const titleTokens = meaningfulTokens(candidateTitle);
  if (!queryTokens.length || !titleTokens.length) return 0;

  let score = 0;
  for (const token of queryTokens) {
    const matched = titleTokens.some((other) => tokensMatch(token, other));
    if (!matched) continue;
    score += destinationTokens.has(token) ? 0.2 : token.length;
  }

  return score;
}

function meaningfulTokens(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

// Openverse aggregates Flickr and other CC libraries: better than Commons for
// food, atmosphere and everyday-life shots. No API key needed.
// Openverse regularly stops answering for a while. Every dish and restaurant
// query starts there, so one outage used to cost the full timeout per card:
// after a couple of consecutive failures it is skipped for the rest of the run.
const OPENVERSE_TIMEOUT_MS = 4000;
const OPENVERSE_MAX_FAILURES = 2;
let openverseFailures = 0;

async function fromOpenverse(query: string): Promise<Photo | null> {
  if (openverseFailures >= OPENVERSE_MAX_FAILURES) return null;

  const params = new URLSearchParams({
    q: query,
    page_size: "10",
    license_type: "all-cc",
    mature: "false"
  });

  let data: any;
  try {
    data = await fetchJson(`https://api.openverse.org/v1/images/?${params}`, {}, OPENVERSE_TIMEOUT_MS);
    openverseFailures = 0;
  } catch (error) {
    openverseFailures += 1;
    throw error;
  }
  const candidates = (data?.results ?? []).filter((candidate: any) => candidate?.url);
  if (!candidates.length) return null;

  // Two tables serving the same cuisine must not end up with the same plate:
  // the query decides which of the matching photos is used.
  const result = candidates[hashCode(query) % candidates.length];

  return {
    query,
    url: result.url,
    thumb_url: result.thumbnail ?? result.url,
    credit: result.creator ? `${result.creator} (${result.source ?? "Openverse"})` : "Openverse",
    source_url: result.foreign_landing_url ?? null,
    license: result.license ? `${String(result.license).toUpperCase()} ${result.license_version ?? ""}`.trim() : null
  };
}

async function fromUnsplash(query: string, accessKey?: string): Promise<Photo | null> {
  if (!accessKey) return null;

  const params = new URLSearchParams({ query, per_page: "1", orientation: "landscape" });
  const data = await fetchJson(`https://api.unsplash.com/search/photos?${params}`, {
    Authorization: `Client-ID ${accessKey}`
  });

  const result = data?.results?.[0];
  if (!result?.urls?.regular) return null;

  return {
    query,
    url: result.urls.regular,
    thumb_url: result.urls.small ?? result.urls.regular,
    credit: result.user?.name ? `${result.user.name} / Unsplash` : "Unsplash",
    source_url: result.links?.html ?? null,
    license: "Unsplash License"
  };
}

async function fromPexels(query: string, apiKey?: string): Promise<Photo | null> {
  if (!apiKey) return null;

  const params = new URLSearchParams({ query, per_page: "1", orientation: "landscape" });
  const data = await fetchJson(`https://api.pexels.com/v1/search?${params}`, { Authorization: apiKey });

  const result = data?.photos?.[0];
  if (!result?.src?.large2x) return null;

  return {
    query,
    url: result.src.large2x,
    thumb_url: result.src.medium ?? result.src.large2x,
    credit: result.photographer ? `${result.photographer} / Pexels` : "Pexels",
    source_url: result.url ?? null,
    license: "Pexels License"
  };
}

function hashCode(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function stripHtml(value?: string | null): string | null {
  if (!value) return null;
  const text = value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return text || null;
}
