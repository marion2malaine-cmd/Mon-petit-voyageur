import { describe, expect, it } from "vitest";
import { detectIntent } from "../skills/intent";

describe("detectIntent", () => {
  it("detects live research and entry requirement intents", () => {
    const result = detectIntent("Je veux un vol, un hotel et savoir si j'ai besoin d'un visa");
    expect(result.wantsLiveResearch).toBe(true);
    expect(result.wantsEntryRequirements).toBe(true);
  });

  it("detects destination discovery intent", () => {
    const result = detectIntent("I need ideas about where to go in September");
    expect(result.wantsDestinationIdeas).toBe(true);
  });
});
