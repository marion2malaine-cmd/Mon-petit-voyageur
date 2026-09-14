import { expect, it } from "vitest";
import { renderGuideHtml } from "../guide/renderGuide";
import { preferredActivityLinks } from "@mlt/contracts";
it("exports flights before the map and preserves the selected alternative", () => {
 const plan: any = { final_trip_plan: {destination: "Laponie"}, structured_json: {brief: {}, research: {recommended_flights: [{label: "Paris → Rovaniemi", price: 320, currency: "EUR", stops: 1, booking_url: "https://example.com/flight"}]}, itinerary: {itinerary_by_day: [{day: 1, title: "Jour 1", free_visits: [], restaurants: [], paid_options: [{option_label: "A", title: "Safari huskies", description: "Selected safari", selected: true, booking_links: []}, {option_label: "B", title: "Rennes", description: "Other safari", selected: false, booking_links: []}]}], forum_findings: [{source: "Tripadvisor", title: "Safari huskies", snippet: "Conseil de voyageur", url: "https://tripadvisor.com/review"}]}}};
 const html = renderGuideHtml(plan, {locale: "fr"});
 expect(html).toContain("Paris → Rovaniemi");
 expect(html).toContain("320 EUR");
 expect(html.indexOf("Vols aller-retour")).toBeLessThan(html.indexOf('<article class="day">'));
 expect(html).toContain('class="activity-choice alternative"');
 expect(html).toContain("Conseil de voyageur");
 expect(html).not.toContain('class="forum-grid"');
});
it("keeps GetYourGuide when Viator is absent and removes it when present", () => {
 const g = {url: "https://www.getyourguide.com/activity"};
 const v = {url: "https://www.viator.com/activity"};
 expect(preferredActivityLinks([g])).toEqual([g]);
 expect(preferredActivityLinks([g, v])).toEqual([v]);
});
