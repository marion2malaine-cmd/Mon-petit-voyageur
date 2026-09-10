import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { initDb } from "../db";
import { guideImagesSchema, registerGuideImages, renderGuideImages } from "../guideImages";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const photo = { image: 'data:image/jpeg;base64,/9j/2Q==', title: '<script>oops</script>' };
describe('guide images', () => {
  it('rejects remote URLs, active content and oversized collections', () => {
    for (const image of ['https://example.com/a.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', 'javascript:alert(1)']) expect(guideImagesSchema.safeParse([{ ...photo, image }]).success).toBe(false);
    expect(guideImagesSchema.safeParse(Array(13).fill(photo)).success).toBe(false);
    expect(renderGuideImages([photo], 'fr')).toContain('&lt;script&gt;');
    expect(renderGuideImages([photo], 'fr')).toContain(photo.image);
    expect(renderGuideImages([], 'fr')).toBe('');
  });
  it('saves images separately from the plan and prevents access to another user’s trip', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mpv-images-')); const db = initDb(join(dir, 'test.sqlite'));
    const app = Fastify(); let owner = 1;
    (app as any).authenticate = async (req: any) => { req.user = { userId: owner }; };
    const read = registerGuideImages(app, db);
    try {
      const user = db.createUser({ email: 'images@example.com', passwordHash: 'test', preferredLanguage: 'fr' }); owner = user.id;
      const trip = db.createTrip({ userId: user.id, title: 'Paris', brief: {} as any, plan: {} as any, verificationFlags: [] });
      const url = `/api/trips/${trip}/guide/images`;
      expect((await app.inject({ method: 'PUT', url, payload: [photo] })).statusCode).toBe(200);
      expect(read(trip)).toEqual([photo]);
      expect((await app.inject({ method: 'GET', url })).json()).toEqual([photo]);
      owner = user.id + 1;
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(404);
      expect((await app.inject({ method: 'PUT', url, payload: [] })).statusCode).toBe(404);
      expect(read(trip)).toEqual([photo]);
      owner = user.id;
      expect((await app.inject({ method: 'PUT', url, payload: [] })).statusCode).toBe(200);
      expect(read(trip)).toEqual([]);
    } finally { await app.close(); db.raw.close(); rmSync(dir, { recursive: true, force: true }); }
  });
});
