import type { ToolResponse } from "@mlt/contracts";
import type { AppConfig } from "../config";

export interface ToolContext {
  config: AppConfig;
  fetchFn?: typeof fetch;
}

export type ToolResult<T> = ToolResponse<T>;

export function ok<T>(source: string, data: T, rawRef: string | null = null): ToolResult<T> {
  return {
    status: "ok",
    source,
    verified_at: new Date().toISOString(),
    data,
    warnings: [],
    raw_ref: rawRef
  };
}

export function degraded<T>(
  source: string,
  data: T,
  warnings: string[],
  rawRef: string | null = null
): ToolResult<T> {
  return {
    status: "degraded",
    source,
    verified_at: null,
    data,
    warnings,
    raw_ref: rawRef
  };
}

export function errored(source: string, error: string, rawRef: string | null = null): ToolResult<null> {
  return {
    status: "error",
    source,
    verified_at: null,
    data: null,
    warnings: [error],
    raw_ref: rawRef
  };
}
