import { z } from "zod";
import { PlanTripResponseSchema, StructuredTripBriefSchema, ItineraryByDaySchema, FlightHotelResearchSchema, BudgetEstimateSchema, PackingChecklistSchema, EntryRequirementsSchema } from "@mlt/contracts";

// Validate known sections without stripping enrichment fields added after planning.
const savedPlanSchema = PlanTripResponseSchema.superRefine((plan, context) => {
  const sections = { brief: StructuredTripBriefSchema, itinerary: ItineraryByDaySchema, research: FlightHotelResearchSchema, budget: BudgetEstimateSchema, packing: PackingChecklistSchema, entry: EntryRequirementsSchema };
  for (const [key, schema] of Object.entries(sections)) {
    if (plan.structured_json[key] === undefined || plan.structured_json[key] === null) continue;
    const result = schema.safeParse(plan.structured_json[key]);
    if (!result.success) for (const issue of result.error.issues) context.addIssue({ ...issue, path: ["structured_json", key, ...issue.path] });
  }
});
export const createTripSchema = z.object({
  title: z.string().trim().min(1).max(200),
  brief_json: StructuredTripBriefSchema,
  plan_json: savedPlanSchema,
  verification_flags: z.array(z.string()).max(100).optional()
}).strict();
export const updateTripSchema = createTripSchema.partial().refine(value => Object.keys(value).length > 0, "No changes supplied");
export const tripListQuerySchema = z.object({
  summary: z.enum(["1"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});
