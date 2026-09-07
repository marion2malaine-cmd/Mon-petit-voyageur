import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { AppDb } from "./db";
import type { AppConfig } from "./config";

export function premiumAccess(user: any, compEmails?: Set<string>): boolean {
  if (compEmails && user?.email && compEmails.has(String(user.email).toLowerCase())) return true;
  return user?.subscription_plan === "premium" && user.subscription_status === "active" && !!user.current_period_end && Date.parse(user.current_period_end) > Date.now();
}
const expense = z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(100), cents: z.number().int().positive().max(100000000), payer: z.string(), participants: z.array(z.string()).min(1).max(30) });
const journal = z.object({ id: z.string().uuid(), title: z.string().max(120), note: z.string().max(1000), date: z.string().datetime(), image: z.string().max(250000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/) });
export const walletSchema = z.object({ revision: z.number().int().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/), people: z.array(z.string().trim().min(1).max(50)).min(1).max(30), expenses: z.array(expense).max(500), photos: z.array(journal).max(30) }).superRefine((v, ctx) => {
  if (new Set(v.people).size !== v.people.length || v.expenses.some(e => !v.people.includes(e.payer) || e.participants.some(p => !v.people.includes(p)) || new Set(e.participants).size !== e.participants.length)) ctx.addIssue({ code: "custom", message: "Invalid participants" });
});

export function registerPremium(app: FastifyInstance, db: AppDb, config: AppConfig, compEmails?: Set<string>) {
  const guard = async (request: any, reply: any) => {
    await (app as any).authenticate(request, reply);
    if (reply.sent) return;
    if (!premiumAccess(db.findUserById(request.user.userId), compEmails)) return reply.code(403).send({ error: "premium_required" });
  };
  app.get("/api/premium/trips/:id", { preHandler: guard }, async (req: any, reply) => {
    const trip = db.getTrip(req.user.userId, Number(req.params.id)) as any;
    if (!trip) return reply.code(404).send({ error: "Trip not found" });
    return trip.plan_json?.structured_json?.premium ?? { revision: 0, currency: "EUR", people: ["Moi"], expenses: [], photos: [] };
  });
  app.put("/api/premium/trips/:id", { preHandler: guard, bodyLimit: 8500000 }, async (req: any, reply) => {
    const parsed = walletSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_premium_data" });
    const tripId = Number(req.params.id);
    const trip = db.getTrip(req.user.userId, tripId) as any;
    if (!trip) return reply.code(404).send({ error: "Trip not found" });
    const plan = trip.plan_json;
    if ((plan.structured_json?.premium?.revision ?? 0) !== parsed.data.revision) return reply.code(409).send({ error: "Le voyage a changé. Rechargez avant de modifier." });
    const data = { ...parsed.data, revision: parsed.data.revision + 1 };
    plan.structured_json.premium = data;
    db.updateTrip({ userId: req.user.userId, tripId, plan });
    return data;
  });
  app.get("/api/premium/rate", { preHandler: guard }, async (req: any, reply) => {
    const q = z.object({ from: z.string().regex(/^[A-Z]{3}$/), to: z.string().regex(/^[A-Z]{3}$/) }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_currency" });
    try {
      if (q.data.from === q.data.to) return { rate: 1, date: new Date().toISOString().slice(0, 10) };
      const r = await fetch(`https://api.frankfurter.dev/v2/rate/${q.data.from}/${q.data.to}`, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error();
      return await r.json();
    } catch { return reply.code(503).send({ error: "Taux indisponible. Réessayez." }); }
  });
  app.post("/api/premium/nearby", { preHandler: guard, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req: any, reply) => {
    const input = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), kind: z.enum(["restaurant", "tourist_attraction"]) }).safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "invalid_location" });
    if (!config.GOOGLE_MAPS_API_KEY) return reply.code(503).send({ error: "La recherche de proximité n’est pas encore configurée." });
    try {
      const { lat, lon, kind } = input.data;
      const r = await fetch("https://places.googleapis.com/v1/places:searchNearby", { method: "POST", signal: AbortSignal.timeout(10000), headers: { "Content-Type": "application/json", "X-Goog-Api-Key": config.GOOGLE_MAPS_API_KEY, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.location" }, body: JSON.stringify({ includedTypes: [kind], maxResultCount: 20, rankPreference: "DISTANCE", languageCode: "fr", locationRestriction: { circle: { center: { latitude: lat, longitude: lon }, radius: 2000 } } }) });
      if (!r.ok) throw new Error();
      return await r.json();
    } catch { return reply.code(503).send({ error: "Recherche indisponible pour le moment." }); }
  });
}
