import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { AppDb } from "./db";

export const guideImagesSchema = z.array(z.object({
  image: z.string().max(250000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/),
  title: z.string().trim().max(120),
})).max(12);
export function registerGuideImages(app: FastifyInstance, db: AppDb) {
  db.raw.exec("CREATE TABLE IF NOT EXISTS guide_images (trip_id INTEGER PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE, images_json TEXT NOT NULL)");
  const read = (id: number) => {
    const row = db.raw.prepare("SELECT images_json FROM guide_images WHERE trip_id = ?").get(id) as { images_json: string } | undefined;
    return row ? guideImagesSchema.parse(JSON.parse(row.images_json)) : [];
  };
  app.get("/api/trips/:id/guide/images", { preHandler: (app as any).authenticate }, async (req: any, reply) => {
    if (!db.getTrip(req.user.userId, Number(req.params.id))) return reply.code(404).send({ error: "Trip not found" });
    return read(Number(req.params.id));
  });
  app.put("/api/trips/:id/guide/images", { bodyLimit: 3100000, preHandler: (app as any).authenticate }, async (req: any, reply) => {
    if (!db.getTrip(req.user.userId, Number(req.params.id))) return reply.code(404).send({ error: "Trip not found" });
    const parsed = guideImagesSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_guide_images" });
    db.raw.prepare("INSERT INTO guide_images (trip_id, images_json) VALUES (?, ?) ON CONFLICT(trip_id) DO UPDATE SET images_json = excluded.images_json").run(Number(req.params.id), JSON.stringify(parsed.data));
    return parsed.data;
  });
  return read;
}
export function renderGuideImages(images: z.infer<typeof guideImagesSchema>, locale: string) {
  const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  return images.length ? `<section class="band band-cream"><div class="wrap"><h2 class="section-title">${locale === 'fr' ? 'Mes images du voyage' : 'My trip images'}</h2>${images.map(p => `<figure style="break-inside:avoid;margin:24px 0"><img src="${p.image}" alt="${escape(p.title)}" style="display:block;max-width:100%;max-height:650px;object-fit:contain;margin:auto"><figcaption>${escape(p.title)}</figcaption></figure>`).join('')}</div></section>` : '';
}
