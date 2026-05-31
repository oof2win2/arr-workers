import { db } from "../utils/db/index";
import type { FlaggedItem, Instance } from "../utils/db/types";
import { getClients, type QBittorrentClientWithMeta, type ArrClientWithMeta } from "./clients";
import { getApiV3Movie, getApiV3History } from "../lib/radarr/sdk.gen";
import { getApiV3Series, getApiV3History as getSonarrHistory } from "../lib/sonarr/sdk.gen";
import type { Torrent } from "@oof2win2/qbittorrent-api";
import { readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { CROSS_SEED_CATEGORIES } from "../lib/constants";
import { logger } from "../lib/logger";
import { scanQueue } from "../lib/processing/scan-queue";

interface PendingFlag {
  category: FlaggedItem["category"];
  reason: string;
  torrent_hash: string | null;
  torrent_name: string | null;
  torrent_size: number | null;
  torrent_tags: string | null;
  files_to_delete: string | null;
  qbittorrent_instance_id: number;
  arr_instance_id: number | null;
}

interface CrossSeedMatch {
  hash: string;
  name: string;
}

export type { CrossSeedMatch };

export async function startScan(triggeredBy: "manual" | "scheduled"): Promise<number> {
  const scanRun = await db
    .insertInto("scan_runs")
    .values({ status: "running", triggered_by: triggeredBy })
    .returning("id")
    .executeTakeFirstOrThrow();

  logger.info({ scanRunId: scanRun.id, triggeredBy }, "Scan queued");

  await scanQueue.add("scan", {
    scanRunId: scanRun.id,
    triggeredBy,
  });

  return scanRun.id;
}

export async function runScan(scanRunId: number): Promise<void> {
  logger.info({ scanRunId }, "Scan started");
  try {
    const { qbitClients, radarrClients, sonarrClients } = await getClients();
    logger.info(
      {
        scanRunId,
        qbitCount: qbitClients.length,
        radarrCount: radarrClients.length,
        sonarrCount: sonarrClients.length,
      },
      "Clients loaded",
    );

    const allTorrents: { torrent: Torrent; qbit: QBittorrentClientWithMeta }[] = [];
    for (const qbit of qbitClients) {
      const torrents = await qbit.client.torrents.list();
      logger.debug(
        { scanRunId, instance: qbit.instance.name, torrentCount: torrents.length },
        "Fetched torrents from qBittorrent",
      );
      for (const t of torrents) {
        allTorrents.push({ torrent: t, qbit });
      }
    }
    logger.info({ scanRunId, totalTorrents: allTorrents.length }, "All torrents fetched");

    const flags: PendingFlag[] = [];

    const crossSeedByInstance = new Map<number, Torrent[]>();
    const crossSeedSizesByInstance = new Map<number, Map<string, number[]>>();
    for (const qbit of qbitClients) {
      const csTorrents = allTorrents
        .filter((x) => x.qbit.instance.id === qbit.instance.id)
        .map((x) => x.torrent)
        .filter((t) => CROSS_SEED_CATEGORIES.has(t.category));

      crossSeedByInstance.set(qbit.instance.id, csTorrents);

      const sizeMap = new Map<string, number[]>();
      for (const cs of csTorrents) {
        sizeMap.set(cs.hash.toLowerCase(), await getTorrentFileSizes(qbit, cs));
      }
      crossSeedSizesByInstance.set(qbit.instance.id, sizeMap);
    }

    for (const _qbit of qbitClients) {
      // const qbitTorrents = allTorrents.filter((x) => x.qbit.instance.id === _qbit.instance.id);
      // flags.push(
      //   ...(await detectOrphanedFiles(
      //     qbit,
      //     qbitTorrents.map((x) => x.torrent),
      //   )),
      // );
    }

    for (const radarr of radarrClients) {
      const qbitInst = radarr.qbittorrentInstance;
      const qbitTorrents = allTorrents.filter((x) => x.qbit.instance.id === qbitInst.id);
      logger.debug(
        { scanRunId, radarr: radarr.instance.name, torrents: qbitTorrents.length },
        "Detecting Radarr issues",
      );
      flags.push(
        ...(await detectArrIssues(
          qbitTorrents.map((x) => x.torrent),
          qbitInst,
          radarr,
          "radarr",
        )),
      );
    }

    for (const sonarr of sonarrClients) {
      const qbitInst = sonarr.qbittorrentInstance;
      const qbitTorrents = allTorrents.filter((x) => x.qbit.instance.id === qbitInst.id);
      logger.debug(
        { scanRunId, sonarr: sonarr.instance.name, torrents: qbitTorrents.length },
        "Detecting Sonarr issues",
      );
      flags.push(
        ...(await detectArrIssues(
          qbitTorrents.map((x) => x.torrent),
          qbitInst,
          sonarr,
          "sonarr",
        )),
      );
    }

    logger.info({ scanRunId, flagsDetected: flags.length }, "Detection complete");

    const dismissed = await db
      .selectFrom("flagged_items")
      .where("status", "=", "dismissed")
      .select(["torrent_hash", "category"])
      .execute();
    const dismissedSet = new Set(dismissed.map((d) => `${d.torrent_hash}:${d.category}`));

    const pending = await db
      .selectFrom("flagged_items")
      .where("status", "=", "pending")
      .select(["torrent_hash", "category"])
      .execute();
    const pendingSet = new Set(pending.map((p) => `${p.torrent_hash}:${p.category}`));

    let insertedCount = 0;
    for (const flag of flags) {
      const key = `${flag.torrent_hash}:${flag.category}`;
      if (dismissedSet.has(key) || pendingSet.has(key)) continue;

      let filesToDelete = flag.files_to_delete;
      if (flag.torrent_hash) {
        const qbit = qbitClients.find((c) => c.instance.id === flag.qbittorrent_instance_id);
        if (qbit) {
          const torrent = allTorrents.find(
            (x) =>
              x.torrent.hash.toLowerCase() === flag.torrent_hash!.toLowerCase() &&
              x.qbit.instance.id === flag.qbittorrent_instance_id,
          );
          if (torrent) {
            const paths = await getTorrentFilePaths(qbit, torrent.torrent);
            filesToDelete = JSON.stringify(
              paths.length > 0 ? paths : [torrent.torrent.content_path],
            );
          }
        }
      }

      const inserted = await db
        .insertInto("flagged_items")
        .values({
          scan_run_id: scanRunId,
          qbittorrent_instance_id: flag.qbittorrent_instance_id,
          arr_instance_id: flag.arr_instance_id,
          category: flag.category,
          reason: flag.reason,
          torrent_hash: flag.torrent_hash,
          torrent_name: flag.torrent_name,
          torrent_size: flag.torrent_size,
          torrent_tags: flag.torrent_tags,
          files_to_delete: filesToDelete,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      insertedCount++;

      if (flag.torrent_hash) {
        const crossSeedTorrents = crossSeedByInstance.get(flag.qbittorrent_instance_id) ?? [];
        const crossSeedSizes = crossSeedSizesByInstance.get(flag.qbittorrent_instance_id);
        if (crossSeedTorrents.length > 0 && crossSeedSizes) {
          const torrent = allTorrents.find(
            (x) =>
              x.torrent.hash.toLowerCase() === flag.torrent_hash!.toLowerCase() &&
              x.qbit.instance.id === flag.qbittorrent_instance_id,
          );
          if (torrent) {
            const qbit = qbitClients.find((c) => c.instance.id === flag.qbittorrent_instance_id)!;
            const torrentSizes = await getTorrentFileSizes(qbit, torrent.torrent);
            const peers = matchCrossSeedPeers(torrentSizes, crossSeedTorrents, crossSeedSizes);
            for (const peer of peers) {
              await db
                .insertInto("cross_seed_peers")
                .values({
                  flagged_item_id: inserted.id,
                  torrent_hash: peer.hash,
                  torrent_name: peer.name,
                })
                .execute();
            }
          }
        }
      }
    }

    const existingPending = await db
      .selectFrom("flagged_items")
      .where("status", "=", "pending")
      .selectAll()
      .execute();

    for (const item of existingPending) {
      if (!item.torrent_hash) continue;

      const existingPeers = await db
        .selectFrom("cross_seed_peers")
        .where("flagged_item_id", "=", item.id)
        .select(["id"])
        .execute();
      if (existingPeers.length > 0) continue;

      const crossSeedTorrents = crossSeedByInstance.get(item.qbittorrent_instance_id) ?? [];
      const crossSeedSizes = crossSeedSizesByInstance.get(item.qbittorrent_instance_id);
      if (crossSeedTorrents.length === 0 || !crossSeedSizes) continue;

      const torrent = allTorrents.find(
        (x) =>
          x.torrent.hash.toLowerCase() === item.torrent_hash!.toLowerCase() &&
          x.qbit.instance.id === item.qbittorrent_instance_id,
      );
      if (!torrent) continue;

      const qbit = qbitClients.find((c) => c.instance.id === item.qbittorrent_instance_id)!;
      const torrentSizes = await getTorrentFileSizes(qbit, torrent.torrent);
      const peers = matchCrossSeedPeers(torrentSizes, crossSeedTorrents, crossSeedSizes);
      for (const peer of peers) {
        await db
          .insertInto("cross_seed_peers")
          .values({
            flagged_item_id: item.id,
            torrent_hash: peer.hash,
            torrent_name: peer.name,
          })
          .execute();
      }
    }

    await db
      .updateTable("scan_runs")
      .set({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary: `${flags.length} items detected`,
      })
      .where("id", "=", scanRunId)
      .execute();
    logger.info(
      { scanRunId, flagsDetected: flags.length, inserted: insertedCount },
      "Scan completed",
    );
  } catch (err) {
    logger.error({ scanRunId, err }, "Scan failed");
    await db
      .updateTable("scan_runs")
      .set({
        status: "failed",
        completed_at: new Date().toISOString(),
        summary: String(err),
      })
      .where("id", "=", scanRunId)
      .execute();
  }
}

async function getTorrentFilePaths(
  qbit: QBittorrentClientWithMeta,
  torrent: Torrent,
): Promise<string[]> {
  try {
    const files = await qbit.client.torrents.getFiles(torrent.hash);
    return files.map((f) => join(torrent.save_path, f.name));
  } catch {
    return [];
  }
}

export async function getTorrentFileSizes(
  qbit: QBittorrentClientWithMeta,
  torrent: Torrent,
): Promise<number[]> {
  try {
    const files = await qbit.client.torrents.getFiles(torrent.hash);
    return files.map((f) => f.size);
  } catch {
    return [];
  }
}

function fileSizesSubset(subset: number[], superset: number[]): boolean {
  if (subset.length === 0 || superset.length === 0) return false;
  const available = [...superset].sort((a, b) => a - b);
  const needed = [...subset].sort((a, b) => a - b);
  let ai = 0;
  for (const size of needed) {
    while (ai < available.length && available[ai]! < size) ai++;
    if (ai >= available.length || available[ai] !== size) return false;
    ai++;
  }
  return true;
}

export function matchCrossSeedPeers(
  torrentSizes: number[],
  crossSeedTorrents: Torrent[],
  crossSeedSizes: Map<string, number[]>,
): CrossSeedMatch[] {
  if (torrentSizes.length === 0) return [];

  const sortedPrimary = [...torrentSizes].sort((a, b) => a - b);
  const peers: CrossSeedMatch[] = [];

  for (const csTorrent of crossSeedTorrents) {
    const csSizes = crossSeedSizes.get(csTorrent.hash.toLowerCase());
    if (!csSizes || csSizes.length === 0) continue;

    if (csSizes.length === sortedPrimary.length) {
      const sorted = [...csSizes].sort((a, b) => a - b);
      let exact = true;
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] !== sortedPrimary[i]) {
          exact = false;
          break;
        }
      }
      if (exact) {
        peers.push({ hash: csTorrent.hash, name: csTorrent.name });
        continue;
      }
    }

    if (fileSizesSubset(csSizes, torrentSizes)) {
      peers.push({ hash: csTorrent.hash, name: csTorrent.name });
    }
  }

  return peers;
}

