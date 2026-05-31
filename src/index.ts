import { Hono } from "hono";
import { api } from "./routes/api";
import { pages } from "./routes/pages";
import { restartWithConfig } from "./services/scheduler";
import { db } from "./utils/db/index";
import { sql } from "kysely";
import { PORT, BASE } from "./config";
import { logger } from "./lib/logger";

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
      logger.error({ table }, "Table not found — run `bunx drizzle-kit push` first");
    }
  }
  const hasConfig = await db.selectFrom("config").select("key").limit(1).executeTakeFirst();
  if (!hasConfig) {
    await db.insertInto("config").values({ key: "scan_cron", value: "0 * * * *" }).execute();
    logger.info("Inserted default config");
  }
}

// Build all routes into a single app
const app = new Hono();

// Request logging middleware
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  logger.info(
    { method: c.req.method, path: c.req.path, status: c.res.status, duration },
    "Request",
  );
});

app.route("/", pages).route("/api", api);

ensureTables().then(() => {
  restartWithConfig();

  if (BASE) {
    const baseApp = new Hono();
    baseApp.get(BASE, (c) => c.redirect(BASE + "/", 301));
    baseApp.all(BASE + "/*", async (c) => {
      const url = new URL(c.req.url);
      const strippedPath = url.pathname.slice(BASE.length) || "/";
      const newUrl = new URL(strippedPath + url.search, url.origin);
      const newReq = new Request(newUrl, c.req.raw);
      return app.fetch(newReq);
    });
    Bun.serve({ port: PORT, fetch: baseApp.fetch });
  } else {
    Bun.serve({ port: PORT, fetch: app.fetch });
  }

  logger.info({ port: PORT, basePath: BASE || "/" }, "Cleanuparr started");
});
