import type { FC } from "hono/jsx";
import { Badge } from "../components/Badge";
import { CATEGORY_LABELS, formatBytes } from "../types";
import { db } from "../../utils/db/index";
import { BASE } from "../../config";

async function getFlaggedItems(status?: string) {
  let query = db.selectFrom("flagged_items").selectAll();
  if (status) query = query.where("status", "=", status as "pending" | "approved" | "dismissed");
  const items = await query.orderBy("id", "desc").limit(200).execute();

  const instanceIds = new Set<number>();
  for (const item of items) {
    instanceIds.add(item.qbittorrent_instance_id);
    if (item.arr_instance_id) instanceIds.add(item.arr_instance_id);
  }
  const instances =
    instanceIds.size > 0
      ? await db
          .selectFrom("instances")
          .where("id", "in", [...instanceIds])
          .selectAll()
          .execute()
      : [];
  const instanceMap = Object.fromEntries(instances.map((i) => [i.id, i]));

  const itemIds = items.map((item) => item.id);
  const peers =
    itemIds.length > 0
      ? await db
          .selectFrom("cross_seed_peers")
          .where("flagged_item_id", "in", itemIds)
          .select(["flagged_item_id", "torrent_hash", "torrent_name"])
          .execute()
      : [];
  const peersByItemId = new Map<number, { torrent_hash: string; torrent_name: string }[]>();
  for (const p of peers) {
    const arr = peersByItemId.get(p.flagged_item_id) ?? [];
    arr.push({ torrent_hash: p.torrent_hash, torrent_name: p.torrent_name });
    peersByItemId.set(p.flagged_item_id, arr);
  }

  return items.map((item) => ({
    ...item,
    qbittorrent_instance: instanceMap[item.qbittorrent_instance_id],
    arr_instance: item.arr_instance_id ? instanceMap[item.arr_instance_id] : null,
    cross_seed_peers: peersByItemId.get(item.id) ?? [],
  }));
}

export const ReviewList: FC = async () => {
  const items = await getFlaggedItems("pending");

  return (
    <>
      {items.length === 0 ? (
        <div class="empty">No items pending review</div>
      ) : (
        items.map((item) => {
          const files: string[] = item.files_to_delete ? JSON.parse(item.files_to_delete) : [];
          return (
            <div class="card" id={`item-${item.id}`}>
              <div class="card-header">
                <div>
                  <div class="card-title">{item.torrent_name || "Unknown"}</div>
                  {item.torrent_size ? (
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      {formatBytes(item.torrent_size)}
                    </span>
                  ) : null}
                </div>
                <Badge class={item.category}>
                  {CATEGORY_LABELS[item.category] || item.category}
                </Badge>
              </div>
              <div class="card-meta">
                <Badge class={item.status}>{item.status}</Badge>
                {item.qbittorrent_instance && (
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    qBit: {item.qbittorrent_instance.label}
                  </span>
                )}
                {item.arr_instance && (
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {item.arr_instance.type}: {item.arr_instance.label}
                  </span>
                )}
              </div>
              <div class="card-reason">{item.reason}</div>
              {files.length > 0 && (
                <div class="card-files">
                  {files.map((f, i) => (
                    <>
                      {i > 0 && <br />}
                      {f}
                    </>
                  ))}
                </div>
              )}
              {item.cross_seed_peers && item.cross_seed_peers.length > 0 && (
                <div class="card-cross-seed">
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    Also removes {item.cross_seed_peers.length} cross-seed torrent
                    {item.cross_seed_peers.length !== 1 ? "s" : ""}:
                  </div>
                  {item.cross_seed_peers.map((peer) => (
                    <div style={{ fontSize: 13, color: "var(--text-muted)", paddingLeft: 8 }}>
                      {peer.torrent_name}
                    </div>
                  ))}
                </div>
              )}
              <div class="card-actions">
                <button
                  class="success"
                  hx-post={`${BASE}/api/flagged-items/${item.id}/approve`}
                  hx-target="#review-list"
                  hx-swap="innerHTML"
                >
                  Approve
                </button>
                <button
                  hx-post={`${BASE}/api/flagged-items/${item.id}/dismiss`}
                  hx-target="#review-list"
                  hx-swap="innerHTML"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })
      )}
    </>
  );
};
