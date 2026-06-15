import { Bunqueue } from "bunqueue/client";
import { db } from "../../utils/db/index";
import { getClients } from "../../services/clients";
import { CROSS_SEED_CATEGORIES } from "../constants";
import type { CrossSeedMatch } from "../../services/scan";
import { getTorrentFileSizes, matchCrossSeedPeers, runScan } from "../../services/scan";
import { logger } from "../../lib/logger";

export interface ScanJob {
  scanRunId: number;
  triggeredBy: "manual" | "scheduled";
}

export interface RemoveTorrentJob {
  itemId: number;
  triggeredBy: "manual" | "scheduled";
}

export type JobData = ScanJob | RemoveTorrentJob;

export const queue = new Bunqueue<JobData>("cleanuparr", {
  embedded: true,
  dataPath: "bunqueue.db",
  concurrency: 1,
  routes: {
    scan: async (job) => {
      const { scanRunId } = job.data as ScanJob;
      logger.info({ scanRunId, jobId: job.id }, "Processing scan job");
      await runScan(scanRunId);
      return { scanRunId };
    },
    "remove-torrent": async (job) => {
      const { itemId, triggeredBy } = job.data as RemoveTorrentJob;

      logger.info({ itemId, triggeredBy }, "Processing removal job");

      const item = await db
        .selectFrom("flagged_items")
        .where("id", "=", itemId)
        .selectAll()
        .executeTakeFirst();

      if (!item || item.status !== "approved") {
        logger.warn({ itemId }, "Item not found or not approved, skipping");
        return { skipped: true, reason: "item not found or not approved" };
      }

      const deletedHashes: string[] = [];
      const deletedNames: string[] = [];

      if (item.torrent_hash) {
        const { qbitClients } = await getClients();
        const qbit = qbitClients.find((c) => c.instance.id === item.qbittorrent_instance_id);

        if (qbit) {
          const liveTorrents = await qbit.client.torrents.list();
          const crossSeedTorrents = liveTorrents.filter((t) =>
            CROSS_SEED_CATEGORIES.has(t.category),
          );

          const primaryTorrent = liveTorrents.find(
            (t) => t.hash.toLowerCase() === item.torrent_hash!.toLowerCase(),
          );

          let livePeers: CrossSeedMatch[] = [];
          if (primaryTorrent && crossSeedTorrents.length > 0) {
            const primarySizes = await getTorrentFileSizes(qbit, primaryTorrent);
            const csSizes = new Map<string, number[]>();
            for (const cs of crossSeedTorrents) {
              csSizes.set(cs.hash.toLowerCase(), await getTorrentFileSizes(qbit, cs));
            }
            livePeers = matchCrossSeedPeers(primarySizes, crossSeedTorrents, csSizes);
          }

          await db.deleteFrom("cross_seed_peers").where("flagged_item_id", "=", itemId).execute();
          for (const peer of livePeers) {
            await db
              .insertInto("cross_seed_peers")
              .values({
                flagged_item_id: itemId,
                torrent_hash: peer.hash,
                torrent_name: peer.name,
              })
              .execute();
          }

          logger.info(
            { itemId, torrent: item.torrent_name, hash: item.torrent_hash },
            "Deleting torrent",
          );
          await qbit.client.torrents.delete(item.torrent_hash, true);
          deletedHashes.push(item.torrent_hash);
          deletedNames.push(item.torrent_name ?? "unknown");

          for (const peer of livePeers) {
            logger.info(
              { itemId, torrent: peer.name, hash: peer.hash },
              "Deleting cross-seed peer",
            );
            try {
              await qbit.client.torrents.delete(peer.hash, true);
              deletedHashes.push(peer.hash);
              deletedNames.push(peer.name);
            } catch (e) {
              logger.error(
                { itemId, torrent: peer.name, err: e },
                "Failed to delete cross-seed peer",
              );
            }
          }
        }
      }

      await db
        .insertInto("audit_log")
        .values({
          flagged_item_id: itemId,
          scan_run_id: item.scan_run_id,
          torrent_name:
            deletedNames.length > 0
              ? JSON.stringify(deletedNames)
              : (item.torrent_name ?? "unknown"),
          torrent_hash:
            deletedHashes.length > 0
              ? JSON.stringify(deletedHashes)
              : (item.torrent_hash ?? "unknown"),
          category: item.category,
          files_deleted: item.files_to_delete ?? "[]",
          triggered_by: triggeredBy,
        })
        .execute();

      return { deletedHashes, deletedNames };
    },
  },
  retry: {
    maxAttempts: 3,
    delay: 5000,
    strategy: "exponential",
  },
});
