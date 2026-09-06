import {
  BudgetEstimateSchema,
  DestinationMatcherOutputSchema,
  EntryRequirementsSchema,
  FlightHotelResearchSchema,
  ItineraryByDaySchema,
  PackingChecklistSchema,
  PlanTripRequestSchema,
  PlanTripResponseSchema,
  TravelBriefOutputSchema,
  TripSummaryExportSchema,
  type PlanTripRequest,
  type PlanTripResponse,
  type TravelStyle,
  type StructuredTripBrief
} from "@mlt/contracts";
import { detectIntent } from "../skills/intent";
import { SkillExecutor } from "../skills/executor";
import { planItinerary } from "../skills/itineraryPlanner";
import { buildExcursions, completeBriefDates, mergePreferencesIntoBrief, runFlightHotelResearch } from "../skills/handlers";
import { buildExperienceLinks, buildSearchLinks, buildTransferLinks } from "../tools/links";
import { buildCarRentalAdvice } from "../tools/carRental";
import { enrichItinerary } from "./enrichItinerary";
import type { SkillDefinition } from "../skills/types";
import type { AppConfig } from "../config";
import type { LiveTools } from "../tools";

const VALID_STYLES = new Set(["beach", "culture", "nature", "food", "nightlife", "family", "romantic", "adventure"]);

