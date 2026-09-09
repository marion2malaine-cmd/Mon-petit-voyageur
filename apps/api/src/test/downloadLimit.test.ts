import Fastify from "fastify";
import { describe, it, expect } from "vitest";
import { createDownloadLimit } from "../downloadLimit";

it("shares three slots across HTML/PDF, isolates users and releases after errors", async () => {
  const app = Fastify();
  const limit = createDownloadLimit();
  const pending: (() => void)[] = [];
  const options = {
    preHandler: [async (req: any) => { req.user = { userId: Number(req.headers.user ?? 1) }; }, limit.preHandler],
    onResponse: limit.onResponse
  };
  for (const url of ["/html", "/pdf"]) app.get(url, options, async (req) => {
    await new Promise<void>(resolve => pending.push(resolve));
    if (req.headers.fail) throw new Error("render failed");
    return "guide";
  });
  await app.ready();
  const waitFor = async (count: number) => { for (let i = 0; pending.length < count && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 2)); expect(pending.length).toBe(count); };
  try {
    const first = app.inject({ url: "/html", headers: { fail: "1" } }).then(r => r);
    const second = app.inject("/pdf").then(r => r);
    const third = app.inject("/html").then(r => r);
    await waitFor(3);
    const fourth = await app.inject("/pdf");
    expect(fourth.statusCode).toBe(429);
    expect(fourth.json().error).toBe("download_limit_reached");
    const other = app.inject({ url: "/pdf", headers: { user: "2" } }).then(r => r);
    await waitFor(4);
    pending[0](); expect((await first).statusCode).toBe(500);
    const replacement = app.inject("/pdf").then(r => r);
    await waitFor(5);
    pending.forEach(resolve => resolve());
    expect((await Promise.all([second, third, other, replacement])).map(r => r.statusCode)).toEqual([200, 200, 200, 200]);
  } finally { pending.forEach(resolve => resolve()); await app.close(); }
});
