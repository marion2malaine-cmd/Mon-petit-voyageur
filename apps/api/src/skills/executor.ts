import OpenAI from "openai";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { resolveLlmSettings, type AppConfig, type LlmSettings } from "../config";
import type { LiveTools } from "../tools";
import {
  runBudgetEstimator,
  runDestinationMatcher,
  runEntryRequirementsChecker,
  runFlightHotelResearch,
  runPackingChecklist,
  runTravelBriefParser,
  runTripSummaryExport,
  type HandlerContext
} from "./handlers";
import type { SkillDefinition, SkillRunResult } from "./types";

export interface ExecuteOptions {
  locale: "fr" | "en";
  explicit?: boolean;
}

export class SkillExecutor {
  private readonly client: OpenAI | null;
  private readonly llm: LlmSettings | null;

  constructor(
    private readonly config: AppConfig,
    private readonly tools: LiveTools,
    private readonly skillRegistry: Map<string, SkillDefinition>
  ) {
    this.llm = resolveLlmSettings(config);
    this.client = this.llm
      ? new OpenAI({ apiKey: this.llm.apiKey, baseURL: this.llm.baseURL })
      : null;
  }

  get hasLlm(): boolean {
    return !!this.client;
  }

  /**
   * Runs a skill through the LLM only, with no local fallback.
   *
   * Used by multi-phase skills (the itinerary is generated in several calls)
   * where a fallback handler cannot answer an individual phase: the caller
   * decides what to do when a phase returns null.
   */
  async runLlmOnly<T extends z.ZodTypeAny>(
    skillName: string,
    schema: T,
    input: unknown,
    locale: "fr" | "en"
  ): Promise<z.infer<T> | null> {
    const skill = this.skillRegistry.get(skillName);
    if (!skill || !this.client) return null;

    const result = await this.callLlmSkill(skill, schema, input, locale);
    const parsed = schema.safeParse(result.output);
    if (parsed.success) return parsed.data;

    const keys = result.output && typeof result.output === "object" ? Object.keys(result.output as object) : [];
    console.warn(
      `[skill:${skillName}] LLM output rejected: ${parsed.error.issues[0]?.message ?? "invalid"} at ${parsed.error.issues[0]?.path.join(".") || "root"}` +
        (keys.length ? ` (top-level keys: ${keys.slice(0, 8).join(", ")})` : " (empty answer, see the warning above)")
    );
    return null;
  }

