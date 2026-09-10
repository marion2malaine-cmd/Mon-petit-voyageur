import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getConfig } from "../config";
import { createTools } from "../tools";
import { loadSkillRegistry } from "../skills/registry";
import { createOrchestrator } from "../orchestrator/orchestrator";
import { embedItineraryPhotos, resolveItineraryPhotos } from "../orchestrator/enrichItinerary";
import { journeyLegs, mapRouteForDay, renderGuideHtml } from "./renderGuide";
import { stillMapDataUri } from "./staticMap";

/**
 * Renders a full guide to an HTML file without going through the API.
 *
 *   npm run guide:preview -w @mlt/api -- "10 jours en Crète en famille" out.html
 *
 * Useful to check the layout after changing the prompt or the renderer.
 */
async function main(): Promise<void> {
  const message = process.argv[2] ?? "10 jours en Crète en famille en août, budget 4000 €, départ de Paris";
  const outputPath = resolve(process.cwd(), process.argv[3] ?? "guide-preview.html");
  const locale = (process.argv[4] as "fr" | "en") ?? "fr";
  // Remote photos by default: the file opens instantly. Pass "embed" for the
  // self-contained version that works offline.
  const embed = process.argv[5] === "embed";

  const config = getConfig();
  const tools = createTools(config);
  const orchestrator = createOrchestrator(config, tools, loadSkillRegistry());

  console.log(`Planning: ${message}`);
  const plan = await orchestrator.planTrip({ message, locale });

  const destination = String((plan.final_trip_plan as any)?.destination ?? "");
  const itinerary = (plan.structured_json as any)?.itinerary;
  if (itinerary?.itinerary_by_day) {
    console.log("Resolving photos...");
    await resolveItineraryPhotos(itinerary, tools, locale, destination, (plan.structured_json as any)?.research);
    if (embed) {
      console.log("Embedding photos...");
      await embedItineraryPhotos(itinerary, (plan.structured_json as any)?.research);
    }
  }


  const previewDays = itinerary?.itinerary_by_day ?? [];
  const routes = previewDays.map(mapRouteForDay);
  const html = renderGuideHtml(plan, {
    locale,
    title: String((plan.final_trip_plan as any)?.destination ?? "Voyage"),
    mapboxToken: config.MAPBOX_ACCESS_TOKEN,
    staticMapSrc: await stillMapDataUri(routes, config.MAPBOX_SERVER_TOKEN ?? config.MAPBOX_ACCESS_TOKEN, journeyLegs(previewDays))
  });
  writeFileSync(outputPath, html, "utf8");

  const days = itinerary?.itinerary_by_day ?? [];
  const freeVisits = days.reduce((total: number, day: any) => total + (day.free_visits?.length ?? 0), 0);
  console.log(`Guide written to ${outputPath}`);
  console.log(`${days.length} days · ${freeVisits} free visits · sources: ${plan.trace.map((s) => `${s.skill}=${s.source ?? s.status}`).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
