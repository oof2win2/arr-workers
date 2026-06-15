# Cleanuparr

A self-hosted web application that audits your qBittorrent instances against Radarr and Sonarr, surfaces stale, orphaned, and superseded torrents for human review, and maintains a full audit trail of every removal action.

## Features

- **Multi-instance support** — configure multiple qBittorrent, Radarr, and Sonarr instances
- **Four detection categories**:
  - **Orphaned files** — files in the download dir with no managing torrent
  - **No \*arr record** — tagged torrent that the linked Radarr/Sonarr has no history of
  - **Deleted from \*arr** — torrent was imported, but the movie/series no longer exists in the library
  - **Superseded** — a newer quality import exists for the same movie/episode
- **Cross-seed aware** — automatically detects and removes associated cross-seed peer torrents
- **Review queue** — approve or dismiss flagged items individually or in bulk via the web UI
- **Audit trail** — every approval action is recorded with full context (who, what, when, why)
- **Scheduled scans** — configurable cron schedule (default: hourly), also triggerable manually

## Tech Stack

- **Runtime:** [Bun](https://bun.com)
- **Database:** SQLite via libSQL (Turso-compatible) with Kysely query builder and Drizzle ORM for schema/migrations
- **Frontend:** React 19, served with Bun's built-in bundler (no Vite or Express)
- **Queue:** Bunqueue (embedded SQLite-backed job queue)
- **API Clients:** Auto-generated via `@hey-api/openapi-ts`

## Getting Started

### Prerequisites

- [Bun](https://bun.com) v1.3+
- A libSQL/Turso database (local or remote)

### Setup

```bash
bun install
```

Create a `.env` file (Bun loads it automatically):

```env
DATABASE_URL=file:dev.db
PORT=3014
```

Push the database schema:

```bash
bunx drizzle-kit push
```

Start the server:

```bash
bun run src/index.ts
```

Open `http://localhost:3014` in your browser.

## Usage

1. **Add instances** — Go to the Instances page and configure your qBittorrent, Radarr, and Sonarr instances. Radarr/Sonarr instances must be linked to a qBittorrent instance.
2. **Run a scan** — Use the "Run Scan" button on the Review Queue page, or wait for the scheduled scan.
3. **Review items** — Flagged torrents appear in the review queue with their detection category, reason, associated instances, and files that would be deleted.
4. **Approve or dismiss** — Approve items to remove the torrent (and cross-seed peers) from qBittorrent, or dismiss items to ignore them in future scans.
5. **Audit log** — All approved removals are recorded in the audit log with timestamps, file lists, and trigger type.

## Configuration

The scan schedule is configurable via the Settings page using a cron expression (default: `0 * * * *` for hourly scans).

## Development

```bash
bun run fmt          # Format code with oxfmt
bun run fmt:check    # Check formatting
bun run lint         # Lint with oxlint
bun run lint:fix     # Lint and auto-fix
bun test             # Run tests
bunx drizzle-kit generate  # Generate migration files
```
