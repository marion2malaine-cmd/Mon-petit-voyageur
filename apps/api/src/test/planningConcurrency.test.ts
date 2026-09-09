import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { buildServer } from "../server";
import { resetConfigCache } from "../config";
const state = vi.hoisted(() => ({ reject: undefined as undefined | ((error: Error) => void), calls: 0 }));
vi.mock("../orchestrator/orchestrator", () => ({ createOrchestrator: () => ({ planTrip: () => { state.calls++; return new Promise((_resolve, reject) => { state.reject = reject; }); } }) }));

it("reuses duplicate generation requests and rejects a different concurrent plan", async () => {
  const dir = mkdtempSync(join(tmpdir(), "plan-concurrency-"));
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("JWT_SECRET", "test-secret");
  vi.stubEnv("SQLITE_PATH", join(dir, "db.sqlite")); vi.stubEnv("STRIPE_SECRET_KEY", "");
  resetConfigCache(); const app = buildServer(); await app.ready();
  try {
    const registration = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "concurrency@example.com", password: "secure-test-password" } });
    const headers = { cookie: `mlt_token=${registration.cookies.find(c => c.name === "mlt_token")!.value}` };
    const request = { method: "POST" as const, url: "/api/trips/plan", headers, payload: { message: "Paris", locale: "fr" } };
    const first = await app.inject(request);
    expect(first.statusCode).toBe(202);
    const duplicate = await app.inject(request);
    expect(duplicate.statusCode).toBe(202);
    expect(duplicate.json().job_id).toBe(first.json().job_id);
    expect((await app.inject({ ...request, payload: { message: "Rome", locale: "fr" } })).statusCode).toBe(409);
    expect(state.calls).toBe(1);
    state.reject!(new Error("test interruption"));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect((await app.inject({ url: `/api/trips/plan/${first.json().job_id}`, headers })).json().status).toBe("error");
  } finally {
    state.reject?.(new Error("test cleanup"));
    await app.close(); resetConfigCache(); vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true });
  }
});
