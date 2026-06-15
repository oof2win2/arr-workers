# arr-workers

A [Bun](https://bun.com) monorepo collecting self-hosted workers that integrate with the
\*arr ecosystem (Radarr, Sonarr) and qBittorrent.

## Packages

| Package | Description |
| --- | --- |
| **[cleanuparr](./cleanuparr)** | Web app that audits qBittorrent instances against Radarr & Sonarr, surfaces stale/orphaned/superseded torrents for human review, and keeps a full audit trail of removals. (libSQL, Kysely + Drizzle, React, Hono, Bunqueue) |
| **[filtarr](./filtarr)** | Webhook service that inspects new downloads from Radarr/Sonarr, removes torrents containing blacklisted file extensions from the queue (and blocklists them), and resumes clean ones. (itty-router, got, p-queue, zod) |

Both packages share the Bun runtime and the same qBittorrent/\*arr integration domain, but are
independent services — they can be run and deployed on their own.

## Prerequisites

- [Bun](https://bun.com) v1.3+

## Getting started

Dependencies are installed once at the root via [Bun workspaces](https://bun.com/docs/install/workspaces):

```bash
bun install
```

This hoists shared dependencies and creates a single root `bun.lock`. Per-package
`node_modules` are linked automatically.

### Run a package

Run a package's script from the root using [`bun --filter`](https://bun.com/docs/install/workspaces#running-scripts):

```bash
bun --filter cleanuparr dev      # start cleanuparr dev server
bun --filter filtarr dev         # start filtarr
```

Or with the provided aliases:

```bash
bun run dev:cleanuparr
bun run dev:filtarr
```

You can also `cd` into a package and run Bun commands directly:

```bash
cd cleanuparr
bun install          # still works, respects the workspace
bun run src/index.ts
```

## Scripts

The root `package.json` defines convenience scripts that delegate to each workspace.
Note that the two packages use **different tooling** — cleanuparr uses `oxlint`/`oxfmt`,
filtarr uses `biome` — so the root scripts just fan out to each package's own tool.

| Command | Description |
| --- | --- |
| `bun run dev:cleanuparr` | Start cleanuparr |
| `bun run dev:filtarr` | Start filtarr |
| `bun run build:cleanuparr` | Compile cleanuparr to a standalone binary |
| `bun run lint` | Lint all packages |
| `bun run lint:fix` | Lint and auto-fix all packages |
| `bun run fmt` | Format all packages |
| `bun run fmt:check` | Check formatting across all packages |
| `bun run clean` | Remove build artifacts |

## Layout

```
arr-workers/
├── package.json        # Workspace root (this repo)
├── cleanuparr/         # qBittorrent audit web app  (see its own README / AGENTS.md)
│   └── …
└── filtarr/            # Download filtering webhook service
    └── …
```

Each package keeps its own `package.json`, tooling config, and detailed documentation.
See `cleanuparr/README.md` and `filtarr/README.md` for per-package setup, configuration,
and architecture notes.

## Repository layout & remotes

`cleanuparr` and `filtarr` are also available as standalone repositories, added as extra
git remotes (`cleanuparr`, `filtarr`) alongside the monorepo `origin`. This lets changes be
pulled into or pushed out of each upstream independently.

```bash
git remote -v   # origin (this repo), cleanuparr, filtarr
```
