import type { Kyselify } from "drizzle-orm/kysely";
import type { Selectable } from "kysely";
import type * as schema from "./schema";

export interface DB {
  instances: Kyselify<(typeof schema)["instances"]>;
  scan_runs: Kyselify<(typeof schema)["scanRuns"]>;
  library_snapshots: Kyselify<(typeof schema)["librarySnapshots"]>;
  flagged_items: Kyselify<(typeof schema)["flaggedItems"]>;
  audit_log: Kyselify<(typeof schema)["auditLog"]>;
  config: Kyselify<(typeof schema)["config"]>;
}

export type Instance = Selectable<DB["instances"]>;
export type ScanRun = Selectable<DB["scan_runs"]>;
export type LibrarySnapshot = Selectable<DB["library_snapshots"]>;
export type FlaggedItem = Selectable<DB["flagged_items"]>;
export type AuditLogEntry = Selectable<DB["audit_log"]>;
export type ConfigEntry = Selectable<DB["config"]>;
