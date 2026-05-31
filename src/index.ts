import { Hono } from "hono";
import { api } from "./routes/api";
import { pages } from "./routes/pages";
import { restartWithConfig } from "./services/scheduler";
import { db } from "./utils/db/index";
import { sql } from "kysely";
import { PORT, BASE } from "./config";

async function ensureTables() {
  const tables = [
    "config",
    "instances",
    "scan_runs",
    "library_snapshots",
    "flagged_items",
    "audit_log",
  ];
  for (const table of tables) {
    const exists =
      await sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${table}`.execute(db);
    if (exists.rows.length === 0) {
      console.log(`Table "${table}" not found. Run "bunx drizzle-kit push" first.`);
    }
  }
  const hasConfig = await db.selectFrom("config").select("key").limit(1).executeTakeFirst();
  if (!hasConfig) {
    await db.insertInto("config").values({ key: "scan_cron", value: "0 * * * *" }).execute();
  }
}

// Build all routes into a single app
const app = new Hono().route("/", pages).route("/api", api);

ensureTables().then(() => {
  restartWithConfig();

  if (BASE) {
    // With base path: strip prefix and dispatch to the route app
    const baseApp = new Hono();

    // Redirect /base → /base/ for correct relative asset resolution
    baseApp.get(BASE, (c) => c.redirect(BASE + "/", 301));

    // Handle all requests under /base/
    baseApp.all(BASE + "/*", async (c) => {
      const url = new URL(c.req.url);
      // Strip base prefix, ensure leading slash
      const strippedPath = url.pathname.slice(BASE.length) || "/";
      // Build new URL with stripped path
      const newUrl = new URL(strippedPath + url.search, url.origin);
      // Create a new request with the stripped path
      const newReq = new Request(newUrl, c.req.raw);
      return app.fetch(newReq);
    });

    Bun.serve({ port: PORT, fetch: baseApp.fetch });
  } else {
    Bun.serve({ port: PORT, fetch: app.fetch });
  }

  console.log(
    `Cleanuparr running on http://localhost:${PORT}${BASE ? " (base: " + BASE + ")" : ""}`,
  );
});