  async run<T extends z.ZodTypeAny>(
    skillName: string,
    schema: T,
    input: unknown,
    options: ExecuteOptions
  ): Promise<SkillRunResult<z.infer<T>>> {
    const skill = this.skillRegistry.get(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    if (!skill.allowImplicitInvocation && !options.explicit) {
      throw new Error(`Skill requires explicit invocation: ${skillName}`);
    }

    const handlerContext: HandlerContext = {
      locale: options.locale,
      tools: this.tools
    };

    const attemptCandidates: Array<() => Promise<SkillRunResult<unknown>>> = [];

    if (this.client) {
      attemptCandidates.push(() => this.callLlmSkill(skill, schema, input, options.locale));
    }

    attemptCandidates.push(() => this.callFallbackHandler(skillName, input, handlerContext));
    attemptCandidates.push(() => this.callFallbackHandler(skillName, input, handlerContext));

    let lastError = "Validation failed";

    for (let index = 0; index < attemptCandidates.length; index += 1) {
      const result = await attemptCandidates[index]();
      const parsed = schema.safeParse(result.output);
      if (parsed.success) {
        return {
          output: parsed.data,
          meta: {
            ...result.meta,
            source: this.client && index === 0 ? "llm" : "fallback"
          }
        };
      }
      lastError = parsed.error.message;
    }

    throw new Error(`Skill output validation failed for ${skillName}: ${lastError}`);
  }

  private async callLlmSkill(
    skill: SkillDefinition,
    schema: z.ZodTypeAny,
    input: unknown,
    locale: "fr" | "en"
  ): Promise<SkillRunResult<unknown>> {
    if (!this.client || !this.llm) {
      throw new Error("LLM client not configured");
    }

    try {
      const jsonSchema = JSON.stringify(zodToJsonSchema(schema));

      // chat.completions + json_object works for both DeepSeek and OpenAI.
      const response = await this.client.chat.completions.create({
        model: this.llm.model,
        response_format: { type: "json_object" },
        // A two-day batch with three options and three tables each runs long;
        // the provider default (4k on DeepSeek) cut it off silently.
        max_tokens: 8192,
        // deepseek-v4-flash is a reasoning model: left on, its hidden thinking
        // ate the whole token budget and the visible answer came back empty
        // (finish_reason=length, 0 chars), so every plan fell back to the
        // local generator. Structured JSON does not need it.
        ...(this.llm.provider === "deepseek" ? { thinking: { type: "disabled" } } : {}),
        messages: [
          {
            role: "system",
            content:
              `You are the skill ${skill.name}. Follow the skill instructions exactly and return only a single JSON object.\n\n` +
              `${skill.body}\n\n` +
              `Your answer MUST be a JSON object that validates against this JSON Schema (all required fields, exact enum values, correct types):\n${jsonSchema}\n\n` +
              `Write every human-readable text field in the locale given by the user (fr = French, en = English).`
          },
          {
            role: "user",
            content: `Locale: ${locale}\nInput JSON:\n${JSON.stringify(input, null, 2)}`
          }
        ]
      });

      const choice = response.choices[0];
      // A truncated answer parses as broken JSON: say so explicitly, because
      // the symptom otherwise looks like a mysterious schema failure.
      if (choice?.finish_reason === "length") {
        console.warn(`[skill:${skill.name}] LLM answer hit the output token limit and was truncated`);
      }

      const text = choice?.message?.content ?? "";
      const json = safeJsonParse(text);
      if (!json) {
        console.warn(`[skill:${skill.name}] LLM answer is not JSON (finish_reason=${choice?.finish_reason ?? "?"}, ${text.length} chars): ${text.slice(0, 160).replace(/\s+/g, " ")}`);
        return { output: {}, meta: { toolStatuses: {} } };
      }

      return {
        output: json,
        meta: { toolStatuses: {} }
      };
    } catch (error) {
      // A rate limit, a timeout or an outage used to surface as a mysterious
      // "required field missing": name the real cause.
      const err = error as { status?: number; message?: string };
      console.warn(`[skill:${skill.name}] LLM call failed${err.status ? ` (HTTP ${err.status})` : ""}: ${err.message ?? String(error)}`);
      return { output: {}, meta: { toolStatuses: {} } };
    }
  }

  private async callFallbackHandler(
    skillName: string,
    input: unknown,
    ctx: HandlerContext
  ): Promise<SkillRunResult<unknown>> {
    switch (skillName) {
      case "travel-brief-parser":
        return runTravelBriefParser(input as any, ctx);
      case "destination-matcher":
        return runDestinationMatcher(input as any, ctx);
      case "budget-estimator":
        return runBudgetEstimator(input as any, ctx);
      case "flight-hotel-research":
        return runFlightHotelResearch(input as any, ctx);
      case "entry-requirements-checker":
        return runEntryRequirementsChecker(input as any, ctx);
      // No fallback for the program: the itinerary is written by the AI or
      // not at all (see ItineraryUnavailableError). A template-generated day
      // reads like a real one and tells the traveler nothing.
      case "packing-checklist":
        return runPackingChecklist(input as any, ctx);
      case "trip-summary-export":
        return runTripSummaryExport(input as any, ctx);
      default:
        throw new Error(`No fallback handler for skill: ${skillName}`);
    }
  }
}

function safeJsonParse(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
