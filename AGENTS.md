# Cleanuparr - Agent Guidelines

## Project Overview

Cleanuparr is a self-hosted web application that audits qBittorrent instances against Radarr and Sonarr, surfaces stale/orphaned torrents for human review, and maintains an audit trail of all removal actions. It supports multiple instances of each service.

## Tech Stack

- **Runtime:** Bun (not Node.js)
- **Language:** TypeScript (strict mode, ESNext target)
- **Database:** SQLite via libSQL (Turso-compatible), using **Kysely** as the query builder and **Drizzle ORM** for schema definition and migrations
- **Frontend:** React 19 with Bun's built-in HTML imports and bundler (no Vite, no Express)
- **Queue:** Bunqueue (embedded SQLite-backed job queue)
- **Linting/Formatting:** oxlint + oxfmt
- **API Clients:** Auto-generated via `@hey-api/openapi-ts` for Radarr/Sonarr (`src/lib/radarr/`, `src/lib/sonarr/`)

## Commands

- `bun install` - Install dependencies
- `bun run src/index.ts` - Start the server (default port 3014, configurable via `PORT` env var)
- `bun run fmt` - Format code with oxfmt
- `bun run fmt:check` - Check formatting
- `bun run lint` - Lint with oxlint
- `bun run lint:fix` - Lint and fix
- `bunx drizzle-kit push` - Push schema changes to the database
- `bunx drizzle-kit generate` - Generate migration files
- `bun test` - Run tests

## Environment Variables

- `DATABASE_URL` - libSQL/Turso connection string (required)
- `DB_URL` - Used by drizzle-kit only (same value as `DATABASE_URL`)
- `PORT` - Server port (default: 3014)

## Project Structure

```
src/
├── index.ts                    # Entry point: Bun.serve() setup, table checks, starts scheduler
├── routes/
│   └── api.ts                  # All REST API route handlers (CRUD for instances, scans, flagged items, audit, config)
├── services/
│   ├── clients.ts              # Factory for qBittorrent, Radarr, Sonarr API clients from DB instances
│   ├── scan.ts                 # Core scan engine: fetches libraries, detects issues, writes flagged items
│   └── scheduler.ts            # Cron-based scan scheduler using Bun.cron()
├── lib/
│   ├── constants.ts            # Shared constants (cross-seed categories)
│   ├── processing/
│   │   └── queue.ts            # Bunqueue job processor for torrent removal with cross-seed peer cleanup
│   ├── radarr/                 # Auto-generated Radarr API SDK (do not edit manually)
│   └── sonarr/                 # Auto-generated Sonarr API SDK (do not edit manually)
├── utils/
│   └── db/
│       ├── schema.ts           # Drizzle ORM table definitions
│       ├── types.ts            # Kysely DB interface and TypeScript types
│       └── index.ts            # Kysely instance initialization with libSQL dialect
└── frontend/
    ├── index.html              # HTML entry point
    ├── app.tsx                 # React root component with hash-based routing
    ├── style.css               # Global styles (dark theme, CSS variables)
    ├── lib.ts                  # Frontend types, API client helper, utility functions
    ├── components/
    │   ├── Nav.tsx             # Top navigation bar
    │   ├── Badge.tsx           # Category/status badge component
    │   └── useHashRouter.ts    # Hash-based routing hook
    └── pages/
        ├── ReviewPage.tsx      # Main review queue with stats, approve/dismiss, bulk actions
        ├── InstancesPage.tsx   # Instance CRUD (qBittorrent, Radarr, Sonarr)
        ├── ScansPage.tsx       # Scan history table
        ├── AuditPage.tsx       # Audit log table
        └── SettingsPage.tsx    # Cron schedule configuration
drizzle/                        # Drizzle migration files
drizzle.config.ts               # Drizzle Kit configuration (Turso dialect)
```

## Database Schema (7 tables)

