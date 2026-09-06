import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../server";
import { resetConfigCache } from "../config";

describe("auth + plan flow", () => {
  let app: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.PORT = "8787";
    process.env.JWT_SECRET = "test-secret";
    process.env.SQLITE_PATH = path.join(os.tmpdir(), `mlt-${randomUUID()}.sqlite`);
    delete process.env.OPENAI_API_KEY;
    delete process.env.SERPAPI_API_KEY;
    delete process.env.SHERPA_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;

    resetConfigCache();
    app = buildServer();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    resetConfigCache();
  });

  it("registers and plans a trip", async () => {
    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "test@example.com",
        password: "supersecure123",
        preferred_language: "fr"
      }
    });

    expect(registerRes.statusCode).toBe(200);
    const cookie = registerRes.cookies.find((c) => c.name === "mlt_token");
    expect(cookie).toBeTruthy();

    const planRes = await app.inject({
      method: "POST",
      url: "/api/trips/plan",
      headers: {
        cookie: `mlt_token=${cookie?.value}`
      },
      payload: {
        message: "Je veux partir 6 jours en septembre, budget 1500 €, départ de Lyon, mer et calme",
        locale: "fr"
      }
    });

    // Planning is a job: the request answers at once, the result is polled.
    expect(planRes.statusCode).toBe(202);
    const { job_id } = planRes.json();
    expect(job_id).toBeTypeOf("string");

    let data: any = null;
    for (let attempt = 0; attempt < 200 && !data; attempt += 1) {
      const pollRes = await app.inject({ method: "GET", url: `/api/trips/plan/${job_id}`, headers: { cookie: `mlt_token=${cookie?.value}` } });
      expect(pollRes.statusCode).toBe(200);
      const job = pollRes.json();
      if (job.status === "error") throw new Error(job.error);
      if (job.status === "done") data = job.result;
      else await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(data).toBeTruthy();
    expect(data.traveler_summary).toBeTypeOf("string");
    expect(Array.isArray(data.trace)).toBe(true);
    expect(data.trace.some((step: any) => step.skill === "travel-brief-parser")).toBe(true);

    const listRes = await app.inject({
      method: "GET",
      url: "/api/trips",
      headers: {
        cookie: `mlt_token=${cookie?.value}`
      }
    });

    expect(listRes.statusCode).toBe(200);
    const trips = listRes.json();
    expect(Array.isArray(trips)).toBe(true);
    expect(trips.length).toBeGreaterThan(0);
  });
});
