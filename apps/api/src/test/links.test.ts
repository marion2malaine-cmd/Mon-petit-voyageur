import { describe, expect, it } from "vitest";
import { buildActivityLinks, buildCrossingLinks, buildTicketLinks, withActivityDate } from "../tools/links";

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
