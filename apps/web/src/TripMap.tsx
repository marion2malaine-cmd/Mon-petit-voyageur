import { useEffect, useMemo, useRef, useState } from "react";

// Mapbox public token (pk.…), read from the repo-level .env by Vite. A pk.
// token is designed to ship to browsers; it is restricted by URL on the
// Mapbox dashboard, never by secrecy.
export const MAPBOX_TOKEN: string = (import.meta.env.MAPBOX_ACCESS_TOKEN as string | undefined) ?? "";

const PALETTE = ["#78a189", "#334d3e", "#c98a4b", "#5b7f9c", "#8d6a9f", "#b0623f", "#4f8a6d", "#7d7f45"];

export interface MapPoint {
  name: string;
  lat: number;
  lon: number;
  /** A visit or ticketed place is a stop on the walk; a restaurant is a marker beside it. */
  kind: "visit" | "ticket" | "restaurant";
}

export interface MapRoute {
  day: number;
  title: string;
  mode?: string;
  points: MapPoint[];
}

interface Walk {
  distance: number;
  duration: number;
}

const located = (item: any) => item?.coordinates && Number.isFinite(item.coordinates.lat) && Number.isFinite(item.coordinates.lon);

/**
 * One route per day: the free visits then the ticketed options, in order,
 * form the walk; the day's tables are placed next to it. Experiences (a
 * cruise, a bike tour) have no fixed address and stay off the map.
 */
export function routesFromItinerary(days: any[] | undefined): MapRoute[] {
  return (days ?? [])
    .map((day) => ({
      day: Number(day.day),
      title: String(day.title ?? ""),
      mode: String(day.route?.mode ?? "walk").toLowerCase(),
      points: [
        ...(day.free_visits ?? []).filter(located).map((v: any) => ({ name: String(v.name), lat: v.coordinates.lat, lon: v.coordinates.lon, kind: "visit" as const })),
        ...(day.paid_options ?? [])
          .filter((o: any) => o.selected === true && o.kind === "ticket" && located(o))
          .map((o: any) => ({ name: String(o.title), lat: o.coordinates.lat, lon: o.coordinates.lon, kind: "ticket" as const })),
        ...(day.restaurants ?? []).filter(located).map((r: any) => ({ name: String(r.name), lat: r.coordinates.lat, lon: r.coordinates.lon, kind: "restaurant" as const }))
      ]
    }))
    .filter((route) => route.points.length > 0);
}

const stops = (route: MapRoute) => route.points.filter((p) => p.kind !== "restaurant");
const tables = (route: MapRoute) => route.points.filter((p) => p.kind === "restaurant");

function transportIcon(mode = "walk"): string {
  const normalized = mode.toLowerCase();
  if (["walk", "foot", "walking"].includes(normalized)) return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="13" cy="4" r="2"/><path d="m8 21 3-7 4 3 1 4M7 12l3-5 4 1 3 5h3M11 8l-1 6"/></svg>';
  if (normalized.includes("boat") || normalized.includes("bateau") || normalized.includes("mer")) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h16l-2 4H6l-2-4Z"/><path d="M12 4v10M12 5 7 10h10l-5-5ZM3 20c2 1.4 4 1.4 6 0 2 1.4 4 1.4 6 0 2 1.4 4 1.4 6 0"/></svg>';
  }
  if (normalized.includes("plane") || normalized.includes("avion") || normalized.includes("air")) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 13 7-2 2-7 2 1-1 6 7 2c1 .3 1 1.7 0 2l-7 1-2 5-1-1 .5-4-7-1c-1-.2-1-1.7-.5-2Z"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16v-4l2-4h8l3 4v4M3 16h18M6 16v2M18 16v2M7 12h10"/><circle cx="7" cy="16" r="1.5"/><circle cx="17" cy="16" r="1.5"/></svg>';
}

function transportLabel(mode = "walk"): string {
  const normalized = mode.toLowerCase();
  if (normalized.includes("boat") || normalized.includes("bateau") || normalized.includes("mer")) return "Par la mer";
  if (normalized.includes("plane") || normalized.includes("avion") || normalized.includes("air")) return "Par les airs";
  return "Par la route";
}

