import { createQBittorrentClient, type QBittorrentClient } from "@oof2win2/qbittorrent-api";
import { createClient } from "../lib/radarr/client/client.gen";
import type { Instance } from "../utils/db/types";
import { db } from "../utils/db/index";

export type QBittorrentClientWithMeta = { client: QBittorrentClient; instance: Instance };

export interface ArrClient {
  get: (options: any) => Promise<any>;
  post: (options: any) => Promise<any>;
  put: (options: any) => Promise<any>;
  delete: (options: any) => Promise<any>;
}

export type ArrClientWithMeta = {
  client: ArrClient;
  instance: Instance;
  qbittorrentInstance: Instance;
};

export function createQbitClient(instance: Instance): QBittorrentClientWithMeta {
  if (instance.type !== "qbittorrent") throw new Error("Not a qBittorrent instance");
  return {
    client: createQBittorrentClient({
      url: instance.url,
      username: instance.username ?? "",
      password: instance.password ?? "",
    }),
    instance,
  };
}

export function createArrClient(instance: Instance): ArrClient {
  return createClient({
    baseUrl: instance.url.replace(/\/+$/, ""),
    headers: {
      "X-Api-Key": instance.api_key ?? "",
    },
  }) as unknown as ArrClient;
}

export async function getClients() {
  const allInstances = await db.selectFrom("instances").selectAll().execute();

  const qbitClients: QBittorrentClientWithMeta[] = [];
  const radarrClients: ArrClientWithMeta[] = [];
  const sonarrClients: ArrClientWithMeta[] = [];

  const qbitMap = new Map<number, Instance>();
  for (const inst of allInstances) {
    if (inst.type === "qbittorrent") {
      qbitClients.push(createQbitClient(inst));
      qbitMap.set(inst.id, inst);
    }
  }

  for (const inst of allInstances) {
    if (inst.linked_qbittorrent_id == null) continue;
    const qbit = qbitMap.get(inst.linked_qbittorrent_id);
    if (!qbit) continue;

    if (inst.type === "radarr") {
      radarrClients.push({
        client: createArrClient(inst),
        instance: inst,
        qbittorrentInstance: qbit,
      });
    }
    if (inst.type === "sonarr") {
      sonarrClients.push({
        client: createArrClient(inst),
        instance: inst,
        qbittorrentInstance: qbit,
      });
    }
  }

  return { qbitClients, radarrClients, sonarrClients };
}
