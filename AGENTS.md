# arr-workers — Agent Guidelines

This is a Bun workspace monorepo holding two independent services that integrate with the
\*arr ecosystem (Radarr, Sonarr) and qBittorrent. Each package has its own docs — read the
relevant one before working in that package.

## Packages

- **`cleanuparr/`** — qBittorrent audit web app. See `cleanuparr/AGENTS.md` for full
  architecture, DB schema, API routes, and detection logic. See `cleanuparr/CLAUDE.md` for
  Bun-specific conventions.
- **`filtarr/`** — webhook service that removes downloads with blacklisted file extensions
  from the Radarr/Sonarr queue. See `filtarr/README.md`.

## Workspace basics

- Dependencies are installed **once at the repo root**: `bun install` (Bun workspaces).
  Do not run `bun install` separately inside a package unless intentionally breaking out of
  the workspace — prefer the root install so dependencies stay hoisted and there is a single
  `bun.lock`.
- There is one root `package.json` (workspace definition + convenience scripts) and one
  `package.json` per package.
- Run a package's script from the root with `bun --filter <name> <script>`, e.g.
  `bun --filter cleanuparr dev`, or use the root aliases (`bun run dev:cleanuparr`).
- When editing a single package, you can also `cd` into it and run Bun directly.

## Runtime & tooling — always use Bun

Default to **Bun** instead of Node.js / npm / pnpm / yarn / ts-node / vite. This applies to
both packages. Key rules:

- `bun install` — not `npm install` / `yarn` / `pnpm install`
- `bun run <file>` — not `node` / `ts-node`
- `bun test` — not `jest` / `vitest` (import from `bun:test`)
- `bunx <pkg> <cmd>` — not `npx`
- Bun loads `.env` automatically — **do not** use `dotenv`.
- Prefer Bun APIs over Node equivalents where they exist:
  - `Bun.serve()` (supports routes + WebSockets) — not `express` (cleanuparr also uses Hono on top)
  - `Bun.file` / `Bun.write` — not `node:fs` readFile/writeFile
  - `Bun.$` — not `execa`
  - `Bun.cron()` for scheduling (cleanuparr)
  - `bun:sqlite` / `Bun.sql` / `Bun.redis` over third-party clients where applicable

### Tooling differs per package

The two packages use different linters/formatters — do not assume one config applies to both:

- **cleanuparr** → `oxlint` + `oxfmt` (`bun run lint`, `bun run fmt`)
- **filtarr** → `biome` (`bun run lint`, `bun run fmt`)

The root scripts (`bun run lint`, `bun run fmt`, …) just fan out to each package's own tools.

## TypeScript

Both packages target `ESNext`, run in bundler module resolution, and emit nothing (`noEmit`).
Type-checking is done by the editor/Bun; there is no separate `tsc` build step.

## Per-package context before you start

- **cleanuparr** — read `cleanuparr/AGENTS.md` in full. Critical points:
  - Database: SQLite via libSQL, queried with **Kysely** (Drizzle is schema/migrations only —
    do not use Drizzle's query API for reads/writes).
  - Auto-generated SDKs in `cleanuparr/src/lib/radarr/` and `cleanuparr/src/lib/sonarr/` —
    **do not edit manually**.
  - Frontend is React 19 served via Bun's HTML imports/bundler (no Vite, no Express),
    hash-based routing, plain CSS dark theme.
  - `cleanuparr/PRD.md` (product spec) and `cleanuparr/TASKS.md` (known issues / TODOs) are
    good sources of intent.
- **filtarr** — small service; read `filtarr/src/index.ts` and `filtarr/src/config.ts`.
  Webhooks arrive on `POST /radarr` and `POST /sonarr`; processing is serialized via a
  single-concurrency `p-queue`.

## Conventions

- Keep package boundaries clean: shared runtime/domain overlap (qBittorrent/\*arr) does **not**
  mean shared code. Each package is independent and can be deployed on its own.
- When adding a dependency, add it to the **package's** `package.json`, then `bun install` at
  the root so the lockfile updates.
- Respect each package's existing formatting/quote style when editing (oxfmt vs biome — note
  biome is configured with double quotes + tabs in filtarr).
- Commit messages and branch conventions follow whatever the active remote expects; remember
  `cleanuparr` and `filtarr` are also standalone repos (extra git remotes).

## Testing

Use `bun test` with Bun's built-in runner. Import from `bun:test`:

```ts
import { test, expect } from "bun:test";

test("example", () => {
  expect(1).toBe(1);
});
```

Test files live alongside source in each package (`*.test.ts`).
