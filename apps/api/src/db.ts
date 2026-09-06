import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { StructuredTripBrief, PlanTripResponse } from "@mlt/contracts";

export interface UserRecord {
  id: number;
  email: string;
  password_hash: string;
  preferred_language: "fr" | "en";
  created_at: string;
}

export interface TripRunInsert {
  trip_id: number;
  user_id: number;
  run_id: string;
  input_message: string;
  locale: "fr" | "en";
  trace_json: unknown;
  status: "ok" | "error";
}

export interface AppDb {
  raw: Database.Database;
  createUser(input: { email: string; passwordHash: string; preferredLanguage: "fr" | "en" }): UserRecord;
  upsertUser(input: { email: string; passwordHash: string; preferredLanguage: "fr" | "en" }): UserRecord;
  findUserByEmail(email: string): UserRecord | null;
  findUserById(id: number): UserRecord | null;
  createTrip(input: {
    userId: number;
    title: string;
    brief: StructuredTripBrief;
    plan: PlanTripResponse;
    verificationFlags: string[];
  }): number;
  listTrips(userId: number): unknown[];
  getTrip(userId: number, tripId: number): unknown | null;
  updateTrip(input: {
    userId: number;
    tripId: number;
    title?: string;
    brief?: StructuredTripBrief;
    plan?: PlanTripResponse;
    verificationFlags?: string[];
  }): void;
  insertTripRun(input: TripRunInsert): void;
}

export function initDb(sqlitePath: string): AppDb {
  const absolutePath = path.resolve(sqlitePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

  const db = new Database(absolutePath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      preferred_language TEXT NOT NULL DEFAULT 'fr',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      brief_json TEXT NOT NULL,
      plan_json TEXT NOT NULL,
      verification_flags TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS trip_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      run_id TEXT NOT NULL,
      input_message TEXT NOT NULL,
      locale TEXT NOT NULL,
      trace_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(trip_id) REFERENCES trips(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
    CREATE INDEX IF NOT EXISTS idx_trip_runs_trip_id ON trip_runs(trip_id);
  `);

  return {
    raw: db,
    createUser(input) {
      const stmt = db.prepare(
        "INSERT INTO users(email, password_hash, preferred_language) VALUES(?, ?, ?)"
      );
      const result = stmt.run(input.email.toLowerCase(), input.passwordHash, input.preferredLanguage);
      return this.findUserById(Number(result.lastInsertRowid))!;
    },
    upsertUser(input) {
      const email = input.email.toLowerCase();
      const existing = this.findUserByEmail(email);

      if (!existing) {
        return this.createUser(input);
      }

      db.prepare(
        `UPDATE users
         SET password_hash = ?,
             preferred_language = ?
         WHERE email = ?`
      ).run(input.passwordHash, input.preferredLanguage, email);

      return this.findUserByEmail(email)!;
    },
    findUserByEmail(email) {
      const stmt = db.prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
      const row = stmt.get(email.toLowerCase()) as UserRecord | undefined;
      return row ?? null;
    },
    findUserById(id) {
      const stmt = db.prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
      const row = stmt.get(id) as UserRecord | undefined;
      return row ?? null;
    },
    createTrip(input) {
      const stmt = db.prepare(
        `INSERT INTO trips(user_id, title, brief_json, plan_json, verification_flags)
         VALUES(?, ?, ?, ?, ?)`
      );
      const result = stmt.run(
        input.userId,
        input.title,
        JSON.stringify(input.brief),
        JSON.stringify(input.plan),
        JSON.stringify(input.verificationFlags)
      );
      return Number(result.lastInsertRowid);
    },
    listTrips(userId) {
      const stmt = db.prepare(
        `SELECT id, user_id, title, brief_json, plan_json, verification_flags, created_at, updated_at
         FROM trips WHERE user_id = ? ORDER BY updated_at DESC`
      );
      const rows = stmt.all(userId) as any[];
      return rows.map(parseTripRow);
    },
    getTrip(userId, tripId) {
      const stmt = db.prepare(
        `SELECT id, user_id, title, brief_json, plan_json, verification_flags, created_at, updated_at
         FROM trips WHERE user_id = ? AND id = ? LIMIT 1`
      );
      const row = stmt.get(userId, tripId) as any | undefined;
      return row ? parseTripRow(row) : null;
    },
    updateTrip(input) {
      const existing = this.getTrip(input.userId, input.tripId) as any;
      if (!existing) {
        return;
      }

      const stmt = db.prepare(
        `UPDATE trips
         SET title = ?,
             brief_json = ?,
             plan_json = ?,
             verification_flags = ?,
             updated_at = datetime('now')
         WHERE user_id = ? AND id = ?`
      );

      stmt.run(
        input.title ?? existing.title,
        JSON.stringify(input.brief ?? existing.brief_json),
        JSON.stringify(input.plan ?? existing.plan_json),
        JSON.stringify(input.verificationFlags ?? existing.verification_flags),
        input.userId,
        input.tripId
      );
    },
    insertTripRun(input) {
      const stmt = db.prepare(
        `INSERT INTO trip_runs(trip_id, user_id, run_id, input_message, locale, trace_json, status)
         VALUES(?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run(
        input.trip_id,
        input.user_id,
        input.run_id,
        input.input_message,
        input.locale,
        JSON.stringify(input.trace_json),
        input.status
      );
    }
  };
}

function parseTripRow(row: any) {
  return {
    ...row,
    brief_json: JSON.parse(row.brief_json),
    plan_json: JSON.parse(row.plan_json),
    verification_flags: JSON.parse(row.verification_flags)
  };
}
