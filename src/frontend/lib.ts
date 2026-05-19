export interface CrossSeedPeer {
  torrent_hash: string;
  torrent_name: string;
}

export interface FlaggedItem {
  id: number;
  scan_run_id: number;
  qbittorrent_instance_id: number;
  arr_instance_id: number | null;
  category: "orphaned_files" | "tagged_no_arr_record" | "arr_deleted" | "superseded";
  reason: string;
  torrent_hash: string | null;
  torrent_name: string | null;
  torrent_size: number | null;
  torrent_tags: string | null;
  files_to_delete: string | null;
  status: "pending" | "approved" | "dismissed";
  created_at: string;
  qbittorrent_instance?: { id: number; label: string; type: string };
  arr_instance?: { id: number; label: string; type: string } | null;
  cross_seed_peers?: CrossSeedPeer[];
}

export interface Instance {
  id: number;
  type: "qbittorrent" | "radarr" | "sonarr";
  label: string;
  url: string;
  username: string | null;
  password: string | null;
  api_key: string | null;
  download_dir: string | null;
  radarr_tag: string | null;
  sonarr_tag: string | null;
  linked_qbittorrent_id: number | null;
  created_at: string;
}

export interface ScanRun {
  id: number;
  started_at: string;
  completed_at: string | null;
  status: "running" | "completed" | "failed";
  summary: string | null;
  triggered_by: "manual" | "scheduled";
}

export interface AuditEntry {
  id: number;
  flagged_item_id: number;
  scan_run_id: number;
  torrent_name: string;
  torrent_hash: string;
  category: string;
  files_deleted: string;
  triggered_by: string;
  created_at: string;
}

export const CATEGORY_LABELS: Record<string, string> = {
  orphaned_files: "Orphaned Files",
  tagged_no_arr_record: "No *arr Record",
  arr_deleted: "Deleted from *arr",
  superseded: "Superseded",
};

export function formatBytes(bytes: number | null) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const API = "/api";

export const api = {
  get: <T = unknown>(path: string): Promise<T> => fetch(`${API}${path}`).then((r) => r.json()),
  post: <T = unknown>(path: string, body?: unknown): Promise<T> =>
    fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => r.json()),
  put: <T = unknown>(path: string, body?: unknown): Promise<T> =>
    fetch(`${API}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => r.json()),
  del: <T = unknown>(path: string): Promise<T> =>
    fetch(`${API}${path}`, { method: "DELETE" }).then((r) => r.json()),
};