async function detectOrphanedFiles(
  qbit: QBittorrentClientWithMeta,
  torrents: Torrent[],
): Promise<PendingFlag[]> {
  const flags: PendingFlag[] = [];
  const downloadDir = qbit.instance.download_dir;
  if (!downloadDir) return flags;

  let entries: string[];
  try {
    entries = await readdir(downloadDir);
  } catch {
    return flags;
  }

  const torrentPaths = new Set(torrents.map((t) => basename(t.content_path)));

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    if (torrentPaths.has(entry)) continue;

    const fullPath = join(downloadDir, entry);
    let size = 0;
    try {
      const s = await stat(fullPath);
      size = s.size;
    } catch {
      continue;
    }

    flags.push({
      category: "orphaned_files",
      reason: `File/directory "${entry}" exists in download dir but has no associated torrent in qBittorrent`,
      torrent_hash: null,
      torrent_name: entry,
      torrent_size: size,
      torrent_tags: null,
      files_to_delete: JSON.stringify([fullPath]),
      qbittorrent_instance_id: qbit.instance.id,
      arr_instance_id: null,
    });
  }

  return flags;
}

async function fetchRadarrLibrary(client: any): Promise<Map<number, string>> {
  const library = new Map<number, string>();
  const resp = await getApiV3Movie({ client, responseStyle: "data" });
  const movies = (resp as any)?.data ?? resp;
  if (Array.isArray(movies)) {
    for (const m of movies) {
      if (m.id != null) library.set(m.id as number, (m.title as string) ?? "Unknown");
    }
  }
  return library;
}

