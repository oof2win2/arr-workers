import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const instances = sqliteTable("instances", {
  id: integer().primaryKey({ autoIncrement: true }),
  type: text({ enum: ["qbittorrent", "radarr", "sonarr"] }).notNull(),
  label: text().notNull(),
  url: text().notNull(),
  username: text(),
  password: text(),
  api_key: text(),
  download_dir: text(),
  radarr_tag: text().default("radarr"),
  sonarr_tag: text().default("sonarr"),
  linked_qbittorrent_id: integer(),
  created_at: text()
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const scanRuns = sqliteTable("scan_runs", {
  id: integer().primaryKey({ autoIncrement: true }),
  started_at: text()
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  completed_at: text(),
  status: text({ enum: ["running", "completed", "failed"] })
    .notNull()
    .default("running"),
  summary: text(),
  triggered_by: text({ enum: ["manual", "scheduled"] })
    .notNull()
    .default("manual"),
});

export const librarySnapshots = sqliteTable("library_snapshots", {
  id: integer().primaryKey({ autoIncrement: true }),
  scan_run_id: integer()
    .notNull()
    .references(() => scanRuns.id, { onDelete: "cascade" }),
  instance_id: integer()
    .notNull()
    .references(() => instances.id, { onDelete: "cascade" }),
  data: text().notNull(),
  created_at: text()
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const flaggedItems = sqliteTable(
  "flagged_items",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    scan_run_id: integer()
      .notNull()
      .references(() => scanRuns.id, { onDelete: "cascade" }),
    qbittorrent_instance_id: integer()
      .notNull()
      .references(() => instances.id, { onDelete: "cascade" }),
    arr_instance_id: integer().references(() => instances.id, { onDelete: "set null" }),
    category: text({
      enum: ["orphaned_files", "tagged_no_arr_record", "arr_deleted", "superseded"],
    }).notNull(),
    reason: text().notNull(),
    torrent_hash: text(),
    torrent_name: text(),
    torrent_size: integer(),
    torrent_tags: text(),
    files_to_delete: text(),
    status: text({ enum: ["pending", "approved", "dismissed"] })
      .notNull()
      .default("pending"),
    dismissed_at: text(),
    approved_at: text(),
    created_at: text()
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("flagged_items_status_idx").on(table.status),
    index("flagged_items_scan_run_id_idx").on(table.scan_run_id),
  ],
);

export const auditLog = sqliteTable("audit_log", {
  id: integer().primaryKey({ autoIncrement: true }),
  flagged_item_id: integer()
    .notNull()
    .references(() => flaggedItems.id, { onDelete: "cascade" }),
  scan_run_id: integer()
    .notNull()
    .references(() => scanRuns.id, { onDelete: "cascade" }),
  torrent_name: text().notNull(),
  torrent_hash: text().notNull(),
  category: text().notNull(),
  files_deleted: text().notNull(),
  triggered_by: text().notNull(),
  created_at: text()
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const config = sqliteTable("config", {
  key: text().primaryKey(),
  value: text().notNull(),
});
