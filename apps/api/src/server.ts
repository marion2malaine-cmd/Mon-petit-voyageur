import type { z } from "zod";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { randomUUID } from "node:crypto";
import {
  AuthLoginRequestSchema,
  AuthRegisterRequestSchema,
  GuideEmailRequestSchema,
  PlanTripRequestSchema,
  type PlanTripResponse,
  StructuredTripBriefSchema
} from "@mlt/contracts";
import { getConfig } from "./config";
import { hashPassword, verifyPassword } from "./auth";
import { initDb } from "./db";
import { createTools } from "./tools";
import { loadSkillRegistry } from "./skills/registry";
import { createOrchestrator } from "./orchestrator/orchestrator";
import { embedItineraryPhotos, locateItinerary, resolveItineraryPhotos } from "./orchestrator/enrichItinerary";
import { renderGuideHtml } from "./guide/renderGuide";
import { mapRouteForDay } from "./guide/renderGuide";
import { stillMapDataUri } from "./guide/staticMap";
import { renderPdf } from "./guide/pdf";
import { Mailer } from "./tools/mailer";

interface PlanJob {
  userId: number;
  status: "running" | "done" | "error";
  startedAt: number;
  result?: PlanTripResponse & { trip_id: number; run_id: string };
  error?: string;
}
const planJobs = new Map<string, PlanJob>();
const PLAN_JOB_TTL_MS = 30 * 60 * 1000;

/** How many trips are being planned right now — a restart must wait for them. */
export function runningPlanJobs(): number {
  let running = 0;
  for (const job of planJobs.values()) if (job.status === "running") running += 1;
  return running;
}

const DEV_SEED_USER = {
  email: "marion2malaine@gmail.com",
  password: "MonPetitVoyageur123!",
  preferred_language: "fr" as const
};

