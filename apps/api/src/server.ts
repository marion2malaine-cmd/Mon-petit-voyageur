import type { z } from "zod";
import { registerAdmin } from "./admin";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  AuthLoginRequestSchema,
  AuthRegisterRequestSchema,
  BillingCheckoutRequestSchema,
  GuideEmailRequestSchema,
  PlanTripRequestSchema,
  type PlanTripResponse,
  StructuredTripBriefSchema
} from "@mlt/contracts";
import { getConfig } from "./config";
import { hashPassword, verifyPassword } from "./auth";
import { initDb, type UserRecord } from "./db";
import { Billing, hasActiveAccess } from "./billing";
import { startGoogleLogin, completeGoogleLogin } from "./googleAuth";
import { createTools } from "./tools";
import { loadSkillRegistry } from "./skills/registry";
import { createOrchestrator } from "./orchestrator/orchestrator";
import { embedItineraryPhotos, locateItinerary, resolveItineraryPhotos } from "./orchestrator/enrichItinerary";
import { renderGuideHtml } from "./guide/renderGuide";
import { journeyLegs, mapRouteForDay } from "./guide/renderGuide";
import { stillMapDataUri } from "./guide/staticMap";
import { renderPdf } from "./guide/pdf";
import { Mailer } from "./tools/mailer";
import { editTrip } from "./tripEdits";
import { registerPremium, premiumAccess } from "./premium";

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
  const billing = new Billing(config);
  // Comp accounts (founder / team): unlimited access even once billing is on.
  const compEmails = new Set(
    config.COMP_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  );

  /** The account as the web app needs it, with its billing state. */
  function serializeUser(user: UserRecord) {
    return {
      id: user.id,
      email: user.email,
      preferred_language: user.preferred_language,
      subscription_status: user.subscription_status ?? "none",
      subscription_plan: user.subscription_plan ?? null,
      current_period_end: user.current_period_end ?? null,
      trial_used: !!user.trial_used,
      billing_enabled: billing.isConfigured,
      has_premium: premiumAccess(user, compEmails),
      has_access: hasActiveAccess(user, billing.isConfigured, compEmails)
    };
  }

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

  // Keep the raw JSON body around: Stripe verifies its webhook signature
  // against the exact bytes it sent, so the parsed object is not enough.
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    (req as any).rawBody = body;
    const text = body.toString("utf8");
    try {
      done(null, text ? JSON.parse(text) : {});
    } catch (error) {
      done(error as Error);
    }
  });

  // Only known front-ends may make credentialed requests: reflecting any origin
  // (origin: true) with credentials lets any site the user visits call the API
  // with their session. The web app, its www variant and the iOS app (Capacitor)
  // are allowed; localhost dev origins only outside production.
  const allowedOrigins = new Set<string>([
    config.APP_URL,
    config.APP_URL.replace("https://", "https://www."),
    "capacitor://localhost",
    "https://localhost"
  ]);
  if (config.NODE_ENV !== "production") {
    allowedOrigins.add("http://localhost:5180");
    allowedOrigins.add("http://localhost:5173");
  }

  app.register(cors, {
    // A missing Origin (server-to-server calls like the Stripe webhook, curl,
    // the iOS webview) is not a browser cross-origin request, so it is allowed.
    origin(origin, cb) {
      if (!origin || allowedOrigins.has(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
    // The PDF download reads its file name from this header.
    exposedHeaders: ["Content-Disposition"]
  });

  // Baseline rate limit against brute force and cost abuse. Auth and planning
  // routes tighten it further per-route below.
  app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute"
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
  registerAdmin(app, db);

  // Tighter limit on account creation and login: brute force / enumeration.
  const authRateLimit = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

  app.post("/api/auth/register", authRateLimit, async (request, reply) => {
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

    return serializeUser(user);
  });

  app.post("/api/auth/login", authRateLimit, async (request, reply) => {
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

    return serializeUser(user);
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

    return serializeUser(user);
  });

  // --- Billing (Stripe) ---------------------------------------------------
  registerPremium(app, db, config, compEmails);

  // Starts a Checkout session for the chosen plan and returns its URL. The web
  // app redirects the browser there.
  app.post("/api/billing/checkout", { preHandler: (app as any).authenticate }, async (request: any, reply) => {
    if (!billing.isConfigured) {
      return reply.code(503).send({
        error: "billing_not_configured",
        message: "Le paiement n'est pas encore configuré (clés Stripe manquantes)."
      });
    }
    const parsed = BillingCheckoutRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const user = db.findUserById(request.user.userId);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    const result = await billing.createCheckoutSession({ user, plan: parsed.data.plan, db });
    if ("error" in result) {
      return reply.code(400).send({ error: result.error, message: "Impossible de démarrer le paiement." });
    }
    return { url: result.url };
  });

  // Opens the Stripe billing portal so the traveler can update or cancel.
  app.post("/api/billing/portal", { preHandler: (app as any).authenticate }, async (request: any, reply) => {
    const user = db.findUserById(request.user.userId);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const result = await billing.createPortalSession(user);
    if ("error" in result) {
      return reply.code(400).send({ error: result.error, message: "Espace de gestion indisponible." });
    }
    return { url: result.url };
  });

  // Stripe calls this after every billing event. The signature is verified
  // against the raw body, and the user's subscription state is refreshed from
  // the source of truth (Stripe) rather than trusted from the payload alone.
  app.post("/api/billing/webhook", async (request: any, reply) => {
    const event = billing.constructEvent((request as any).rawBody, request.headers["stripe-signature"]);
    if (!event) {
      return reply.code(400).send({ error: "invalid_signature" });
    }

    const customerId =
      (event.data.object as any)?.customer ??
      ((event.data.object as any)?.id && event.type.startsWith("customer.subscription")
        ? (event.data.object as any).customer
        : undefined);

    if (typeof customerId === "string") {
      const user = db.findUserByStripeCustomerId(customerId);
      if (user) {
        const state = await billing.syncSubscription(customerId);
        if (state) {
          db.updateBilling({
            userId: user.id,
            subscriptionStatus: state.status,
            subscriptionPlan: state.plan,
            currentPeriodEnd: state.currentPeriodEnd,
            trialUsed: state.trialUsed || undefined
          });
        }
      }
    }

    return { received: true };
  });

  // --- Google sign-in -----------------------------------------------------

  // The OAuth state cookie is short-lived and only needs to survive the round
  // trip to Google; it is readable by the callback on the same site.
  const oauthStateCookieOptions = { ...sessionCookieOptions, maxAge: 600 };

  app.get("/api/auth/google", async (_request, reply) => {
    const state = randomUUID();
    const url = startGoogleLogin(config, state);
    if (!url) {
      return reply.code(503).send({ error: "google_not_configured" });
    }
    reply.setCookie("mlt_oauth_state", state, oauthStateCookieOptions);
    return reply.redirect(url);
  });

  app.get("/api/auth/google/callback", async (request: any, reply) => {
    const code = request.query?.code as string | undefined;
    // Reject any callback whose state does not match the one we set: this is
    // the CSRF guard for the login flow.
    const state = request.query?.state as string | undefined;
    const expectedState = request.cookies?.mlt_oauth_state as string | undefined;
    reply.clearCookie("mlt_oauth_state", { path: "/" });
    if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
      return reply.redirect(`${config.APP_URL}/?login=google_error`);
    }

    const profile = await completeGoogleLogin(config, code);
    if (!profile) return reply.redirect(`${config.APP_URL}/?login=google_error`);

    // Match on the Google id first, then on the email so an existing password
    // account is linked rather than duplicated.
    let user = db.findUserByGoogleId(profile.googleId);
    if (!user) {
      const byEmail = db.findUserByEmail(profile.email);
      if (byEmail) {
        db.linkGoogleId(byEmail.id, profile.googleId);
        user = db.findUserById(byEmail.id);
      } else {
        // No usable password for a Google account: a random hash keeps the
        // NOT NULL column honest while password login stays impossible.
        const passwordHash = await hashPassword(randomUUID() + randomUUID());
        user = db.createUser({
          email: profile.email,
          passwordHash,
          preferredLanguage: "fr",
          googleId: profile.googleId
        });
      }
    }

    const token = await reply.jwtSign({ userId: user!.id, email: user!.email });
    reply.setCookie("mlt_token", token, sessionCookieOptions);
    return reply.redirect(`${config.APP_URL}/?login=google`);
  });

  /**
   * Planning takes one to four minutes. Holding an HTTP request open that long
   * dies on proxies and on any restart, so the work runs as a job: this call
   * answers at once with a job id and the client polls the job until done.
   * The trip itself is saved as soon as the plan exists, so a lost job never
   * loses a finished plan.
   */
  app.post(
    "/api/trips/plan",
    { preHandler: (app as any).authenticate, config: { rateLimit: { max: 8, timeWindow: "1 minute" } } },
    async (request: any, reply) => {
    const parsed = PlanTripRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.user?.userId as number;

    // Planning is the paid feature: without an active plan or a running trial,
    // the traveler is sent to checkout instead. Open while Stripe is off.
    const planUser = db.findUserById(userId);
    if (!planUser || !hasActiveAccess(planUser, billing.isConfigured, compEmails)) {
      return reply.code(402).send({
        error: "subscription_required",
        message: "Votre essai est terminé ou aucun abonnement n'est actif. Choisissez une formule pour continuer."
      });
    }

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
      const resolved = await resolveItineraryPhotos(itinerary, tools, locale, destination, (plan.structured_json as any)?.research);
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
        await embedItineraryPhotos(copy, (renderable.structured_json as any)?.research);
      }
    }

    // The still map is fetched here with the server token and inlined: the
    // browser token is URL-restricted and would not answer an <img> request
    // from a downloaded file.
    const guideDays = (renderable.structured_json as any)?.itinerary?.itinerary_by_day ?? [];
    const routes = guideDays.map(mapRouteForDay);
    const staticMapSrc = await stillMapDataUri(
      routes,
      config.MAPBOX_SERVER_TOKEN ?? config.MAPBOX_ACCESS_TOKEN,
      journeyLegs(guideDays)
    );

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

  app.patch("/api/trips/:id/itinerary", { preHandler: (app as any).authenticate }, async (request: any, reply) => {
    const tripId = Number(request.params.id);
    const trip = db.getTrip(request.user.userId, tripId) as any;
    if (!trip) return reply.code(404).send({ error: "Trip not found" });
    try {
      const plan = editTrip(trip.plan_json, request.body);
      db.updateTrip({ userId: request.user.userId, tripId, plan });
      return { ...plan, trip_id: tripId };
    } catch {
      return reply.code(400).send({ error: "invalid_itinerary_edit" });
    }
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

/** Constant-time string compare that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
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
