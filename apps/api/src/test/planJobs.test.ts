import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it, expect } from "vitest";
import { initDb } from "../db";
import { createPlanJobs } from "../planJobs";

it("deduplicates active work, persists exact results and recovers expired reservations", () => {
  const dir = mkdtempSync(join(tmpdir(), "jobs-test-"));
  const db = initDb(join(dir, "db.sqlite"));
  try {
    const jobs = createPlanJobs(db);
    const first = jobs.start(1, { message: "Paris" });
    expect(jobs.start(1, { message: "Paris" })).toMatchObject({ id: first.id, duplicate: true });
    expect(jobs.start(1, { message: "Rome" }).busy).toBe(true);
    const other = jobs.start(2, { message: "Rome" });
    expect(other.busy).toBe(false);
    expect(jobs.get(first.id, 2)).toBeNull();
    jobs.finish(first.id, { trip_id: 4, run_id: first.id });
    expect(createPlanJobs(db).get(first.id, 1)).toMatchObject({ status: "done", result: { trip_id: 4, run_id: first.id } });
    db.raw.prepare("UPDATE planning_jobs SET heartbeat=0 WHERE id=?").run(other.id);
    expect(jobs.get(other.id, 2)).toMatchObject({ status: "error", error: "planning_interrupted" });
    expect(jobs.start(2, { message: "Rome" }).id).not.toBe(other.id);
  } finally { db.raw.close(); rmSync(dir, { recursive: true, force: true }); }
});