/** The day's walk following the streets (Mapbox Directions, walking profile), or null. */
async function walkingRoute(route: MapRoute): Promise<{ geometry: any; distance: number; duration: number } | null> {
  const coords = stops(route).slice(0, 25).map((p) => `${p.lon},${p.lat}`).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?geometries=geojson&overview=full&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const best = (await response.json())?.routes?.[0];
    return best ? { geometry: best.geometry, distance: best.distance, duration: best.duration } : null;
  } catch {
    return null;
  }
}

function walkLabel(walk: Walk, locale: "fr" | "en"): string {
  const km = (walk.distance / 1000).toFixed(1).replace(".", locale === "fr" ? "," : ".");
  const minutes = Math.round(walk.duration / 60);
  const time = minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`;
  return `${km} km · ${time}`;
}

function popupNode(title: string, label: string): HTMLElement {
  const popup = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = title;
  popup.append(strong, document.createElement("br"), label);
  return popup;
}

/**
 * The trip on a Mapbox map: one coloured walk per day joining the visits and
 * ticketed places in order (real street route when Directions answers,
 * straight lines otherwise), restaurants as hollow markers, numbered stops
 * with a popup. mapbox-gl is imported lazily so the initial bundle (and the
 * jsdom tests) never load WebGL code.
 */
// When the interactive map cannot start (WebGL refused, a browser without
// hardware acceleration), the same route is drawn by Mapbox's still-image
// service: numbered pins and the day's line, no WebGL involved. The URL is
// bounded, so a long trip keeps the first pins of each day.
const STILL_PIN_BUDGET = 60;
function buildStaticMapUrl(routes: MapRoute[], city: boolean): string | null {
  const overlays: string[] = [];
  let pins = 0;
  routes.forEach((route, index) => {
    const colour = (city ? "#ed775e" : PALETTE[index % PALETTE.length]).replace("#", "");
    const points = stops(route);
    if (points.length >= 2) {
      overlays.push(`path-4+${colour}-0.85(${encodeURIComponent(encodePolyline(points.map((p) => [p.lat, p.lon])))})`);
    }
    points.forEach((point, order) => {
      if (pins >= STILL_PIN_BUDGET) return;
      pins += 1;
      overlays.push(`pin-s-${Math.min(order + 1, 99)}+${colour}(${point.lon.toFixed(5)},${point.lat.toFixed(5)})`);
    });
  });
  if (!overlays.length) return null;
  return `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${overlays.join(",")}/auto/1200x640@2x?padding=50&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;
}

// Google's polyline encoding, what the static API expects for a path.
function encodePolyline(points: [number, number][]): string {
  let output = "";
  let previousLat = 0;
  let previousLon = 0;
  const encodeValue = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let chunk = "";
    while (v >= 0x20) {
      chunk += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return chunk + String.fromCharCode(v + 63);
  };
  for (const [lat, lon] of points) {
    const roundedLat = Math.round(lat * 1e5);
    const roundedLon = Math.round(lon * 1e5);
    output += encodeValue(roundedLat - previousLat) + encodeValue(roundedLon - previousLon);
    previousLat = roundedLat;
    previousLon = roundedLon;
  }
  return output;
}

