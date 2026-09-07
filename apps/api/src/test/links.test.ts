import { describe, expect, it } from "vitest";
import { buildActivityLinks, buildCrossingLinks, buildSearchLinks, buildTicketLinks, withActivityDate } from "../tools/links";

describe("dated activity links", () => {
  it("pre-fills the trip date on the platforms that accept it", () => {
    expect(withActivityDate("https://www.getyourguide.fr/activity/t123", { date: "2026-10-04", adults: 2 })).toContain("date_from=2026-10-04");
    expect(withActivityDate("https://www.getyourguide.fr/activity/t123", { date: "2026-10-04", adults: 2 })).toContain("adults=2");
    expect(withActivityDate("https://www.viator.com/searchResults/all?text=x", { date: "2026-10-04" })).toContain("startDate=2026-10-04");
    expect(withActivityDate("https://www.tiqets.com/fr/search?q=x", { date: "2026-10-04" })).toContain("date=2026-10-04");
  });

  it("leaves other hosts and bad dates alone", () => {
    expect(withActivityDate("https://www.google.com/search?q=x", { date: "2026-10-04" })).toBe("https://www.google.com/search?q=x");
    expect(withActivityDate("https://www.viator.com/searchResults/all?text=x", { date: "octobre" })).toBe("https://www.viator.com/searchResults/all?text=x");
  });

  it("dates the experience and ticket links, never the official site", () => {
    const links = buildActivityLinks("Croisière au coucher du soleil", "Héraklion", "fr", { date: "2026-10-04" });
    expect(links.find((link) => link.provider === "viator")?.url).toContain("startDate=2026-10-04");
    const tickets = buildTicketLinks("Palais de Knossos", "Héraklion", "fr", "https://hhticket.gr/", { date: "2026-10-04" });
    expect(tickets[0].url).toBe("https://hhticket.gr/");
    expect(tickets.find((link) => link.provider === "tiqets")?.url).toContain("date=2026-10-04");
  });
});

describe("crossing links", () => {
  it("names the port and comes with the port operators first", () => {
    const links = buildCrossingLinks("Spinalonga, l'île-forteresse", "Plaka", "Crète", "fr", { date: "2026-10-05" });
    expect(links[0].provider).toBe("local-agency");
    expect(links[0].label).toContain("Plaka");
    expect(links.find((link) => link.provider === "viator")?.url).toContain("startDate=2026-10-05");
    expect(decodeURIComponent(links[1].url).replace(/\+/g, " ")).toContain("depuis Plaka");
  });
});

describe("search links pre-filled from the trip", () => {
  const links = buildSearchLinks({
    locale: "fr",
    originCity: "Paris",
    originCode: "CDG",
    destinationCity: "Héraklion",
    destinationCode: "HER",
    departureDate: "2026-10-04",
    returnDate: "2026-10-11",
    adults: 2
  });
  const url = (provider: string) => links.find((l) => l.provider === provider)?.url ?? "";

  it("opens Skyscanner on the route and the dates", () => {
    expect(url("skyscanner")).toBe("https://www.skyscanner.fr/transport/vols/cdg/her/261004/261011/?adults=2");
  });

  it("phrases the Google Flights query the way Google parses it", () => {
    expect(decodeURIComponent(url("google-flights"))).toContain(
      "Flights from CDG to HER on 2026-10-04 through 2026-10-11"
    );
  });

  it("gives Booking.com a complete search so it keeps the dates", () => {
    const booking = url("booking");
    for (const part of ["ss=H", "checkin=2026-10-04", "checkout=2026-10-11", "group_adults=2", "no_rooms=1"]) {
      expect(booking).toContain(part);
    }
  });
});

describe("links that open the page, not a list of results", () => {
  it("sends the traveler straight to the first result", () => {
    const links = buildTicketLinks("Palais de Knossos", "Héraklion", "fr");
    const official = links.find((l) => l.provider === "official")?.url ?? "";
    expect(official).toContain("duckduckgo.com/?q=");
    expect(decodeURIComponent(official)).toContain("\\ Palais de Knossos billetterie officielle");
  });

  it("never names the destination twice in a query", () => {
    const links = buildActivityLinks("Visite guidée du centre historique de Vietnam", "Vietnam", "fr");
    const local = decodeURIComponent(links.find((l) => l.provider === "local-agency")?.url ?? "");
    expect(local).not.toContain("Vietnam Vietnam");
  });
});

describe("buildInternalFlights", () => {
  it("links every flown leg and, across several states, every change of stage between two airports", async () => {
    const { buildInternalFlights } = await import("../tools/internalFlights");
    const day = (day: number, from: string, to: string, mode: string | null) =>
      ({ day, date: `2026-10-0${day}`, route: { from, to, mode, duration: null, distance_km: null, departure_time: null, stops: [], road_note: null } }) as any;

    const legs = buildInternalFlights(
      [day(1, "", "Miami", null), day(3, "Miami", "Key West", "car"), day(5, "Key West", "Las Vegas", "plane"), day(7, "Las Vegas", "San Francisco", null)],
      { locale: "fr", travelers: 2, multiState: true }
    );

    expect(legs.map((leg) => `${leg.from}→${leg.to}`)).toEqual(["Key West→Las Vegas", "Las Vegas→San Francisco"]);

    expect(legs[0].from_code).toBe("EYW");
    expect(legs[0].to_code).toBe("LAS");
    expect(legs[0].search_links.map((link) => link.provider)).toEqual(["skyscanner", "google-flights"]);
    expect(legs[0].search_links[0].url).toContain("/eyw/las/261005/?adults=2");
    expect(legs[0].search_links.every((link) => link.category === "flights")).toBe(true);
  });

  it("keeps a one-state trip on the road unless the model flew a leg", async () => {
    const { buildInternalFlights } = await import("../tools/internalFlights");
    const days = [
      { day: 2, date: null, route: { from: "Los Angeles", to: "San Francisco", mode: "car" } },
      { day: 4, date: null, route: { from: "San Francisco", to: "San Diego", mode: "avion" } }
    ] as any;
    expect(buildInternalFlights(days, { locale: "en", multiState: false }).map((leg) => leg.day)).toEqual([4]);
  });
});
