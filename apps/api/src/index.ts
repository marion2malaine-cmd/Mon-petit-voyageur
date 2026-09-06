import { buildServer } from "./server";
import { getConfig } from "./config";

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
}

void main();