export function createOrchestrator(config: AppConfig, tools: LiveTools, skillRegistry: Map<string, SkillDefinition>) {
  const executor = new SkillExecutor(config, tools, skillRegistry);

  /**
   * Flights and stays: the live tools are the source of truth, the LLM only
   * adds advice. Left to itself the skill invents "indicative" fares, which is
   * worse than no price at all. So the tools run first (with their own
   * guards: exact dates, known airports, monthly quota), then the LLM gets
   * those results as `live_prices` and its answer keeps the live arrays,
   * links and status verbatim while contributing the transport advice and
   * tradeoff notes. Without an LLM the tool result stands on its own.
   */
  async function researchWithLivePrices(
    brief: StructuredTripBrief,
    destination: string,
    locale: "fr" | "en",
    explicit: boolean
  ) {
    const live = await runFlightHotelResearch(
      { brief, destinationFallback: destination },
      { locale, tools, flexDateSamples: config.SERPAPI_FLEX_DATE_SAMPLES, aviasalesMarker: config.TRAVELPAYOUTS_MARKER ?? null }
    );
    const liveOutput = FlightHotelResearchSchema.parse(live.output);
    const meta = { toolStatuses: live.meta.toolStatuses, source: "tools" as const };

    try {
      const advised = await executor.run(
        "flight-hotel-research",
        FlightHotelResearchSchema,
        {
          brief,
          destinationFallback: destination,
          live_prices: {
            recommended_flights: liveOutput.recommended_flights,
            recommended_stays: liveOutput.recommended_stays,
            live_data_status: liveOutput.live_data_status,
            notes: liveOutput.tradeoff_notes
          }
        },
        { locale, explicit }
      );
      if (advised.meta.source !== "llm") return { output: liveOutput, meta };

      const extraNotes = advised.output.tradeoff_notes.filter((note) => !liveOutput.tradeoff_notes.includes(note));
      return {
        output: {
          ...advised.output,
          recommended_flights: liveOutput.recommended_flights,
          recommended_stays: liveOutput.recommended_stays,
          search_links: liveOutput.search_links,
          live_data_status: liveOutput.live_data_status,
          chosen_dates: liveOutput.chosen_dates,
          date_options: liveOutput.date_options,
          live_costs: liveOutput.live_costs,
          remaining_budget_eur: liveOutput.remaining_budget_eur,
          price_calendar: liveOutput.price_calendar,
          calendar_source: liveOutput.calendar_source,
          tradeoff_notes: [...liveOutput.tradeoff_notes, ...extraNotes]
        },
        meta: { ...meta, source: "llm" as const }
      };
    } catch {
      return { output: liveOutput, meta };
    }
  }

  async function planTrip(input: PlanTripRequest): Promise<PlanTripResponse> {
    const validatedInput = PlanTripRequestSchema.parse(input);
    const locale = validatedInput.locale;
    const intent = detectIntent(validatedInput.message);

    const trace: PlanTripResponse["trace"] = [];
    const openVerifications: string[] = [];

    const briefResult = await executor.run(
      "travel-brief-parser",
      TravelBriefOutputSchema,
      { message: validatedInput.message, preferences: validatedInput.preferences ?? null },
      { locale }
    );
    trace.push({
      skill: "travel-brief-parser",
      status: "ok",
      source: briefResult.meta.source,
      tool_statuses: briefResult.meta.toolStatuses
    });

    // Exact dates are what live price searches run on; when the parser only
    // kept the month, they are derived from it the documented way.
    const brief = completeBriefDates(
      mergePreferencesIntoBrief(briefResult.output.structured_trip_brief, validatedInput.preferences, locale),
      validatedInput.message
    );
    briefResult.output.structured_trip_brief = brief;

    let destinationResult: any = null;
    if (!brief.destination || intent.wantsDestinationIdeas) {
      const result = await executor.run(
        "destination-matcher",
        DestinationMatcherOutputSchema,
        { brief },
        { locale }
      );
      destinationResult = result;
      trace.push({
        skill: "destination-matcher",
        status: "ok",
        source: result.meta.source,
        tool_statuses: result.meta.toolStatuses
      });
    } else {
      trace.push({
        skill: "destination-matcher",
        status: "skipped",
        reason: "Destination already confirmed",
        tool_statuses: {}
      });
    }

    const destinationResolved = brief.destination ?? destinationResult?.output.top_destinations[0]?.destination ?? null;
    const isLikelyInternational = destinationResolved
      ? !["france", "paris", "lyon", "marseille", "bordeaux", "nice"].some((city) =>
          destinationResolved.toLowerCase().includes(city)
        )
      : false;
    const shouldRunResearch = !!destinationResolved;
    const wantsEntry = intent.wantsEntryRequirements || isLikelyInternational;

    // Tickets first. The real fare and stay decide the dates (when only a
    // month was given) and what is left of the budget; everything else is
    // organised inside that, so the research cannot run alongside the rest.
    const researchResult = shouldRunResearch
      ? await researchWithLivePrices(brief, destinationResolved!, locale, intent.wantsLiveResearch || !!brief.budget_total).catch(
          (error) => {
            trace.push({ skill: "flight-hotel-research", status: "skipped", reason: (error as Error).message, tool_statuses: {} });
            return null;
          }
        )
      : null;
    if (researchResult?.output.chosen_dates) {
      brief.exact_dates = { start: researchResult.output.chosen_dates.start, end: researchResult.output.chosen_dates.end, estimated: false };
      briefResult.output.structured_trip_brief = brief;
    }
    const remainingBudgetEur = researchResult?.output.remaining_budget_eur ?? null;
    const liveCosts = researchResult?.output.live_costs ?? null;

    // With the tickets known these four skills no longer depend on one
    // another, so they run concurrently: the plan's wall-clock is the slowest
    // one (the itinerary), not the sum.
    const [budgetResult, entryResult, itineraryResult, packingResult] = await Promise.all([
      executor.run("budget-estimator", BudgetEstimateSchema, { brief, live_costs: liveCosts, remaining_budget_eur: remainingBudgetEur }, { locale }),

      wantsEntry
        ? executor
            .run(
              "entry-requirements-checker",
              EntryRequirementsSchema,
              { brief, destinationFallback: destinationResolved, nationality: "FR" },
              { locale, explicit: true }
            )
            .catch((error) => {
              openVerifications.push(
                locale === "fr"
                  ? "Vérification des formalités indisponible, contrôle manuel requis"
                  : "Entry requirement check unavailable, manual verification required"
              );
              trace.push({ skill: "entry-requirements-checker", status: "skipped", reason: (error as Error).message, tool_statuses: {} });
              return null;
            })
        : Promise.resolve(null),

      // The day-by-day program is itself several calls (outline, then day
      // batches); planItinerary has its own local fallback so it never throws.
      planItinerary(executor, { brief, destination: destinationResolved, locale, remainingBudgetEur, liveCosts }, { locale, tools }),

      executor.run("packing-checklist", PackingChecklistSchema, { brief, destinationFallback: destinationResolved }, { locale })
    ]);

    // Traces are pushed in a stable order once everything has resolved.
    if (researchResult) {
      trace.push({ skill: "flight-hotel-research", status: "ok", source: researchResult.meta.source, tool_statuses: researchResult.meta.toolStatuses });
    }
    trace.push({ skill: "budget-estimator", status: "ok", source: budgetResult.meta.source, tool_statuses: budgetResult.meta.toolStatuses });
    if (entryResult) {
      trace.push({ skill: "entry-requirements-checker", status: "ok", source: entryResult.meta.source, tool_statuses: entryResult.meta.toolStatuses });
      if (entryResult.output.verification_status !== "verified") {
        openVerifications.push(
          locale === "fr" ? "Formalités d'entrée non totalement vérifiées" : "Entry requirements not fully verified"
        );
      }
    }
    trace.push({ skill: "itinerary-builder", status: "ok", source: itineraryResult.source, tool_statuses: itineraryResult.meta.toolStatuses });
    trace.push({ skill: "packing-checklist", status: "ok", source: packingResult.meta.source, tool_statuses: packingResult.meta.toolStatuses });

    // URLs and photos must never come from the LLM (it invents plausible-looking
    // dead links and image URLs): both are rebuilt locally from the titles it
    // produced, so every link in the guide resolves to a real search page.
    if (destinationResolved) {
      const styles = (brief.traveler_types ?? []).filter((s: string) => VALID_STYLES.has(s)) as TravelStyle[];

      if (!itineraryResult.output.suggested_excursions?.length) {
        itineraryResult.output.suggested_excursions = buildExcursions(destinationResolved, styles, locale);
      }

      itineraryResult.output.experience_links = buildExperienceLinks(destinationResolved, locale);

      // withPhotos resolves the real images now, so both the in-app view and
      // the guide show them. It costs a few seconds of parallel image lookups,
      // but the guide download then needs none — the cost simply moves earlier.
      itineraryResult.output = await enrichItinerary(itineraryResult.output, tools, {
        destination: destinationResolved,
        locale,
        withPhotos: true,
        travelers: brief.travelers_count
      });

      if (researchResult) {
        // Car rental is decided locally: the cheapest category that seats the
        // group within the ground-transport envelope, plus the payment and
        // pickup warnings, which must always be present and never invented.
        const localTransit = budgetResult.output.budget_breakdown?.local_transit;
        // A stay that never leaves a walkable city does not need a car, and the
        // guide says so instead of selling one. The model answers this during
        // the outline phase; the number of distinct areas is the fallback.
        const distinctAreas =
          itineraryResult.output.car_needed === null || itineraryResult.output.car_needed === undefined
            ? new Set(
                (itineraryResult.output.itinerary_by_day ?? [])
                  .map((day) => (day.area ?? "").trim().toLowerCase())
                  .filter(Boolean)
              ).size
            : itineraryResult.output.car_needed
              ? 2
              : 1;

        const advice = buildCarRentalAdvice({
          destinationCity: destinationResolved,
          locale,
          travelers: brief.travelers_count,
          durationDays: brief.duration_days ?? 7,
          envelope: localTransit ? { min: localTransit[0], max: localTransit[1] } : null,
          pickupDate: brief.exact_dates.start,
          returnDate: brief.exact_dates.end,
          distinctAreas
        });

        // The one thing only the model knows is how the pickup works at that
        // specific airport, so its answer is kept and merged in.
        const modelPickup = researchResult.output.car_rental?.recommended;
        if (modelPickup?.pickup && modelPickup.pickup !== "unknown") {
          for (const option of [advice.recommended, ...advice.options]) {
            if (!option) continue;
            option.pickup = modelPickup.pickup;
            if (modelPickup.pickup_note) option.pickup_note = modelPickup.pickup_note;
          }
        }

        if (itineraryResult.output.car_rationale) {
          advice.why = itineraryResult.output.car_rationale;
        }

        // A picture of a typical model of each category, from the free photo
        // libraries (no rental API involved). The recommended option shares
        // the object of one of the options, so it is covered too.
        await Promise.all(
          advice.options.map(async (option) => {
            if (!option.example_model) return;
            try {
              const photo = await tools.find_photo({ query: `${option.example_model} car`, locale });
              option.photo = photo?.url ? photo : null;
            } catch {
              option.photo = null;
            }
          })
        );

        researchResult.output.car_rental = advice;

        // Airport transfers and city transit: the model prices them, the app
        // attaches the routes so the traveler can check timetables and fares.
        if (researchResult.output.ground_transport) {
          const transferLinks = buildTransferLinks(destinationResolved, locale);
          researchResult.output.ground_transport.search_links = transferLinks.map((link) => ({
            provider: link.provider,
            label: link.label,
            url: link.url,
            category: "cars" as const
          }));
          for (const option of researchResult.output.ground_transport.airport_to_center ?? []) {
            option.booking_links = transferLinks;
          }
        }

        const searchLinks = buildSearchLinks({
          locale,
          originCity: brief.departure_city ?? "Paris",
          destinationCity: destinationResolved,
          departureDate: brief.exact_dates.start,
          returnDate: brief.exact_dates.end,
          adults: brief.travelers_count
        });
        researchResult.output.search_links = searchLinks;

        const flightLink = searchLinks.find((l) => l.provider === "skyscanner")?.url ?? null;
        const stayLink = searchLinks.find((l) => l.provider === "booking")?.url ?? null;
        // A live result carries the engine's own deep link to that exact fare
        // or property; the comparator link only fills the gaps.
        researchResult.output.recommended_flights = (researchResult.output.recommended_flights ?? []).map(
          (f: any) => ({ ...f, booking_url: f.booking_url ?? flightLink })
        );
        researchResult.output.recommended_stays = (researchResult.output.recommended_stays ?? []).map(
          (s: any) => ({ ...s, booking_url: s.booking_url ?? stayLink })
        );
      }
    }

    const exportResult = await executor.run(
      "trip-summary-export",
      TripSummaryExportSchema,
      {
        brief,
        destination: destinationResult?.output ?? null,
        budget: budgetResult.output,
        research: researchResult?.output ?? null,
        entry: entryResult?.output ?? null,
        itinerary: itineraryResult.output,
        packing: packingResult.output,
        openVerifications
      },
      { locale }
    );
    trace.push({ skill: "trip-summary-export", status: "ok", source: exportResult.meta.source, tool_statuses: exportResult.meta.toolStatuses });

    // The UI depends on these exact keys: rebuild structured_json from the real
    // skill outputs instead of trusting the export skill's own aggregation.
    exportResult.output.structured_json = {
      brief,
      destination_recommendations: destinationResult?.output.top_destinations ?? [],
      budget_estimate: budgetResult.output,
      research: researchResult?.output ?? null,
      entry_requirements: entryResult?.output ?? null,
      itinerary: itineraryResult.output,
      packing_checklist: packingResult.output,
      open_verifications: openVerifications
    };

    const finalResponse = PlanTripResponseSchema.parse({
      traveler_summary: exportResult.output.traveler_summary,
      final_trip_plan: exportResult.output.final_trip_plan,
      structured_json: exportResult.output.structured_json,
      open_verifications: exportResult.output.open_verifications,
      next_steps: exportResult.output.next_steps,
      trace
    });

    return finalResponse;
  }

  return {
    planTrip
  };
}
