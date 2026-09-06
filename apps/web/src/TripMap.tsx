import { useEffect, useRef, useState } from "react";

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
      points: [
        ...(day.free_visits ?? []).filter(located).map((v: any) => ({ name: String(v.name), lat: v.coordinates.lat, lon: v.coordinates.lon, kind: "visit" as const })),
        ...(day.paid_options ?? [])
          .filter((o: any) => o.kind === "ticket" && located(o))
          .map((o: any) => ({ name: String(o.title), lat: o.coordinates.lat, lon: o.coordinates.lon, kind: "ticket" as const })),
        ...(day.restaurants ?? []).filter(located).map((r: any) => ({ name: String(r.name), lat: r.coordinates.lat, lon: r.coordinates.lon, kind: "restaurant" as const }))
      ]
    }))
    .filter((route) => route.points.length > 0);
}

const stops = (route: MapRoute) => route.points.filter((p) => p.kind !== "restaurant");
const tables = (route: MapRoute) => route.points.filter((p) => p.kind === "restaurant");

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
export default function TripMap({ routes, locale = "fr", hotel = null }: { routes: MapRoute[]; locale?: "fr" | "en"; hotel?: { name: string; lat: number; lon: number } | null }) {
  const container = useRef<HTMLDivElement>(null);
  const [walks, setWalks] = useState<Record<number, Walk>>({});

  useEffect(() => {
    if (!MAPBOX_TOKEN || !container.current || !routes.length) return;
    let map: any = null;
    let cancelled = false;
    setWalks({});

    Promise.all([import("mapbox-gl"), import("mapbox-gl/dist/mapbox-gl.css")]).then(([module]) => {
      if (cancelled || !container.current) return;
      const mapboxgl = module.default;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      map = new mapboxgl.Map({
        container: container.current,
        style: "mapbox://styles/mapbox/outdoors-v12",
        scrollZoom: false,
        cooperativeGestures: true
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      const bounds = new mapboxgl.LngLatBounds();
      if (hotel) {
        bounds.extend([hotel.lon, hotel.lat]);
        const el = document.createElement("div");
        el.className = "map-marker map-marker-hotel";
        el.textContent = "H";
        new mapboxgl.Marker({ element: el })
          .setLngLat([hotel.lon, hotel.lat])
          .setPopup(new mapboxgl.Popup({ offset: 14, closeButton: false }).setDOMContent(popupNode(locale === "fr" ? "Votre hôtel" : "Your hotel", hotel.name)))
          .addTo(map);
      }
      routes.forEach((route, index) => {
        const colour = PALETTE[index % PALETTE.length];
        stops(route).forEach((point, order) => {
          bounds.extend([point.lon, point.lat]);
          const el = document.createElement("div");
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
        routes.forEach((route, index) => {
          if (stops(route).length < 2) return;
          const id = `route-${index}`;
          map.addSource(id, {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: stops(route).map((p) => [p.lon, p.lat]) } }
          });
          map.addLayer({
            id,
            type: "line",
            source: id,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": PALETTE[index % PALETTE.length], "line-width": 4, "line-opacity": 0.85 }
          });
          walkingRoute(route).then((walk) => {
            if (cancelled || !walk || !map) return;
            map.getSource(id)?.setData({ type: "Feature", properties: {}, geometry: walk.geometry });
            setWalks((current) => ({ ...current, [route.day]: { distance: walk.distance, duration: walk.duration } }));
          });
        });
      });

      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 0 });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [routes, hotel?.lat, hotel?.lon]);

  if (!MAPBOX_TOKEN || !routes.length) return null;

  return (
    <div className="trip-map-block">
      <div ref={container} className="trip-map" />
      <div className="map-legend">
        {routes.map((route, index) => (
          <span key={route.day} className="chip">
            <i className="dot" style={{ background: PALETTE[index % PALETTE.length] }} />
            {route.title}
            {walks[route.day] && <span className="walk"> · {walkLabel(walks[route.day], locale)}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
