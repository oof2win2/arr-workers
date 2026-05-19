import { runScan } from "./scan";
import { db } from "../utils/db/index";
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
      await runScan("scheduled");
    } catch (err) {
      console.error("Scheduled scan failed:", err);
    }
  });
}

export function stopScheduler() {
  if (job) {
    job.stop();
    job = null;
  }
}
