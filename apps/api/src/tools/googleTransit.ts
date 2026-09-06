import { degraded, errored, ok, type ToolContext, type ToolResult } from "./types";

interface TransitInput {
  origin: string;
  destination: string;
}

export async function getLocalTransportInfo(
  ctx: ToolContext,
  input: TransitInput
): Promise<ToolResult<unknown>> {
  const fetchFn = ctx.fetchFn ?? fetch;
  if (!ctx.config.GOOGLE_MAPS_API_KEY) {
    return degraded(
      "google-maps-directions",
      { routes: [] },
      ["GOOGLE_MAPS_API_KEY is missing, returning fallback transport guidance"],
      null
    );
  }

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(input.origin)}&destination=${encodeURIComponent(input.destination)}&mode=transit&key=${encodeURIComponent(ctx.config.GOOGLE_MAPS_API_KEY)}`;

  try {
    const response = await fetchFn(url);
    if (!response.ok) {
      return errored("google-maps-directions", `Transit request failed (${response.status})`, url);
    }
    const data = (await response.json()) as any;

    if (data.status !== "OK") {
      return degraded("google-maps-directions", { routes: [] }, [data.status ?? "No transit route"], url);
    }

    const routes = (data.routes ?? []).slice(0, 3).map((route: any) => {
      const leg = route.legs?.[0];
      return {
        duration: leg?.duration?.text ?? null,
        distance: leg?.distance?.text ?? null,
        summary: route.summary ?? null
      };
    });

    return ok("google-maps-directions", { routes }, url);
  } catch (error) {
    return errored("google-maps-directions", `Transit error: ${(error as Error).message}`);
  }
}
