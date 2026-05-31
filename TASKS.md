# Cleanuparr - Improvement Tasks

## 🔴 High Priority

- [ ] **Scan runs synchronously on API call**
      `POST /api/scans` blocks until the entire scan completes. For large libraries this could take minutes and timeout the HTTP request. The scan should run in the background and the API should return immediately with the `scan_runs` record (which it already creates with `"running"` status).
      (see git stash)

- [ ] **No protection against concurrent scans**
      There's no check if a scan is already running before starting a new one. Two overlapping scans would create duplicate flagged items and race on the DB. Add a guard in `runScan()`:

  ```ts
  const running = await db
    .selectFrom("scan_runs")
    .where("status", "=", "running")
    .select("id")
    .executeTakeFirst();
  if (running) throw new Error("Scan already running");
  ```

  (see git stash)

- [ ] Deployment to server via git
      Server has a git repo that I can push to, but deploying the server is currently an issue due to nginx (i think)

- [ ] **No error handling in API routes**
      `handleApi()` has zero try/catch blocks. A DB error, invalid JSON body, or missing field returns an unhandled 500 with no useful message. Every route should be wrapped with error handling, or use a top-level catch that returns a proper JSON error response.

- [ ] **No input validation**
      `POST /api/instances` accepts whatever JSON is sent. You could create an instance with `type: "lol"` or missing required fields. Add schema validation (e.g. Zod or a simple validation layer).

## 🟡 Medium Priority

- [ ] **No pagination on any endpoint**
      Scans, flagged items, and audit log all use hardcoded `LIMIT 50/200`. As the app runs, the audit log and flagged items tables will grow unbounded with no way to page through results. Add `?page=&limit=` query params with total count headers.

- [ ] **Frontend has no loading or error states**
      Every page fetches data in a `useEffect` with no loading indicator. While loading, users see "No items pending review" or "No scans yet" — indistinguishable from actually empty state. API errors are silently swallowed (`.then()` with no `.catch()`). Add loading spinners/skeletons and error toasts.

- [ ] **Bulk approve is sequential, not transactional**
      The bulk-approve endpoint loops through IDs one-by-one with individual try/catch that silently swallows errors:

  ```ts
  for (const id of ids) {
    try {
      await approveItem(id, "manual");
    } catch {} // errors silently eaten
  }
  ```

  This should use a transaction and report back which items failed.

- [ ] **No instance connectivity test**
      Users add qBittorrent/Radarr/Sonarr instances with no way to verify the connection works. Add a `POST /api/instances/test` endpoint that tries to connect and returns success/failure.

- [ ] **`library_snapshots` table is defined but never used**
      It's in the schema but nothing reads or writes to it. Either use it (to speed up subsequent scans by comparing library state) or remove it.

- [ ] **History fetch could be extremely slow for large libraries**
      `fetchArrHistory()` pages through ALL history in chunks of 1000. For a large Radarr/Sonarr instance, this could be tens of thousands of records loaded into memory. Consider:
  - Only fetching history since the last scan
  - Filtering by eventType server-side
  - Caching results per scan run (that's what `library_snapshots` could be for)

- [ ] **Orphaned file detection is disabled**
      The `detectOrphanedFiles` function exists but is commented out. Re-enable behind a per-instance or global setting.

- [ ] **Review page only shows pending items**
      There's no way to review previously approved or dismissed items from the UI. The API supports `?status=` filtering but the frontend doesn't use it outside the stats count.

## 🟢 Nice to Have

- [ ] **No tests**
      Zero test coverage. Critical flows like `detectArrIssues`, `matchCrossSeedPeers`, and `fileSizesSubset` are pure logic that would be easy to unit test. Add `bun test` coverage for core scan logic.

- [ ] **Dashboard / space-saved tracking**
      The app tracks what was deleted in `audit_log` but doesn't surface any aggregate stats. Add a dashboard showing "Space freed this week", "Items removed by category", trend over time, etc.

- [ ] **Real-time scan progress**
      When a scan is triggered, the user has to manually refresh to see results. Add a polling mechanism, SSE, or even just auto-refresh while a scan is `running`.

- [ ] **Filtering and search on flagged items**
      No way to filter by category, instance, or search by torrent name. As flagged items grow, finding specific ones becomes hard. Add filter controls and a search box.

- [ ] **Approve confirmation / undo window**
      Approving immediately queues removal. There's no confirmation dialog and no undo. Even a 5-second "Undo?" toast would save accidental deletions.

- [ ] **"Select All" checkbox for bulk actions**
      The bulk action workflow requires checking each item individually. Add a select-all toggle.

- [ ] **Audit log filtering**
      No date range, category, or instance filtering on the audit page. Add filter controls.

- [ ] **Password masking in the database**
      qBittorrent credentials are stored in plaintext. Add basic encryption at rest for sensitive fields.