export default function TripMap({ routes, locale = "fr", hotel = null }: { routes: MapRoute[]; locale?: "fr" | "en"; hotel?: { name: string; photo?: string; lat: number; lon: number } | null }) {
  const container = useRef<HTMLDivElement>(null);
  const [walks, setWalks] = useState<Record<number, Walk>>({});
  const [day, setDay] = useState<number | null>(null);
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [mapError, setMapError] = useState(false);
  const [fallback, setFallback] = useState(false);
  const allPoints = routes.flatMap(r => r.points);
  const city = allPoints.length > 0 && Math.max(...allPoints.map(p => p.lat)) - Math.min(...allPoints.map(p => p.lat)) < .35 && Math.max(...allPoints.map(p => p.lon)) - Math.min(...allPoints.map(p => p.lon)) < .5;
  const visibleRoutes = useMemo(() => day === null ? routes : routes.filter(r => r.day === day), [routes, day]);
  const fr = locale === "fr";
  useEffect(() => { setDay(null); setSelected(null); }, [routes]);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !container.current || !routes.length) return;
    let map: any = null;
    let resizeObserver: ResizeObserver | null = null;
    let cancelled = false;
    setWalks({});
    setMapError(false);

    Promise.all([import("mapbox-gl"), import("mapbox-gl/dist/mapbox-gl.css")]).then(([module]) => {
      if (cancelled || !container.current) return;
      const mapboxgl = module.default;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      map = new mapboxgl.Map({
        container: container.current,
        style: fallback ? { version: 8, sources: { backup: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxzoom: 19 } }, layers: [{ id: "backup", type: "raster", source: "backup" }] } : "mapbox://styles/mapbox/outdoors-v12",
        pitch: city && !fallback ? 58 : 0,
        bearing: city ? -22 : 0,
        scrollZoom: false,
        cooperativeGestures: true
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      // The map is created while the results section is still settling its
      // layout: measured at the wrong size, it painted nothing until the
      // window was resized. Following the container's real size fixes that.
      resizeObserver = new ResizeObserver(() => map?.resize());
      resizeObserver.observe(container.current);
      map.once("load", () => map?.resize());
      map.on("error", (event: any) => {
        if (!cancelled) setMapError(true);
        if (!cancelled && !fallback) setFallback(true);
        console.warn("Map loading:", JSON.stringify({message: event.error?.message, status: event.error?.status, url: event.error?.url?.split("?")[0]}));
      });

      const bounds = new mapboxgl.LngLatBounds();
      if (hotel) {
        bounds.extend([hotel.lon, hotel.lat]);
        const el = document.createElement("div");
        el.className = "map-marker map-marker-hotel";
        el.textContent = "H";
        const hotelPopup = popupNode(locale === "fr" ? "Votre hôtel" : "Your hotel", hotel.name);
        if (hotel.photo && /^https?:\/\//i.test(hotel.photo)) {
          const img = document.createElement("img"); img.src = hotel.photo; img.alt = hotel.name; img.width = 200; img.style.borderRadius = "8px"; img.onerror = () => img.remove(); hotelPopup.prepend(img);
        }
        new mapboxgl.Marker({ element: el })
          .setLngLat([hotel.lon, hotel.lat])
          .setPopup(new mapboxgl.Popup({ offset: 14, closeButton: false }).setDOMContent(hotelPopup))
          .addTo(map);
      }
      visibleRoutes.forEach((route, index) => {
        const colour = city ? "#ed775e" : PALETTE[index % PALETTE.length];
        const routeStops = stops(route);
        routeStops.forEach((point, order) => {
          bounds.extend([point.lon, point.lat]);
          const el = document.createElement("button");
          el.type = "button";
          el.setAttribute("aria-label", point.name);
          el.addEventListener("click", () => setSelected(point));
          el.className = "map-marker";
          el.style.background = colour;
          el.textContent = String(order + 1);
          new mapboxgl.Marker({ element: el })
            .setLngLat([point.lon, point.lat])
            .setPopup(new mapboxgl.Popup({ offset: 14, closeButton: false }).setDOMContent(popupNode(route.title, `${order + 1}. ${point.name}`)))
            .addTo(map);
        });
        tables(route).forEach((point) => {
          bounds.extend([point.lon, point.lat]);
          const el = document.createElement("div");
          el.className = "map-marker map-marker-food";
          el.style.borderColor = colour;
          el.style.color = colour;
          el.textContent = "R";
          new mapboxgl.Marker({ element: el })
            .setLngLat([point.lon, point.lat])
            .setPopup(new mapboxgl.Popup({ offset: 14, closeButton: false }).setDOMContent(popupNode(route.title, point.name)))
            .addTo(map);
        });
      });

      map.on("load", () => {
        setMapError(false);
        if (city && !fallback) {
          const label = map.getStyle().layers.find((layer: any) => layer.type === "symbol" && layer.layout?.["text-field"]);
          map.addLayer({ id: "city-buildings", type: "fill-extrusion", source: "composite", "source-layer": "building", minzoom: 13,
            paint: { "fill-extrusion-color": "#ded8ca", "fill-extrusion-height": ["get", "height"], "fill-extrusion-base": ["get", "min_height"], "fill-extrusion-opacity": .95 }
          }, label?.id);
        }
        visibleRoutes.forEach((route, index) => {
          if (stops(route).length < 2) return;
          const id = `route-${index}`;
          map.addSource(id, {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: stops(route).map((p) => [p.lon, p.lat]) } }
          });
          map.addLayer({
            id: `${id}-outline`, type: "line", source: id,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0 }
          });
          map.addLayer({
            id,
            type: "line",
            source: id,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": city ? "#ed775e" : PALETTE[index % PALETTE.length], "line-width": 5, "line-opacity": 0 }
          });
          walkingRoute(route).then((walk) => {
            if (cancelled || !walk || !map) return;
            map.getSource(id)?.setData({ type: "Feature", properties: {}, geometry: walk.geometry });
            map.setPaintProperty(id, "line-opacity", .95);
            map.setPaintProperty(`${id}-outline`, "line-opacity", 1);
            setWalks((current) => ({ ...current, [route.day]: { distance: walk.distance, duration: walk.duration } }));
          });
        });
      });

      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 65, maxZoom: city ? 16 : 14, duration: 0 });
    }).catch((error) => {
      // Typically WebGL refused by the browser: no interactive map is
      // possible, the still image below takes over.
      console.warn("Map loading:", (error as Error)?.message ?? error);
      if (!cancelled) setMapError(true);
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      map?.remove();
    };
  }, [visibleRoutes, city, locale, hotel?.lat, hotel?.lon, hotel?.name, hotel?.photo, fallback]);

  if (!MAPBOX_TOKEN || !routes.length) return null;

  const staticMap = mapError ? buildStaticMapUrl(visibleRoutes, city) : null;

  return (
    <div className={`trip-map-block${city ? " city-map-block" : ""}`}>
      <div className="trip-map-heading">
        <div>
          <span className="trip-map-eyebrow">{city ? "CITY TRIP" : fr ? "VOTRE ESCAPADE" : "YOUR GETAWAY"}</span>
          <h5>{fr ? "La carte de votre séjour" : "Your trip map"}</h5>
        </div>
        <span className="trip-map-hint">Cliquez sur un repère pour découvrir l’étape</span>
      </div>
      <div className="city-map-layout">
        {city && <nav className="city-map-sidebar" aria-label={fr ? "Journées" : "Days"}>
          <span className="city-map-caption">{fr ? "MES ÉTAPES" : "MY STOPS"}</span>
          <button type="button" aria-pressed={day === null} onClick={() => { setDay(null); setSelected(null); }}>{fr ? "Tout le séjour" : "Whole trip"}</button>
          {routes.map(r => <button type="button" key={r.day} aria-pressed={day === r.day} onClick={() => { setDay(r.day); setSelected(null); }}><strong>{fr ? "Jour" : "Day"} {r.day}</strong><small>{r.title}</small></button>)}
        </nav>}
        <div className="city-map-stage">
          <div ref={container} className="trip-map" />
          {mapError && staticMap && <img className="trip-map-still" src={staticMap} alt={fr ? "Carte du séjour" : "Trip map"} />}
          {mapError && <p className="city-map-notice" role="status">{fr ? "Certaines données cartographiques sont indisponibles." : "Some map data is unavailable."}</p>}
          {fallback && !mapError && <p className="city-map-notice" role="status">{fr ? "Vue 2D · Le fond 3D est temporairement indisponible" : "2D view · 3D map temporarily unavailable"}</p>}
          {selected && <aside className="city-map-detail"><button type="button" aria-label={fr ? "Fermer" : "Close"} onClick={() => setSelected(null)}>×</button><small>{fr ? "VOTRE ÉTAPE" : "YOUR STOP"}</small><strong>{selected.name}</strong><a href={`https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lon}`} target="_blank" rel="noreferrer">{fr ? "Voir l’adresse ↗" : "View location ↗"}</a></aside>}
        </div>
      </div>
      {mapError && <div className="map-legend">{visibleRoutes.flatMap(r => r.points.map((p, i) => <a className="chip" key={`${r.day}-${i}`} href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`} target="_blank" rel="noreferrer">{p.name} ↗</a>))}</div>}
      <div className="map-legend">
        {routes.map((route, index) => (
          <span key={route.day} className="chip">
            <span className="transport-icon" dangerouslySetInnerHTML={{ __html: transportIcon(route.mode) }} />
            <i className="dot" style={{ background: PALETTE[index % PALETTE.length] }} />
            <span>{route.title}</span>
            {walks[route.day] && <span className="walk"> · {walkLabel(walks[route.day], locale)}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
