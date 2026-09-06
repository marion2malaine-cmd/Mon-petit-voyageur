import type { z } from "zod";

export interface SkillDefinition {
  name: string;
  description: string;
  body: string;
  allowImplicitInvocation: boolean;
  path: string;
}

export interface SkillRunMeta {
  toolStatuses: Record<string, "ok" | "degraded" | "error">;
  source?: "llm" | "fallback" | "tools";
}

export interface SkillRunResult<T> {
  output: T;
  meta: SkillRunMeta;
}

export type AnyZodSchema = z.ZodTypeAny;
