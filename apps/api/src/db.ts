import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { StructuredTripBrief, PlanTripResponse } from "@mlt/contracts";

export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export interface UserRecord {
  id: number;
  email: string;
  password_hash: string;
  preferred_language: "fr" | "en";
  created_at: string;
  // Billing. Filled by Stripe webhooks; "none" until the user subscribes.
  google_id: string | null;
  stripe_customer_id: string | null;
  subscription_status: SubscriptionStatus;
  subscription_plan: string | null;
  current_period_end: string | null;
  // 1 once a free trial has been consumed, so a second checkout starts paid.
  trial_used: number;
  complimentary_unlimited?: number;
}

export interface BillingUpdate {
  userId: number;
  stripeCustomerId?: string | null;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionPlan?: string | null;
  currentPeriodEnd?: string | null;
  trialUsed?: boolean;
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
  createUser(input: { email: string; passwordHash: string; preferredLanguage: "fr" | "en"; googleId?: string }): UserRecord;
  upsertUser(input: { email: string; passwordHash: string; preferredLanguage: "fr" | "en" }): UserRecord;
  findUserByEmail(email: string): UserRecord | null;
  findUserById(id: number): UserRecord | null;
  findUserByGoogleId(googleId: string): UserRecord | null;
  findUserByStripeCustomerId(customerId: string): UserRecord | null;
  linkGoogleId(userId: number, googleId: string): void;
  updateBilling(input: BillingUpdate): void;
  createTrip(input: {
    userId: number;
    title: string;
    brief: StructuredTripBrief;
    plan: PlanTripResponse;
    verificationFlags: string[];
  }): number;
  listTrips(userId: number): unknown[];
  listTripSummaries(userId: number, limit: number, offset: number): unknown[];
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

    CREATE TABLE IF NOT EXISTS admin_generations (
      run_id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, trip_id INTEGER,
      status TEXT NOT NULL, started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT, duration_ms INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
    CREATE INDEX IF NOT EXISTS idx_trip_runs_trip_id ON trip_runs(trip_id);
  `);

  // Billing columns are added in place so existing databases keep their data.
  const userColumns = new Set(
    (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name)
  );
  const addColumn = (name: string, definition: string) => {
    if (!userColumns.has(name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
  };
  addColumn("google_id", "TEXT");
  addColumn("stripe_customer_id", "TEXT");
  addColumn("subscription_status", "TEXT NOT NULL DEFAULT 'none'");
  addColumn("subscription_plan", "TEXT");
  addColumn("current_period_end", "TEXT");
  addColumn("trial_used", "INTEGER NOT NULL DEFAULT 0");
  addColumn("complimentary_unlimited", "INTEGER NOT NULL DEFAULT 0");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL");
  db.exec("CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id)");

  return {
    raw: db,
    createUser(input) {
      const stmt = db.prepare(
        "INSERT INTO users(email, password_hash, preferred_language, google_id) VALUES(?, ?, ?, ?)"
      );
      const result = stmt.run(
        input.email.toLowerCase(),
        input.passwordHash,
        input.preferredLanguage,
        input.googleId ?? null
      );
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
    findUserByGoogleId(googleId) {
      const row = db.prepare("SELECT * FROM users WHERE google_id = ? LIMIT 1").get(googleId) as
        | UserRecord
        | undefined;
      return row ?? null;
    },
    findUserByStripeCustomerId(customerId) {
      const row = db
        .prepare("SELECT * FROM users WHERE stripe_customer_id = ? LIMIT 1")
        .get(customerId) as UserRecord | undefined;
      return row ?? null;
    },
    linkGoogleId(userId, googleId) {
      db.prepare("UPDATE users SET google_id = ? WHERE id = ?").run(googleId, userId);
    },
    updateBilling(input) {
      const sets: string[] = [];
      const values: unknown[] = [];
      const push = (column: string, value: unknown) => {
        sets.push(`${column} = ?`);
        values.push(value);
      };
      if (input.stripeCustomerId !== undefined) push("stripe_customer_id", input.stripeCustomerId);
      if (input.subscriptionStatus !== undefined) push("subscription_status", input.subscriptionStatus);
      if (input.subscriptionPlan !== undefined) push("subscription_plan", input.subscriptionPlan);
      if (input.currentPeriodEnd !== undefined) push("current_period_end", input.currentPeriodEnd);
      if (input.trialUsed !== undefined) push("trial_used", input.trialUsed ? 1 : 0);
      if (sets.length === 0) return;
      values.push(input.userId);
      db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...values);
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
    listTripSummaries(userId, limit, offset) {
      const rows = db.prepare("SELECT id, title, brief_json, created_at, updated_at FROM trips WHERE user_id=? ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?").all(userId, limit, offset) as { brief_json: string }[];
      return rows.map(row => ({ ...row, brief_json: JSON.parse(row.brief_json) }));
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
