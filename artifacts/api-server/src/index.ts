import app from "./app";
import { logger } from "./lib/logger";
import { restoreSavedGatewaySessions } from "./lib/gateway-manager";
import { startAnnouncementScheduler } from "./lib/announcement-scheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void restoreSavedGatewaySessions()
    .catch((error) => {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to restore saved Discord gateway sessions"
      );
    })
    .finally(startAnnouncementScheduler);
});
