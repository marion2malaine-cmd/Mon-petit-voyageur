import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../api";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe("planning request recovery", () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.useFakeTimers(); fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("stops polling and requests login on a lost session", async () => {
    const expired = vi.fn();
    window.addEventListener("mlt:session-expired", expired);
    fetchMock.mockResolvedValueOnce(response({ job_id: "one" })).mockResolvedValueOnce(response({ error: "Unauthorized" }, 401));
    const pending = api.planTrip({ message: "Paris", locale: "fr" });
    const assertion = expect(pending).rejects.toMatchObject({ status: 401 });
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
    await vi.advanceTimersByTimeAsync(9000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener("mlt:session-expired", expired);
  });

  it("recovers from a temporary network failure without starting a second trip", async () => {
    const result = { trip_id: 7, traveler_summary: "Paris" };
    fetchMock.mockResolvedValueOnce(response({ job_id: "one" }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(response({ status: "done", result }));
    const pending = api.planTrip({ message: "Paris", locale: "fr" });
    await vi.advanceTimersByTimeAsync(6000);
    expect(await pending).toEqual(result);
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(1);
  });

  it("does not retry an access refusal", async () => {
    fetchMock.mockResolvedValueOnce(response({ job_id: "one" })).mockResolvedValueOnce(response({ error: "forbidden" }, 403));
    const pending = api.planTrip({ message: "Paris", locale: "fr" });
    const assertion = expect(pending).rejects.toBeInstanceOf(ApiError);
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bounds polling when the server never finishes", async () => {
    fetchMock.mockResolvedValueOnce(response({ job_id: "one" })).mockImplementation(async () => response({ status: "running" }));
    const pending = api.planTrip({ message: "Paris", locale: "fr" });
    const assertion = expect(pending).rejects.toThrow("planning_timeout");
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    await assertion;
  });

  it("stops saved-trip recovery on a lost session too", async () => {
    fetchMock.mockResolvedValueOnce(response({ job_id: "one" }))
      .mockResolvedValueOnce(response({ error: "job_not_found" }, 404))
      .mockResolvedValueOnce(response({ error: "Unauthorized" }, 401));
    const pending = api.planTrip({ message: "Paris", locale: "fr" });
    const assertion = expect(pending).rejects.toMatchObject({ status: 401 });
    await vi.advanceTimersByTimeAsync(9000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
