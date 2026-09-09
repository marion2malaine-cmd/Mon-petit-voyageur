import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildServer } from "../server";
import { resetConfigCache } from "../config";

let app: ReturnType<typeof buildServer>;
let dir: string;
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "trip-reliability-"));
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("JWT_SECRET", "test-session-secret");
  vi.stubEnv("SQLITE_PATH", join(dir, "db.sqlite"));
  resetConfigCache(); app = buildServer(); await app.ready();
});
afterEach(async () => { await app.close(); resetConfigCache(); vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });
async function register(email = "reliability@example.com") {
  const response = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email, password: "secure-test-password", preferred_language: "fr" } });
  expect(response.statusCode).toBe(200);
  return { cookie: `mlt_token=${response.cookies.find(c => c.name === "mlt_token")!.value}` };
}
it("expires user tokens and revokes the exact session on logout", async () => {
  const headers = await register();
  const token = headers.cookie.split("=")[1];
  const claims = app.jwt.decode(token) as { exp: number; iat: number; userId: number; sid: string };
  expect(claims.exp - claims.iat).toBe(7 * 24 * 60 * 60);
  const expired = app.jwt.sign({ userId: claims.userId, sid: claims.sid, exp: 1 });
  expect((await app.inject({ url: "/api/trips", headers: { authorization: `Bearer ${expired}` } })).statusCode).toBe(401);
  expect((await app.inject({ url: "/api/trips", headers })).statusCode).toBe(200);
  expect((await app.inject({ method: "POST", url: "/api/auth/logout", headers })).statusCode).toBe(200);
  expect((await app.inject({ url: "/api/trips", headers })).statusCode).toBe(401);
});
it("rejects malformed writes and paginates summaries without complete plans", async () => {
  const headers = await register();
  const payload = { title: "Paris", brief_json: {}, plan_json: { traveler_summary: "Paris", final_trip_plan: {}, structured_json: {}, open_verifications: [], next_steps: [], trace: [] } };
  expect((await app.inject({ method: "POST", url: "/api/trips", headers, payload: { ...payload, plan_json: {} } })).statusCode).toBe(400);
  expect((await app.inject({ method: "POST", url: "/api/trips", headers, payload: { ...payload, plan_json: { ...payload.plan_json, structured_json: { itinerary: { itinerary_by_day: "bad" } } } } })).statusCode).toBe(400);
  const first = await app.inject({ method: "POST", url: "/api/trips", headers, payload });
  expect(first.statusCode).toBe(200);
  const id = first.json().id;
  expect((await app.inject({ method: "PUT", url: `/api/trips/${id}`, headers, payload: { plan_json: [] } })).statusCode).toBe(400);
  await app.inject({ method: "POST", url: "/api/trips", headers, payload: { ...payload, title: "Rome" } });
  const page = (await app.inject({ url: "/api/trips?summary=1&limit=1", headers })).json();
  expect(page).toHaveLength(1); expect(page[0].title).toBe("Rome"); expect(page[0]).not.toHaveProperty("plan_json");
  const next = (await app.inject({ url: "/api/trips?summary=1&limit=1&offset=1", headers })).json();
  expect(next[0].id).toBe(id);
  expect((await app.inject({ url: `/api/trips/${id}`, headers })).json().plan_json).toEqual(payload.plan_json);
  expect((await app.inject({ url: "/api/trips?summary=1&limit=1000", headers })).statusCode).toBe(400);
  const stranger = await register("stranger@example.com");
  expect((await app.inject({ url: `/api/trips/${id}`, headers: stranger })).statusCode).toBe(404);
});
