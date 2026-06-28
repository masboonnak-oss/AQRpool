import app from "./app";
import { apiEnv } from "./lib/env.js";
import { logger } from "./lib/logger";
import { startDailyBackup } from "./lib/scheduler";

const port = apiEnv.port;

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startDailyBackup();
});
