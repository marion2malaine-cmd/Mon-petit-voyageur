import { degraded, errored, ok, type ToolContext, type ToolResult } from "./types";

interface EntryInput {
  nationality: string;
  destination: string;
  departureDate?: string | null;
  returnDate?: string | null;
}

export async function getEntryRequirements(
  ctx: ToolContext,
  input: EntryInput
): Promise<ToolResult<unknown>> {
  const fetchFn = ctx.fetchFn ?? fetch;
  if (!ctx.config.SHERPA_API_KEY) {
    return degraded(
      "sherpa",
      {
        verification_status: "unverified",
        requirements: []
      },
      ["SHERPA_API_KEY is missing; entry requirements are unverified"],
      null
    );
  }

  try {
    const departureDate = input.departureDate ?? nextDate(30);
    const returnDate = input.returnDate ?? nextDate(37);

    const body = {
      citizenship: input.nationality,
      destination: input.destination,
      departure_date: departureDate,
      return_date: returnDate
    };

    const url = `${ctx.config.SHERPA_BASE_URL}/v2/entry-requirements`;
    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ctx.config.SHERPA_API_KEY
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      return degraded(
        "sherpa",
        {
          verification_status: "unknown",
          requirements: []
        },
        [`Sherpa endpoint returned ${response.status}`],
        url
      );
    }

    const json = await response.json();
    return ok(
      "sherpa",
      {
        verification_status: "verified",
        requirements: json
      },
      url
    );
  } catch (error) {
    return errored("sherpa", `Entry requirements error: ${(error as Error).message}`);
  }
}

function nextDate(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}