export function buildServer() {
  const config = getConfig();
  const db = initDb(config.SQLITE_PATH);
  const tools = createTools(config, db);
  const skillRegistry = loadSkillRegistry();
  const orchestrator = createOrchestrator(config, tools, skillRegistry);
  const mailer = new Mailer(config);

  /**
   * Session cookie attributes.
   *
   * "none" is required so the iOS app (capacitor://localhost) can send the
   * cookie cross-origin, but browsers drop a SameSite=None cookie that is not
   * Secure — which silently broke login on http://localhost. In development
   * the cookie is therefore "lax": SameSite is per-site, not per-port, so it
   * still travels from the web app on :5173 to the API on :8787.
   */
  const sessionCookieOptions =
    config.NODE_ENV === "production"
      ? { httpOnly: true, sameSite: "none" as const, secure: true, path: "/" }
      : { httpOnly: true, sameSite: "lax" as const, path: "/" };

  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "test" ? "warn" : "info"
    }
  });

  app.register(cors, {
    origin: true,
    credentials: true
  });

  app.register(cookie);

  app.register(jwt, {
    secret: config.JWT_SECRET,
    cookie: {
      cookieName: "mlt_token",
      signed: false
    }
  });

  app.decorate("authenticate", async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });

  app.addHook("onReady", async () => {
    if (config.NODE_ENV !== "development") {
      return;
    }

    const passwordHash = await hashPassword(DEV_SEED_USER.password);
    db.upsertUser({
      email: DEV_SEED_USER.email,
      passwordHash,
      preferredLanguage: DEV_SEED_USER.preferred_language
    });

    app.log.info({ email: DEV_SEED_USER.email }, "Development test user is ready");
  });

  app.get("/api/health", async () => ({ ok: true }));

  app.post("/api/auth/register", async (request, reply) => {
    const parsed = AuthRegisterRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const existing = db.findUserByEmail(parsed.data.email);
    if (existing) {
      return reply.code(409).send({ error: "Email already registered" });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = db.createUser({
      email: parsed.data.email,
      passwordHash,
      preferredLanguage: parsed.data.preferred_language
    });

    const token = await reply.jwtSign({ userId: user.id, email: user.email });
    reply.setCookie("mlt_token", token, sessionCookieOptions);

    return {
      id: user.id,
      email: user.email,
      preferred_language: user.preferred_language
    };
  });

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = AuthLoginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const user = db.findUserByEmail(parsed.data.email);
    if (!user) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const ok = await verifyPassword(parsed.data.password, user.password_hash);
    if (!ok) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const token = await reply.jwtSign({ userId: user.id, email: user.email });
    reply.setCookie("mlt_token", token, sessionCookieOptions);

    return {
      id: user.id,
      email: user.email,
      preferred_language: user.preferred_language
    };
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    reply.clearCookie("mlt_token", {
      path: "/"
    });
    return { ok: true };
  });

  app.get("/api/auth/me", { preHandler: (app as any).authenticate }, async (request: any, reply) => {
    const userId = request.user?.userId;
    const user = db.findUserById(userId);
    if (!user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    return {
      id: user.id,
      email: user.email,
      preferred_language: user.preferred_language
    };
  });

  /**
   * Planning takes one to four minutes. Holding an HTTP request open that long
   * dies on proxies and on any restart, so the work runs as a job: this call
   * answers at once with a job id and the client polls the job until done.
   * The trip itself is saved as soon as the plan exists, so a lost job never
   * loses a finished plan.
   */
  app.post("/api/trips/plan", { preHandler: (app as any).authenticate }, async (request: any, reply) => {
    const parsed = PlanTripRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.user?.userId as number;
    const runId = randomUUID();
    const job: PlanJob = { userId, status: "running", startedAt: Date.now() };
    planJobs.set(runId, job);

    void (async () => {
      try {
        job.result = await runPlan(parsed.data, userId, runId);
        job.status = "done";
      } catch (error) {
        job.status = "error";
        job.error = (error as Error).message || "planning_failed";
        app.log.error({ err: error, run_id: runId }, "Trip planning run failed");
      }
      // Finished jobs are kept a while so a slow poll still finds them.
      setTimeout(() => planJobs.delete(runId), PLAN_JOB_TTL_MS).unref();
    })();

    return reply.code(202).send({ job_id: runId, status: "running" });
  });

  app.get("/api/trips/plan/:jobId", { preHandler: (app as any).authenticate }, async (request: any, reply) => {
    const job = planJobs.get(String(request.params.jobId));
    if (!job || job.userId !== request.user?.userId) {
      return reply.code(404).send({ error: "job_not_found" });
    }
    return {
      status: job.status,
      elapsed_ms: Date.now() - job.startedAt,
      ...(job.status === "done" ? { result: job.result } : {}),
      ...(job.status === "error" ? { error: job.error } : {})
    };
  });

  async function runPlan(
    input: z.infer<typeof PlanTripRequestSchema>,
    userId: number,
    runId: string
  ): Promise<PlanTripResponse & { trip_id: number; run_id: string }> {
    const result = await orchestrator.planTrip(input);

    let tripId = input.trip_id;
    const brief = StructuredTripBriefSchema.parse(result.structured_json?.brief ?? {});

    const saveToolResult = await tools.save_trip({
      userId,
      tripId,
      title: buildTripTitle(result),
      brief,
      plan: result,
      verificationFlags: result.open_verifications
    });
    tripId = (saveToolResult.data as { trip_id: number }).trip_id;

    db.insertTripRun({
      trip_id: tripId,
      user_id: userId,
      run_id: runId,
      input_message: input.message,
      locale: input.locale,
      trace_json: result.trace,
      status: "ok"
    });

    app.log.info({ run_id: runId, trip_id: tripId, tool_statuses: flattenToolStatuses(result) }, "Trip planning run completed");

    return { ...result, trip_id: tripId, run_id: runId };
  }

  app.post("/api/trips", { preHandler: (app as any).authenticate }, async (request: any, reply) => {
    const body = request.body as any;
    if (!body?.title || !body?.brief_json || !body?.plan_json) {
      return reply.code(400).send({ error: "Missing required fields" });
    }

    const tripId = db.createTrip({
      userId: request.user.userId,
      title: body.title,
      brief: StructuredTripBriefSchema.parse(body.brief_json),
      plan: body.plan_json,
      verificationFlags: body.verification_flags ?? []
    });

    return db.getTrip(request.user.userId, tripId);
  });

  app.get("/api/trips", { preHandler: (app as any).authenticate }, async (request: any) => {
    return db.listTrips(request.user.userId);
  });

  app.get("/api/trips/:id", { preHandler: (app as any).authenticate }, async (request: any, reply) => {
    const tripId = Number(request.params.id);
    const trip = db.getTrip(request.user.userId, tripId);
    if (!trip) {
      return reply.code(404).send({ error: "Trip not found" });
    }

    return trip;
  });

  // The guide is fetched with credentials by the web app, which then saves the
  // blob: a plain <a download> to another origin would not carry the session
  // cookie. `?format=html` serves the document directly for a browser preview.
  /**
   * Builds the guide for a trip, resolving and caching its photos on the way.
   * Shared by the download route and the email route.
   */
  async function buildGuide(userId: number, tripId: number, options: { locale?: string; embed: boolean }) {
    const trip = db.getTrip(userId, tripId) as any;
    if (!trip) return null;

    const user = db.findUserById(userId);
    const locale = (options.locale ?? user?.preferred_language ?? "fr") === "en" ? "en" : "fr";
    const plan = trip.plan_json as PlanTripResponse;
    const itinerary = (plan.structured_json as any)?.itinerary;
    const destination = String((plan.final_trip_plan as any)?.destination ?? trip.brief_json?.destination ?? "");

    // Photos are resolved on first use, then stored on the trip so the next
    // download or send is instant.
    if (itinerary?.itinerary_by_day && destination) {
      const resolved = await resolveItineraryPhotos(itinerary, tools, locale, destination);
      const located = await locateItinerary(itinerary, destination);
      if (resolved || located) {
        db.updateTrip({ userId, tripId, plan });
      }
    }

    // Embedding makes the file heavier but self-contained, which is what a
    // downloaded guide needs once the traveler is abroad without data. It runs
    // on a copy so the stored trip keeps lightweight remote URLs.
    const renderable: PlanTripResponse = options.embed ? structuredClone(plan) : plan;
    if (options.embed) {
      const copy = (renderable.structured_json as any)?.itinerary;
      if (copy?.itinerary_by_day) {
        await embedItineraryPhotos(copy);
      }
    }

    // The still map is fetched here with the server token and inlined: the
    // browser token is URL-restricted and would not answer an <img> request
    // from a downloaded file.
    const routes = ((renderable.structured_json as any)?.itinerary?.itinerary_by_day ?? []).map(mapRouteForDay);
    const staticMapSrc = await stillMapDataUri(routes, config.MAPBOX_SERVER_TOKEN ?? config.MAPBOX_ACCESS_TOKEN);

    return {
      trip,
      locale: locale as "fr" | "en",
      destination,
      filename: buildGuideFilename(trip.title),
      html: renderGuideHtml(renderable, { locale, title: trip.title, mapboxToken: config.MAPBOX_ACCESS_TOKEN, staticMapSrc })
    };
  }

  app.get("/api/trips/:id/guide", { preHandler: (app as any).authenticate }, async (request: any, reply) => {
    const guide = await buildGuide(request.user.userId, Number(request.params.id), {
      locale: request.query?.locale,
      embed: request.query?.embed !== "0"
    });

    if (!guide) {
      return reply.code(404).send({ error: "Trip not found" });
    }

    if (request.query?.format === "html") {
      return reply
        .header("Content-Type", "text/html; charset=utf-8")
        .header("Content-Disposition", `inline; filename="${guide.filename}"`)
        .send(guide.html);
    }

    return { filename: guide.filename, html: guide.html };
  });

  // The same guide as a PDF file, produced server-side.
  app.get("/api/trips/:id/guide.pdf", { preHandler: (app as any).authenticate }, async (request: any, reply) => {
    const guide = await buildGuide(request.user.userId, Number(request.params.id), {
      locale: request.query?.locale,
      embed: true
    });
    if (!guide) {
      return reply.code(404).send({ error: "Trip not found" });
    }
    try {
      const pdf = await renderPdf(guide.html);
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${guide.filename.replace(/\.html?$/i, "")}.pdf"`)
        .send(pdf);
    } catch (error) {
      request.log.warn(`PDF rendering failed: ${(error as Error).message}`);
      return reply.code(503).send({ error: "pdf_unavailable", message: "La génération PDF est indisponible sur ce serveur : utilisez « Aperçu » puis Imprimer / PDF." });
    }
  });

  // The hotel the traveler picked among the proposals: the guide, the map
  // and the travel times are built from it.
  app.patch("/api/trips/:id/stay", { preHandler: (app as any).authenticate }, async (request: any, reply) => {
    const tripId = Number(request.params.id);
    const trip = db.getTrip(request.user.userId, tripId) as any;
    if (!trip) {
      return reply.code(404).send({ error: "Trip not found" });
    }
    const index = Number((request.body as any)?.index);
    const plan = trip.plan_json as PlanTripResponse;
    const research = (plan.structured_json as any)?.research;
    if (!research || !Number.isInteger(index) || index < 0 || index >= (research.recommended_stays ?? []).length) {
      return reply.code(400).send({ error: "invalid_stay_index" });
    }
    research.chosen_stay_index = index;
    db.updateTrip({ userId: request.user.userId, tripId, plan });
    return { chosen_stay_index: index, stay: research.recommended_stays[index] };
  });

  // Emails the guide as an attachment. The recipient defaults to the signed-in
  // account: sending to an arbitrary address is an explicit, deliberate act.
  app.post("/api/trips/:id/guide/email", { preHandler: (app as any).authenticate }, async (request: any, reply) => {
    if (!mailer.isConfigured) {
      return reply.code(503).send({
        error: "email_not_configured",
        message: "Configurez SMTP_HOST, SMTP_USER et SMTP_PASS dans .env pour activer l'envoi par mail."
      });
    }

    const user = db.findUserById(request.user.userId);
    const parsed = GuideEmailRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const guide = await buildGuide(request.user.userId, Number(request.params.id), {
      locale: parsed.data.locale,
      embed: parsed.data.embed
    });
    if (!guide) {
      return reply.code(404).send({ error: "Trip not found" });
    }

    const to = parsed.data.to ?? user?.email;
    if (!to) {
      return reply.code(400).send({ error: "No recipient" });
    }

    const fr = guide.locale === "fr";
    const result = await mailer.sendGuide({
      to,
      locale: guide.locale,
      filename: guide.filename,
      html: guide.html,
      subject: fr
        ? `Votre guide de voyage — ${guide.destination || guide.trip.title}`
        : `Your travel guide — ${guide.destination || guide.trip.title}`,
      intro: fr
        ? "Voici votre guide personnalisé : le programme jour par jour, les visites gratuites, les activités au choix et les tables présélectionnées."
        : "Here is your personalized guide: the day-by-day program, free visits, activity options and preselected tables."
    });

    if (!result.sent) {
      request.log.warn({ reason: result.reason }, "Guide email failed");
      return reply.code(result.reason === "not_configured" ? 503 : 502).send({
        error: result.reason,
        message: result.message
      });
    }

    request.log.info({ trip_id: Number(request.params.id) }, "Guide emailed");
    return { sent: true, to, filename: guide.filename };
  });

  app.put("/api/trips/:id", { preHandler: (app as any).authenticate }, async (request: any, reply) => {
    const tripId = Number(request.params.id);
    const body = request.body as any;

    db.updateTrip({
      userId: request.user.userId,
      tripId,
      title: body.title,
      brief: body.brief_json ? StructuredTripBriefSchema.parse(body.brief_json) : undefined,
      plan: body.plan_json,
      verificationFlags: body.verification_flags
    });

    const updated = db.getTrip(request.user.userId, tripId);
    if (!updated) {
      return reply.code(404).send({ error: "Trip not found" });
    }

    return updated;
  });

  return app;
}

function buildGuideFilename(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `guide-${slug || "voyage"}.html`;
}

function buildTripTitle(result: PlanTripResponse): string {
  const destination = String(result.final_trip_plan?.destination ?? "Trip");
  return `Trip - ${destination}`;
}

function flattenToolStatuses(result: PlanTripResponse): Record<string, string> {
  return result.trace.reduce((acc, step) => ({ ...acc, ...step.tool_statuses }), {} as Record<string, string>);
}
