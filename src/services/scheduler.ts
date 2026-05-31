import { startScan } from "./scan";
import { db } from "../utils/db/index";
import { logger } from "../lib/logger";
import type { CronJob } from "bun";

let job: CronJob | null = null;

export async function restartWithConfig() {
  if (job) {
    job.stop();
    job = null;
  }

  const row = await db
    .selectFrom("config")
    .where("key", "=", "scan_cron")
    .select("value")
    .executeTakeFirst();

  const cron = row?.value ?? "0 * * * *";

  job = Bun.cron(cron, async () => {
    try {
      await startScan("scheduled");
    } catch (err) {
      logger.error({ err }, "Scheduled scan failed");
    }
  });

  logger.info({ cron }, "Scheduler configured");
}

export function stopScheduler() {
  if (job) {
    job.stop();
    job = null;
  }
}
