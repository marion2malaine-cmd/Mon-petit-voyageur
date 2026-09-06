export interface IntentSignals {
  wantsDestinationIdeas: boolean;
  wantsLiveResearch: boolean;
  wantsEntryRequirements: boolean;
  wantsPacking: boolean;
}

export function detectIntent(message: string): IntentSignals {
  const normalized = message.toLowerCase();

  return {
    wantsDestinationIdeas:
      containsOne(normalized, ["où", "where", "idée", "idea", "destination", "propose", "suggest"]),
    wantsLiveResearch: containsOne(normalized, [
      "vol",
      "flight",
      "hotel",
      "hôtel",
      "prix",
      "price",
      "live",
      "disponibil",
      "availability"
    ]),
    wantsEntryRequirements: containsOne(normalized, [
      "visa",
      "formalités",
      "documents",
      "entry",
      "requirement",
      "passport"
    ]),
    wantsPacking: containsOne(normalized, ["valise", "packing", "pack", "checklist"]) 
  };
}

function containsOne(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}
