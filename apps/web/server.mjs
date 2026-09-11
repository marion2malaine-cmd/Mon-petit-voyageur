// Production static server for apps/web/dist (replaces `vite preview`).
//
// Why not vite preview: it answers 200 + index.html for every unknown URL
// (soft 404 for Google), cannot redirect /page.html or /page/ to the clean
// URL, and sets no cache headers. This server:
//   • serves dist/ files (immutable cache for /assets/*)
//   • serves the static SEO pages dist/<slug>.html at /<slug>
//   • 301 /index.html → /, /<slug>.html → /<slug>, /<slug>/ → /<slug>
//   • serves index.html (the React app) only for / and the app routes
//     (/mobile*, /admin*, answered with X-Robots-Tag: noindex, nofollow since
//     they are private surfaces serving the home shell), everything else is a
//     real 404 (dist/404.html)
//   • gzips text responses, X-Robots-Tag: noindex on non-canonical hosts
//     (the *.up.railway.app domain must not be indexed as a duplicate)
// No dependency: node:http only. Node ≥ 18.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const CANONICAL_HOST = process.env.CANONICAL_HOST ?? "www.monpetitvoyageur.com";
const SPA_PREFIXES = ["/mobile", "/admin"];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".webmanifest": "application/manifest+json"
};
const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".xml", ".txt", ".svg", ".map", ".webmanifest"]);

const gzipCache = new Map();

function fileIfExists(rel) {
  const abs = path.join(DIST, rel);
  if (!abs.startsWith(DIST + path.sep) && abs !== DIST) return null;
  try {
    const stat = fs.statSync(abs);
    return stat.isFile() ? { abs, stat } : null;
  } catch {
    return null;
  }
}

function redirect(res, location) {
  res.writeHead(301, { Location: location, "Cache-Control": "public, max-age=3600" });
  res.end();
}

function send(req, res, file, status, extraHeaders = {}) {
  const ext = path.extname(file.abs).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const headers = {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  };
  if (file.abs.includes(`${path.sep}assets${path.sep}`)) headers["Cache-Control"] = "public, max-age=31536000, immutable";
  else if (ext === ".html") headers["Cache-Control"] = "public, max-age=0, must-revalidate";
  else headers["Cache-Control"] = "public, max-age=86400";

  let body = fs.readFileSync(file.abs);
  const acceptsGzip = /\bgzip\b/.test(req.headers["accept-encoding"] || "");
  if (COMPRESSIBLE.has(ext)) {
    headers.Vary = "Accept-Encoding";
    if (acceptsGzip && body.length > 1024) {
      const key = `${file.abs}:${file.stat.mtimeMs}:${file.stat.size}`;
      let gz = gzipCache.get(key);
      if (!gz) {
        gz = zlib.gzipSync(body);
        gzipCache.set(key, gz);
      }
      body = gz;
      headers["Content-Encoding"] = "gzip";
    }
  }
  headers["Content-Length"] = body.length;
  res.writeHead(status, headers);
  res.end(req.method === "HEAD" ? undefined : body);
}

function notFound(req, res, headers) {
  const page = fileIfExists("404.html");
  if (page) return send(req, res, page, 404, headers);
  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", ...headers });
  res.end("<!doctype html><html lang=\"fr\"><title>Page introuvable</title><h1>Page introuvable</h1><p><a href=\"/\">Accueil</a></p>");
}

export function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }
  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch {
    res.writeHead(400);
    return res.end();
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  if (pathname.includes("\0") || pathname.split("/").includes("..")) {
    res.writeHead(400);
    return res.end();
  }

  const host = (req.headers.host || "").split(":")[0];
  const extra = CANONICAL_HOST && host !== CANONICAL_HOST ? { "X-Robots-Tag": "noindex" } : {};
  const search = url.search || "";

  // Canonical URL hygiene.
  if (pathname === "/index.html") return redirect(res, "/" + search);
  if (pathname.endsWith(".html") && fileIfExists(pathname.slice(1))) return redirect(res, pathname.slice(0, -5) + search);
  if (pathname.length > 1 && pathname.endsWith("/")) {
    const clean = pathname.replace(/\/+$/, "");
    if (fileIfExists(`${clean.slice(1)}.html`)) return redirect(res, clean + search);
  }

  // The React app: / and the app routes. The app routes (/mobile, /admin) are
  // private surfaces that serve the home shell verbatim: without an explicit
  // noindex a crawler that ignores robots.txt would find the home page
  // duplicated under those paths.
  if (pathname === "/") return send(req, res, fileIfExists("index.html"), 200, extra);
  if (SPA_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return send(req, res, fileIfExists("index.html"), 200, { ...extra, "X-Robots-Tag": "noindex, nofollow" });
  }
  // Real files (assets, images, robots.txt, sitemap.xml, llms.txt…).
  const file = fileIfExists(pathname.slice(1));
  if (file) return send(req, res, file, 200, extra);
  // Static SEO pages: /slug → dist/slug.html
  const page = fileIfExists(`${pathname.slice(1)}.html`);
  if (page) return send(req, res, page, 200, extra);

  return notFound(req, res, extra);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.error(`dist/index.html introuvable dans ${DIST} : lancer npm run build d'abord`);
    process.exit(1);
  }
  http.createServer(handler).listen(PORT, HOST, () => {
    console.log(`Mon Petit Voyageur web : http://${HOST}:${PORT} (dist=${DIST}, canonical host=${CANONICAL_HOST || "aucun"})`);
  });
}
