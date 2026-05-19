import React from "react";
import { api, type FlaggedItem, CATEGORY_LABELS, formatBytes } from "../lib";
import { Badge } from "../components/Badge";

export function ReviewPage() {
  const [items, setItems] = React.useState<FlaggedItem[]>([]);
  const [allItems, setAllItems] = React.useState<FlaggedItem[]>([]);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  const load = React.useCallback(async () => {
    const [pending, all] = await Promise.all([
      api.get<FlaggedItem[]>("/flagged-items?status=pending"),
      api.get<FlaggedItem[]>("/flagged-items"),
    ]);
    setItems(pending);
    setAllItems(all);
    setSelected(new Set());
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const counts = React.useMemo(() => {
    const c = { pending: 0, approved: 0, dismissed: 0 };
    for (const i of allItems) c[i.status]++;
    return c;
  }, [allItems]);

  const approve = async (id: number) => {
    await api.post(`/flagged-items/${id}/approve`);
    load();
  };

  const dismiss = async (id: number) => {
    await api.post(`/flagged-items/${id}/dismiss`);
    load();
  };

  const bulkAction = async (action: "approve" | "dismiss") => {
    if (selected.size === 0) return;
    const ids = [...selected];
    if (action === "approve") await api.post("/flagged-items/bulk-approve", { ids });
    else await api.post("/flagged-items/bulk-dismiss", { ids });
    load();
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const triggerScan = async () => {
    await api.post("/scans");
    load();
  };

  return (
    <>
      <div className="stats">
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--warning)" }}>
            {counts.pending}
          </div>
          <div className="stat-label">Pending Review</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {counts.approved}
          </div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--text-muted)" }}>
            {counts.dismissed}
          </div>
          <div className="stat-label">Dismissed</div>
        </div>
      </div>

      <header>
        <h1>Pending Review</h1>
        <div className="toolbar">
          <button className="primary" onClick={triggerScan}>
            Run Scan
          </button>
          <button className="success" onClick={() => bulkAction("approve")}>
            Bulk Approve
          </button>
          <button onClick={() => bulkAction("dismiss")}>Bulk Dismiss</button>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="empty">No items pending review</div>
      ) : (
        items.map((item) => {
          const files: string[] = item.files_to_delete ? JSON.parse(item.files_to_delete) : [];
          return (
            <div className="card" key={item.id}>
              <div className="card-header">
                <div>
                  <div className="card-title">{item.torrent_name || "Unknown"}</div>
                  {item.torrent_size ? (
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      {formatBytes(item.torrent_size)}
                    </span>
                  ) : null}
                </div>
                <Badge className={item.category}>
                  {CATEGORY_LABELS[item.category] || item.category}
                </Badge>
              </div>
              <div className="card-meta">
                <Badge className={item.status}>{item.status}</Badge>
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
              <div className="card-reason">{item.reason}</div>
              {files.length > 0 && (
                <div className="card-files">
                  {files.map((f, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <br />}
                      {f}
                    </React.Fragment>
                  ))}
                </div>
              )}
              {item.cross_seed_peers && item.cross_seed_peers.length > 0 && (
                <div className="card-cross-seed">
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    Also removes {item.cross_seed_peers.length} cross-seed torrent{item.cross_seed_peers.length !== 1 ? "s" : ""}:
                  </div>
                  {item.cross_seed_peers.map((peer, i) => (
                    <div key={i} style={{ fontSize: 13, color: "var(--text-muted)", paddingLeft: 8 }}>
                      {peer.torrent_name}
                    </div>
                  ))}
                </div>
              )}
              <div className="card-actions">
                <button className="success" onClick={() => approve(item.id)}>
                  Approve
                </button>
                <button onClick={() => dismiss(item.id)}>Dismiss</button>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 13,
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                  />
                  Select
                </label>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
