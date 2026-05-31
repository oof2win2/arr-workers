import type { FC } from "hono/jsx";
import { Badge } from "../components/Badge";
import { type FlaggedItem, CATEGORY_LABELS, formatBytes } from "../types";
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

async function getItemCounts() {
  const all = await db.selectFrom("flagged_items").select("status").execute();
  const counts = { pending: 0, approved: 0, dismissed: 0 };
  for (const i of all) counts[i.status as keyof typeof counts]++;
  return counts;
}

function itemCard(
  item: FlaggedItem & { cross_seed_peers?: { torrent_hash: string; torrent_name: string }[] },
) {
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
        <Badge class={item.category}>{CATEGORY_LABELS[item.category] || item.category}</Badge>
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
}

export const ReviewPage: FC = async () => {
  const [items, counts] = await Promise.all([getFlaggedItems("pending"), getItemCounts()]);

  return (
    <>
      <div class="stats">
        <div class="stat-card">
          <div class="stat-value" style={{ color: "var(--warning)" }}>
            {counts.pending}
          </div>
          <div class="stat-label">Pending Review</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style={{ color: "var(--success)" }}>
            {counts.approved}
          </div>
          <div class="stat-label">Approved</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style={{ color: "var(--text-muted)" }}>
            {counts.dismissed}
          </div>
          <div class="stat-label">Dismissed</div>
        </div>
      </div>

      <header>
        <h1>Pending Review</h1>
        <div class="toolbar">
          <button
            class="primary"
            onclick={`fetch('${BASE}/api/scans',{method:'POST'}).then(()=>location.reload())`}
          >
            Run Scan
          </button>
        </div>
      </header>

      <div id="review-list">
        {items.length === 0 ? (
          <div class="empty">No items pending review</div>
        ) : (
          items.map((item) =>
            itemCard(
              item as FlaggedItem & {
                cross_seed_peers?: { torrent_hash: string; torrent_name: string }[];
              },
            ),
          )
        )}
      </div>
    </>
  );
};
