import { handleApi } from "./routes/api";
import { restartWithConfig } from "./services/scheduler";
import { db } from "./utils/db/index";
import { sql } from "kysely";
import indexHtml from "./frontend/index.html";
import { removalQueue } from "./lib/processing/queue";

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

const PORT = Number(Bun.env.PORT ?? 3014);
const BASE = (Bun.env.BASE_URL ?? "").replace(/\/$/, "");

ensureTables().then(() => {
  restartWithConfig();

  Bun.serve({
    port: PORT,
    routes: {
      "/": indexHtml,
      "/api/*": {
        GET: async (req) => handleApi(req, new URL(req.url).pathname),
        POST: async (req) => handleApi(req, new URL(req.url).pathname),
        PUT: async (req) => handleApi(req, new URL(req.url).pathname),
        DELETE: async (req) => handleApi(req, new URL(req.url).pathname),
      },
    },
    fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      // Redirect /base → /base/ so relative asset paths resolve correctly
      if (BASE && path === BASE) {
        return Response.redirect(url.href + "/", 301);
      }

      // Strip base prefix for routed requests
      if (BASE && path.startsWith(BASE + "/")) {
        const stripped = path.slice(BASE.length) || "/";
        if (stripped.startsWith("/api/")) {
          return handleApi(req, stripped);
        }
        if (stripped === "/") {
          return new Response(indexHtml);
        }
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`Cleanuparr running on http://localhost:${PORT}${BASE ? " (base: " + BASE + ")" : ""}`);
});
