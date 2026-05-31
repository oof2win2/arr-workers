import { Bunqueue } from "bunqueue/client";
import { db } from "../../utils/db/index";
import { runScan } from "../../services/scan";

export interface ScanJob {
  scanRunId: number;
  triggeredBy: "manual" | "scheduled";
}

export const scanQueue = new Bunqueue<ScanJob>("scan", {
  embedded: true,
  dataPath: "bunqueue-scan.db",
  concurrency: 1,
  routes: {
    scan: async (job) => {
      const { scanRunId } = job.data;
      await runScan(scanRunId);
      return { scanRunId };
    },
  },
  retry: {
    maxAttempts: 1,
    delay: 5000,
    strategy: "exponential",
  },
});
