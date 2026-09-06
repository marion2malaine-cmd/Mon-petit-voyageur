import { describe, expect, it } from "vitest";
import { buildStaticMapUrl, encodePolyline } from "../guide/staticMap";
import { mapRouteForDay } from "../guide/renderGuide";

describe("static map", () => {
  it("encodes polylines the way Google and Mapbox expect", () => {
    // Reference vector from Google's polyline algorithm documentation.
    expect(encodePolyline([[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]])).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  });

  it("puts each day's stops on a line, numbered pins and a fork pin per table", () => {
    const route = mapRouteForDay({
      day: 1,
      title: "Jour 1",
      free_visits: [
        { name: "Palais", coordinates: { lat: 35.298, lon: 25.163 } },
        { name: "Musée sans adresse", coordinates: null }
      ],
      paid_options: [
        { title: "Musée archéologique", kind: "ticket", coordinates: { lat: 35.339, lon: 25.137 } },
        { title: "Croisière", kind: "experience", coordinates: { lat: 35.3, lon: 25.1 } }
      ],
      restaurants: [{ name: "Taverne", coordinates: { lat: 35.34, lon: 25.13 } }]
    } as any);

    expect(route.points.map((p) => p.kind)).toEqual(["visit", "ticket", "restaurant"]);

    const url = buildStaticMapUrl([route], "pk.test")!;
    expect(url).toContain("/static/path-4+78a189-0.85(");
    expect(url).toContain("pin-s-1+78a189(25.16300,35.29800)");
    expect(url).toContain("pin-s-2+78a189(25.13700,35.33900)");
    expect(url).toContain("pin-s-restaurant+78a189(25.13000,35.34000)");
    expect(url).toContain("/auto/1200x640?padding=40&access_token=pk.test");
  });

  it("returns null when nothing is located", () => {
    expect(buildStaticMapUrl([], "pk.test")).toBeNull();
  });
});
