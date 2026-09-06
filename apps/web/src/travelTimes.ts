import { useEffect, useState } from "react";
import { MAPBOX_TOKEN } from "./TripMap";

export interface Coord {
  lat: number;
  lon: number;
}

export interface Leg {
  minutes: number;
  km: number;
}

const cache = new Map<string, Promise<Leg | null>>();
const key = (from: Coord, to: Coord) => `${from.lat.toFixed(4)},${from.lon.toFixed(4)}>${to.lat.toFixed(4)},${to.lon.toFixed(4)}`;

/** Driving time and distance from one point to another (Mapbox Directions), or null. */
export function drivingLeg(from: Coord, to: Coord): Promise<Leg | null> {
  if (!MAPBOX_TOKEN) return Promise.resolve(null);
  const k = key(from, to);
  const hit = cache.get(k);
  if (hit) return hit;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;
  const promise = fetch(url)
    .then((response) => (response.ok ? response.json() : null))
    .then((json) => {
      const route = json?.routes?.[0];
      return route ? { minutes: Math.round(route.duration / 60), km: Math.round(route.distance / 100) / 10 } : null;
    })
    .catch(() => null);
  cache.set(k, promise);
  return promise;
}

const located = (item: any): item is { coordinates: Coord } =>
  item?.coordinates && Number.isFinite(item.coordinates.lat) && Number.isFinite(item.coordinates.lon);

/**
 * Travel times by car from the chosen hotel to every located stop of the
 * itinerary (paid options, free visits, restaurants), keyed by name.
 * Resolved in small parallel batches so the map token is not hammered.
 */
export function useHotelTravelTimes(hotel: Coord | null, days: any[] | undefined): Record<string, Leg> {
  const [legs, setLegs] = useState<Record<string, Leg>>({});

  useEffect(() => {
    setLegs({});
    if (!hotel || !days?.length) return;
    let cancelled = false;
    const targets = new Map<string, Coord>();
    for (const day of days) {
      for (const item of [...(day.paid_options ?? []), ...(day.free_visits ?? []), ...(day.restaurants ?? [])]) {
        const name = String(item?.title ?? item?.name ?? "");
        if (name && located(item) && !targets.has(name)) targets.set(name, item.coordinates);
      }
    }
    const entries = [...targets.entries()];
    (async () => {
      for (let index = 0; index < entries.length; index += 4) {
        const batch = entries.slice(index, index + 4);
        const results = await Promise.all(batch.map(([, to]) => drivingLeg(hotel, to)));
        if (cancelled) return;
        setLegs((current) => {
          const next = { ...current };
          batch.forEach(([name], position) => {
            const leg = results[position];
            if (leg) next[name] = leg;
          });
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotel?.lat, hotel?.lon, days]);

  return legs;
}

export function legLabel(leg: Leg, locale: "fr" | "en"): string {
  const hours = Math.floor(leg.minutes / 60);
  const minutes = leg.minutes % 60;
  const time = hours ? `${hours} h${minutes ? ` ${String(minutes).padStart(2, "0")}` : ""}` : `${minutes} min`;
  return locale === "fr" ? `${time} en voiture · ${leg.km} km` : `${time} by car · ${leg.km} km`;
}
