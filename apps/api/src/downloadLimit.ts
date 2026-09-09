import type { FastifyReply, FastifyRequest } from "fastify";

/** Shared by HTML and PDF routes, scoped to one API instance. */
export function createDownloadLimit() {
  const active = new Map<number, number>();
  const reservations = new WeakMap<FastifyRequest, number>();

  function release(request: FastifyRequest) {
    const userId = reservations.get(request);
    if (userId === undefined) return;
    reservations.delete(request);
    const remaining = (active.get(userId) ?? 1) - 1;
    if (remaining > 0) active.set(userId, remaining);
    else active.delete(userId);
  }

  return {
    async preHandler(request: FastifyRequest, reply: FastifyReply) {
      const userId = (request.user as { userId: number }).userId;
      const count = active.get(userId) ?? 0;
      if (count >= 3) {
        return reply.code(429).header("Retry-After", "3").send({
          error: "download_limit_reached",
          message: "Trois téléchargements sont déjà en cours. Attendez la fin de l’un d’eux puis réessayez."
        });
      }
      active.set(userId, count + 1);
      reservations.set(request, userId);
      reply.raw.once("close", () => release(request));
    },
    async onResponse(request: FastifyRequest) { release(request); }
  };
}
