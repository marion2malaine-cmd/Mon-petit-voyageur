import { degraded, errored, ok, type ToolContext, type ToolResult } from "./types";

interface ExchangeInput {
  from: string;
  to: string;
}

export async function getExchangeRate(
  ctx: ToolContext,
  input: ExchangeInput
): Promise<ToolResult<unknown>> {
  const fetchFn = ctx.fetchFn ?? fetch;
  try {
    const from = input.from.toUpperCase();
    const to = input.to.toUpperCase();

    if (from === to) {
      return degraded("frankfurter", { from, to, rate: 1 }, ["Same currency conversion requested"], null);
    }

    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const response = await fetchFn(url);
    if (!response.ok) {
      return errored("frankfurter", `Exchange rate request failed (${response.status})`, url);
    }

    const json = (await response.json()) as any;
    return ok(
      "frankfurter",
      {
        from,
        to,
        rate: json.rates?.[to] ?? null,
        date: json.date ?? null
      },
      url
    );
  } catch (error) {
    return errored("frankfurter", `Exchange rate error: ${(error as Error).message}`);
  }
}
