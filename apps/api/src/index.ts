import { buildServer, runningPlanJobs } from "./server";
import { getConfig } from "./config";

// A deploy sends SIGTERM while a traveler may be four minutes into a plan:
// the process keeps running until every plan in progress is saved, within
// this bound (Railway's draining window is set to match).
const SHUTDOWN_GRACE_MS = 10 * 60 * 1000;

async function main() {
  const config = getConfig();
  const app = buildServer();

  try {
    await app.listen({
      host: "0.0.0.0",
      port: config.PORT
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    const deadline = Date.now() + SHUTDOWN_GRACE_MS;
    let pending = runningPlanJobs();
    if (pending) app.log.warn({ signal, pending }, "Shutdown requested: waiting for plans in progress");
    while (pending && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      pending = runningPlanJobs();
    }
    if (pending) app.log.error({ pending }, "Shutdown grace period over with plans still running");
    app.log.info({ signal }, "Shutting down");
    // Idle keep-alive connections can hold close() open: never wait for them.
    await Promise.race([app.close(), new Promise((resolve) => setTimeout(resolve, 5000))]);
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main();
