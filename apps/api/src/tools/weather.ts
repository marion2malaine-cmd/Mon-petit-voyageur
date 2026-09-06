import { degraded, errored, ok, type ToolContext, type ToolResult } from "./types";

interface WeatherInput {
  city: string;
}

export async function getWeather(ctx: ToolContext, input: WeatherInput): Promise<ToolResult<unknown>> {
  const fetchFn = ctx.fetchFn ?? fetch;
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input.city)}&count=1`;
    const geoResponse = await fetchFn(geoUrl);
    if (!geoResponse.ok) {
      return errored("open-meteo", `Geocoding failed (${geoResponse.status})`, geoUrl);
    }
    const geoData = (await geoResponse.json()) as any;
    const hit = geoData.results?.[0];
    if (!hit) {
      return degraded("open-meteo", { city: input.city }, ["No geocoding result for city"], geoUrl);
    }

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const weatherRes = await fetchFn(weatherUrl);
    if (!weatherRes.ok) {
      return errored("open-meteo", `Forecast failed (${weatherRes.status})`, weatherUrl);
    }

    const weatherData = await weatherRes.json();
    return ok(
      "open-meteo",
      {
        city: hit.name,
        country: hit.country,
        forecast: weatherData
      },
      weatherUrl
    );
  } catch (error) {
    return errored("open-meteo", `Weather error: ${(error as Error).message}`);
  }
}
