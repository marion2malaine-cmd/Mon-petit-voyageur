import { randomUUID } from "node:crypto";
import type { AppDb } from "./db";

export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export function createUserSessions(db: AppDb) {
  db.raw.exec("CREATE TABLE IF NOT EXISTS user_sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL)");
  return {
    create(userId: number) {
      db.raw.prepare("DELETE FROM user_sessions WHERE expires_at <= ?").run(Date.now());
      const id = randomUUID();
      db.raw.prepare("INSERT INTO user_sessions VALUES(?,?,?)").run(id, userId, Date.now() + SESSION_SECONDS * 1000);
      return id;
    },
    valid(id: unknown, userId: number) {
      return typeof id === "string" && !!db.raw.prepare("SELECT 1 FROM user_sessions WHERE id=? AND user_id=? AND expires_at > ?").get(id, userId, Date.now());
    },
    revoke(id: unknown) { if (typeof id === "string") db.raw.prepare("DELETE FROM user_sessions WHERE id=?").run(id); }
  };
}