async function fetchSonarrLibrary(client: any): Promise<Map<number, string>> {
  const library = new Map<number, string>();
  const resp = await getApiV3Series({ client, responseStyle: "data" });
  const series = (resp as any)?.data ?? resp;
  if (Array.isArray(series)) {
    for (const s of series) {
      if (s.id != null) library.set(s.id as number, (s.title as string) ?? "Unknown");
    }
  }
  return library;
}

async function fetchArrHistory(
  client: any,
  fetcher: (opts: any) => Promise<any>,
): Promise<Array<Record<string, unknown>>> {
  const history: Array<Record<string, unknown>> = [];
  let page = 1;
  while (true) {
    const resp = await fetcher({ client, responseStyle: "data", query: { page, pageSize: 1000 } });
    const result = (resp as any)?.data ?? resp;
    const records = Array.isArray(result) ? result : (result?.records ?? []);
    if (records.length === 0) break;
    history.push(...records);
    if (records.length < 1000) break;
    page++;
  }
  return history;
}

async function detectArrIssues(
  torrents: Torrent[],
  qbitInstance: Instance,
  arrClient: ArrClientWithMeta,
  arrType: "radarr" | "sonarr",
): Promise<PendingFlag[]> {
  const flags: PendingFlag[] = [];
  const tag =
    arrType === "radarr"
      ? (qbitInstance.radarr_tag ?? "radarr")
      : (qbitInstance.sonarr_tag ?? "sonarr");

  const library =
    arrType === "radarr"
      ? await fetchRadarrLibrary(arrClient.client)
      : await fetchSonarrLibrary(arrClient.client);

  const history =
    arrType === "radarr"
      ? await fetchArrHistory(arrClient.client, getApiV3History)
      : await fetchArrHistory(arrClient.client, getSonarrHistory);

  const itemIdKey = arrType === "radarr" ? "movieId" : "seriesId";
  const subItemIdKey = arrType === "sonarr" ? "episodeId" : null;
  const importedEventTypes =
    arrType === "radarr"
      ? ["downloadFolderImported", "movieFolderImported"]
      : ["downloadFolderImported", "seriesFolderImported"];

  const historyByDownloadId = new Map<string, Array<Record<string, unknown>>>();
  for (const h of history) {
    const dlId = (h.downloadId as string | null)?.toLowerCase();
    if (!dlId) continue;
    const arr = historyByDownloadId.get(dlId) ?? [];
    arr.push(h);
    historyByDownloadId.set(dlId, arr);
  }

  const taggedHashes = new Set(
    torrents.filter((t) => t.category === tag).map((t) => t.hash.toLowerCase()),
  );

  for (const torrent of torrents) {
    const hash = torrent.hash.toLowerCase();
    const isTagged = taggedHashes.has(hash);
    const histEntries = historyByDownloadId.get(hash);
    const isKnownToArr = histEntries && histEntries.length > 0;

    if (isTagged && !isKnownToArr) {
      flags.push({
        category: "tagged_no_arr_record",
        reason: `Torrent "${torrent.name}" has "${tag}" tag but ${arrType} has no record of it`,
        torrent_hash: torrent.hash,
        torrent_name: torrent.name,
        torrent_size: torrent.size,
        torrent_tags: torrent.tags,
        files_to_delete: JSON.stringify([torrent.content_path]),
        qbittorrent_instance_id: qbitInstance.id,
        arr_instance_id: arrClient.instance.id,
      });
      continue;
    }

    if (!isKnownToArr) continue;

    const importedEntries = histEntries!.filter((h) =>
      importedEventTypes.includes(h.eventType as string),
    );
    if (importedEntries.length === 0) continue;

    const sampleImport = importedEntries[0]!;
    const itemId = sampleImport[itemIdKey] as number | undefined;
    if (!itemId) continue;

    if (!library.has(itemId)) {
      flags.push({
        category: "arr_deleted",
        reason: `Torrent "${torrent.name}" was imported by ${arrType}, but the ${arrType === "radarr" ? "movie" : "series"} no longer exists in the library`,
        torrent_hash: torrent.hash,
        torrent_name: torrent.name,
        torrent_size: torrent.size,
        torrent_tags: torrent.tags,
        files_to_delete: JSON.stringify([torrent.content_path]),
        qbittorrent_instance_id: qbitInstance.id,
        arr_instance_id: arrClient.instance.id,
      });
      continue;
    }

    const allImportsForItem = history.filter(
      (h) => h[itemIdKey] === itemId && importedEventTypes.includes(h.eventType as string),
    );

    if (allImportsForItem.length > 0 && subItemIdKey) {
      const thisSubItemDates = new Map<number, Date>();
      for (const h of importedEntries) {
        const subId = h[subItemIdKey] as number | undefined;
        if (subId == null) continue;
        const d = new Date((h.date as string) ?? 0);
        const existing = thisSubItemDates.get(subId);
        if (!existing || d > existing) {
          thisSubItemDates.set(subId, d);
        }
      }

      const otherLatestBySubItem = new Map<number, Date>();
      for (const h of allImportsForItem) {
        const subId = h[subItemIdKey] as number | undefined;
        if (subId == null) continue;
        const dlId = (h.downloadId as string | null)?.toLowerCase();
        if (dlId === hash) continue;
        const d = new Date((h.date as string) ?? 0);
        const existing = otherLatestBySubItem.get(subId);
        if (!existing || d > existing) {
          otherLatestBySubItem.set(subId, d);
        }
      }

      let allSuperseded = true;
      for (const [subId, thisDate] of thisSubItemDates) {
        const otherDate = otherLatestBySubItem.get(subId);
        if (!otherDate || otherDate <= thisDate) {
          allSuperseded = false;
          break;
        }
      }

      if (allSuperseded && thisSubItemDates.size > 0 && otherLatestBySubItem.size > 0) {
        flags.push({
          category: "superseded",
          reason: `Torrent "${torrent.name}" was superseded by newer imports for "${library.get(itemId)}"`,
          torrent_hash: torrent.hash,
          torrent_name: torrent.name,
          torrent_size: torrent.size,
          torrent_tags: torrent.tags,
          files_to_delete: JSON.stringify([torrent.content_path]),
          qbittorrent_instance_id: qbitInstance.id,
          arr_instance_id: arrClient.instance.id,
        });
      }
    } else if (allImportsForItem.length > 1) {
      const sortedByDate = [...allImportsForItem].sort(
        (a, b) =>
          new Date((a.date as string) ?? 0).getTime() - new Date((b.date as string) ?? 0).getTime(),
      );
      const latestImport = sortedByDate[sortedByDate.length - 1];
      if (!latestImport) continue;

      const thisDate = new Date((sampleImport.date as string) ?? 0);
      const latestDate = new Date((latestImport.date as string) ?? 0);

      if (thisDate < latestDate) {
        flags.push({
          category: "superseded",
          reason: `Torrent "${torrent.name}" was superseded by a newer import for "${library.get(itemId)}"`,
          torrent_hash: torrent.hash,
          torrent_name: torrent.name,
          torrent_size: torrent.size,
          torrent_tags: torrent.tags,
          files_to_delete: JSON.stringify([torrent.content_path]),
          qbittorrent_instance_id: qbitInstance.id,
          arr_instance_id: arrClient.instance.id,
        });
      }
    }
  }

  return flags;
}

export async function approveItem(itemId: number, triggeredBy: "manual" | "scheduled") {
  const item = await db
    .selectFrom("flagged_items")
    .where("id", "=", itemId)
    .selectAll()
    .executeTakeFirstOrThrow();

  if (item.status !== "pending") throw new Error("Item is not pending");

  await db
    .updateTable("flagged_items")
    .set({ status: "approved", approved_at: new Date().toISOString() })
    .where("id", "=", itemId)
    .execute();

  const { removalQueue } = await import("../lib/processing/queue");
  await removalQueue.add("remove-torrent", { itemId, triggeredBy });
}
