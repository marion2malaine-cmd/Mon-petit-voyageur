import { createHash, randomUUID } from "node:crypto";
import type { AppDb } from "./db";

const LEASE_MS = 60_000;
interface Job { id: string; user_id: number; fingerprint: string; status: string; started_at: number; heartbeat: number; result: string | null; error: string | null }

export function createPlanJobs(db: AppDb) {
  db.raw.exec(`CREATE TABLE IF NOT EXISTS planning_jobs (
    id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, fingerprint TEXT NOT NULL,
    status TEXT NOT NULL, started_at INTEGER NOT NULL, heartbeat INTEGER NOT NULL,
    result TEXT, error TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS one_running_plan_per_user ON planning_jobs(user_id) WHERE status='running';`);
  function expire() {
    db.raw.prepare("UPDATE planning_jobs SET status='error', error='planning_interrupted' WHERE status='running' AND heartbeat < ?").run(Date.now() - LEASE_MS);
  }
  return {
    start: db.raw.transaction((userId: number, input: unknown) => {
      expire();
      const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      const current = db.raw.prepare("SELECT * FROM planning_jobs WHERE user_id=? AND status='running'").get(userId) as Job | undefined;
      if (current) return { id: current.id, duplicate: current.fingerprint === fingerprint, busy: current.fingerprint !== fingerprint };
      const id = randomUUID();
      db.raw.prepare("INSERT INTO planning_jobs(id,user_id,fingerprint,status,started_at,heartbeat) VALUES(?,?,?,'running',?,?)").run(id, userId, fingerprint, Date.now(), Date.now());
      return { id, duplicate: false, busy: false };
    }),
    heartbeat(id: string) { db.raw.prepare("UPDATE planning_jobs SET heartbeat=? WHERE id=? AND status='running'").run(Date.now(), id); },
    finish(id: string, result: unknown) { db.raw.prepare("UPDATE planning_jobs SET status='done', result=?, error=NULL WHERE id=?").run(JSON.stringify(result), id); },
    fail(id: string, error: string) { db.raw.prepare("UPDATE planning_jobs SET status='error', error=? WHERE id=?").run(error, id); },
    get(id: string, userId: number) {
      expire();
      const row = db.raw.prepare("SELECT * FROM planning_jobs WHERE id=? AND user_id=?").get(id, userId) as Job | undefined;
      if (!row) return null;
      return { status: row.status, elapsed_ms: Date.now() - row.started_at, ...(row.result ? { result: JSON.parse(row.result) } : {}), ...(row.error ? { error: row.error } : {}) };
    }
  };
}
