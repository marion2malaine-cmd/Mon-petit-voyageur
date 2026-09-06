import { describe, expect, it } from "vitest";
import { extractDestination } from "../skills/handlers";

// The fallback parser runs whenever the LLM is unavailable; its destination
// seeds every photo query and booking link, so it must be the place alone.
describe("extractDestination", () => {
  it("stops at the clause that follows the place", () => {
    expect(extractDestination("5 jours en Crète en famille en septembre, budget 2500 €")).toBe("Crète");
    expect(extractDestination("Une semaine à Lisbonne pour 2 personnes")).toBe("Lisbonne");
    expect(extractDestination("Partir à Séville avec des amis en mai")).toBe("Séville");
    expect(extractDestination("10 days in Kyoto for a family of four")).toBe("Kyoto");
  });

  it("keeps multi-word place names", () => {
    expect(extractDestination("Un week-end à Rio de Janeiro")).toBe("Rio de Janeiro");
    expect(extractDestination("Vacances à San Sebastián en juillet")).toBe("San Sebastián");
  });

  it("returns null when no place is capitalised", () => {
    expect(extractDestination("je veux partir quelque part au soleil")).toBeNull();
  });
});
