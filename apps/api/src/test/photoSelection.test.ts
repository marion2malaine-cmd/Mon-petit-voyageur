import { describe, expect, it } from "vitest";
import { isRelevant, workshopQuery } from "../tools/photos";

// The rules Marion set for the pictures: an activity card shows that
// activity, a monument card that monument — never the country.
describe("photo selection", () => {
  const morocco = new Set(["marrakech", "maroc", "morocco"]);

  it("refuses an article about a whole country or theme", () => {
    expect(isRelevant("Cours de cuisine marocaine Marrakech", "Culture of Morocco", morocco)).toBe(false);
    expect(isRelevant("Cours de cuisine marocaine Marrakech", "Cuisine marocaine", morocco)).toBe(false);
    expect(isRelevant("Palais de la Bahia Marrakech", "Tourism in Morocco", morocco)).toBe(false);
  });

  it("keeps the exact monument", () => {
    expect(isRelevant("Palais de la Bahia Marrakech", "Palais de la Bahia", morocco)).toBe(true);
    expect(isRelevant("Jardin Majorelle Marrakech", "Jardin Majorelle", morocco)).toBe(true);
  });

  it("asks the libraries for the gesture of a workshop, in the destination", () => {
    expect(workshopQuery("Cours de cuisine marocaine Marrakech", "Marrakech")).toMatch(/^cooking class .* Marrakech$/);
    expect(workshopQuery("Atelier de poterie à Safi", "Safi")).toMatch(/^pottery workshop hands/);
    expect(workshopQuery("Dégustation de vin dans le Chianti", "Toscane")).toMatch(/^tasting session/);
    expect(workshopQuery("Palais de la Bahia", "Marrakech")).toBeNull();
    expect(workshopQuery("Tour de la médina en calèche", "Marrakech")).toBeNull();
    expect(workshopQuery("Parcours culinaire dans la médina", "Marrakech")).toBeNull();
    expect(workshopQuery("Concert de musique classique", "Vienne")).toBeNull();
  });
});

import { pickEstablishmentPhoto } from "../tools/googlePlaces";

describe("hotel photo from Google Places", () => {
  const place = {
    displayName: { text: "Green Hill Homestay & Tours" },
    photos: [
      { name: "p/guest", widthPx: 3000, heightPx: 4000, authorAttributions: [{ displayName: "Marion D." }] },
      { name: "p/owner-portrait", widthPx: 1000, heightPx: 1500, authorAttributions: [{ displayName: "Green Hill Homestay & Tour" }] },
      { name: "p/owner-wide", widthPx: 1600, heightPx: 1000, authorAttributions: [{ displayName: "Green Hill Homestay & Tour" }] }
    ]
  };

  it("takes the establishment's own photo, landscape first", () => {
    expect(pickEstablishmentPhoto(place, "Green Hill Homestay & Tours")?.name).toBe("p/owner-wide");
  });

  it("returns nothing when only guests photographed the place", () => {
    expect(pickEstablishmentPhoto({ ...place, photos: [place.photos[0]] }, "Green Hill Homestay & Tours")).toBeNull();
  });
});
