import { db } from "../utils/db/index";
import type { FlaggedItem, Instance } from "../utils/db/types";
import { getClients, type QBittorrentClientWithMeta, type ArrClientWithMeta } from "./clients";
import { getApiV3Movie, getApiV3History } from "../lib/radarr/sdk.gen";
import { getApiV3Series, getApiV3History as getSonarrHistory } from "../lib/sonarr/sdk.gen";
import type { Torrent } from "@oof2win2/qbittorrent-api";
import { readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";

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

export async function runScan(triggeredBy: "manual" | "scheduled"): Promise<number> {
  const scanRun = await db
    .insertInto("scan_runs")
    .values({ status: "running", triggered_by: triggeredBy })
    .returning("id")
    .executeTakeFirstOrThrow();

  const scanRunId = scanRun.id;

  try {
    const { qbitClients, radarrClients, sonarrClients } = await getClients();

    const allTorrents: { torrent: Torrent; qbit: QBittorrentClientWithMeta }[] = [];
    for (const qbit of qbitClients) {
      const torrents = await qbit.client.torrents.list();
      for (const t of torrents) {
        allTorrents.push({ torrent: t, qbit });
      }
    }

    const flags: PendingFlag[] = [];

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
      flags.push(
        ...(await detectArrIssues(
          qbitTorrents.map((x) => x.torrent),
          qbitInst,
          sonarr,
          "sonarr",
        )),
      );
    }

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

    for (const flag of flags) {
      const key = `${flag.torrent_hash}:${flag.category}`;
      if (dismissedSet.has(key) || pendingSet.has(key)) continue;

      await db
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
          files_to_delete: flag.files_to_delete,
        })
        .execute();
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
  } catch (err) {
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

  return scanRunId;
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
      const thisSubItemDates = new Map<number, Date>()
      for (const h of importedEntries) {
        const subId = h[subItemIdKey] as number | undefined
        if (subId == null) continue
        const d = new Date((h.date as string) ?? 0)
        const existing = thisSubItemDates.get(subId)
        if (!existing || d > existing) {
          thisSubItemDates.set(subId, d)
        }
      }

      const otherLatestBySubItem = new Map<number, Date>()
      for (const h of allImportsForItem) {
        const subId = h[subItemIdKey] as number | undefined
        if (subId == null) continue
        const dlId = (h.downloadId as string | null)?.toLowerCase()
        if (dlId === hash) continue
        const d = new Date((h.date as string) ?? 0)
        const existing = otherLatestBySubItem.get(subId)
        if (!existing || d > existing) {
          otherLatestBySubItem.set(subId, d)
        }
      }

      let allSuperseded = true
      for (const [subId, thisDate] of thisSubItemDates) {
        const otherDate = otherLatestBySubItem.get(subId)
        if (!otherDate || otherDate <= thisDate) {
          allSuperseded = false
          break
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

  const { qbitClients } = await getClients();
  const qbit = qbitClients.find((c) => c.instance.id === item.qbittorrent_instance_id);
  if (!qbit) throw new Error("qBittorrent instance not found");

  const files: string[] = item.files_to_delete ? JSON.parse(item.files_to_delete) : [];

  if (item.torrent_hash) {
    await qbit.client.torrents.delete(item.torrent_hash, true);
  } else {
    const { unlink } = await import("node:fs/promises");
    for (const file of files) {
      try {
        await unlink(file);
      } catch {}
    }
  }

  await db
    .updateTable("flagged_items")
    .set({ status: "approved", approved_at: new Date().toISOString() })
    .where("id", "=", itemId)
    .execute();

  await db
    .insertInto("audit_log")
    .values({
      flagged_item_id: itemId,
      scan_run_id: item.scan_run_id,
      torrent_name: item.torrent_name ?? "unknown",
      torrent_hash: item.torrent_hash ?? "unknown",
      category: item.category,
      files_deleted: JSON.stringify(files),
      triggered_by: triggeredBy,
    })
    .execute();
}