- **`instances`** - qBittorrent, Radarr, Sonarr instance configs. Radarr/Sonarr link to a qBittorrent via `linked_qbittorrent_id`.
- **`scan_runs`** - One record per scan execution (status: running/completed/failed).
- **`library_snapshots`** - Persisted \*arr library state per scan run.
- **`flagged_items`** - Detected items with category, reason, status (pending/approved/dismissed). Indexed on `status` and `scan_run_id`.
- **`cross_seed_peers`** - Cross-seed torrent matches linked to flagged items (cascade delete).
- **`audit_log`** - Append-only record of all approval actions.
- **`config`** - Key-value config store (e.g., `scan_cron`).

## API Routes

All API routes are prefixed with `/api/`. All return JSON.

| Method         | Route                             | Description                                       |
| -------------- | --------------------------------- | ------------------------------------------------- |
| GET/POST       | `/api/instances`                  | List/create instances                             |
| GET/PUT/DELETE | `/api/instances/:id`              | Get/update/delete instance                        |
| GET/POST       | `/api/scans`                      | List scan history / trigger manual scan           |
| GET            | `/api/scans/latest`               | Get latest scan                                   |
| GET            | `/api/flagged-items`              | List flagged items (optional `?status=` filter)   |
| POST           | `/api/flagged-items/:id/approve`  | Approve a flagged item (queues removal)           |
| POST           | `/api/flagged-items/:id/dismiss`  | Dismiss a flagged item                            |
| POST           | `/api/flagged-items/bulk-approve` | Bulk approve by `{ ids: number[] }`               |
| POST           | `/api/flagged-items/bulk-dismiss` | Bulk dismiss by `{ ids: number[] }`               |
| GET            | `/api/audit`                      | List audit log entries                            |
| GET/PUT        | `/api/config`                     | Get/update config (updates restart the scheduler) |

## Detection Categories

1. **`orphaned_files`** - Files in qBittorrent download dir with no associated torrent. (Currently commented out in scan.ts)
2. **`tagged_no_arr_record`** - Torrent has radarr/sonarr category tag but the \*arr has no history record.
3. **`arr_deleted`** - Torrent was imported by \*arr, but the movie/series no longer exists in the library.
4. **`superseded`** - A newer import exists for the same movie/episode (this torrent is no longer the active file).

## Key Flows

### Scan Flow

1. `runScan()` in `src/services/scan.ts` creates a `scan_runs` record
2. Fetches all clients via `getClients()` (reads `instances` table)
3. Fetches all torrents from all qBittorrent instances
4. Identifies cross-seed torrents by category (`cross-seed-link`, `cross-seed-manual`, `UploadAssistant`)
5. Runs detection per Radarr/Sonarr instance via `detectArrIssues()`
6. Deduplicates against already-pending and already-dismissed items
7. Resolves file paths for flagged items
8. Matches cross-seed peers by comparing file sizes
9. Updates scan run status to completed/failed

### Removal Flow

1. User approves item via API → `approveItem()` sets status to "approved"
2. Job is added to `removalQueue` (Bunqueue)
3. Queue processor deletes torrent + files from qBittorrent
4. Also deletes matched cross-seed peer torrents
5. Writes to `audit_log`

## Code Conventions

- Use Bun APIs, not Node.js equivalents (e.g., `Bun.serve()`, `Bun.env`, `Bun.cron()`, `Bun.file`)
- Database queries use Kysely query builder (not Drizzle's query API) — Drizzle is only for schema + migrations
- The `db` singleton is exported from `src/utils/db/index.ts`
- Auto-generated SDKs in `src/lib/radarr/` and `src/lib/sonarr/` should not be manually edited
- Frontend uses hash-based routing (`#/review`, `#/instances`, `#/scans`, `#/audit`, `#/settings`)
- No UI framework — plain CSS with CSS custom properties (dark theme)
- JSON fields (`files_to_delete`, `torrent_name` in audit) stored as JSON strings in SQLite
- Instance types: `"qbittorrent"`, `"radarr"`, `"sonarr"`
- Flagged item statuses: `"pending"`, `"approved"`, `"dismissed"`
- Scan run statuses: `"running"`, `"completed"`, `"failed"`
- Cross-seed categories defined in `src/lib/constants.ts`

## Testing

Use `bun test` with Bun's built-in test runner. Import from `bun:test`:

```ts
import { test, expect } from "bun:test";
```
