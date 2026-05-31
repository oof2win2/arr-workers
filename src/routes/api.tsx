import { Hono } from "hono";
import { db } from "../utils/db/index";
import { startScan, approveItem } from "../services/scan";
import { restartWithConfig } from "../services/scheduler";
import type { Instance } from "../utils/db/types";
import { ReviewList } from "../frontend/partials/ReviewList";
import { InstanceSaved } from "../frontend/pages/InstancesPage";

export const api = new Hono();

// Instances
api.get("/instances", async (c) => {
  const instances = await db.selectFrom("instances").selectAll().orderBy("id").execute();
  return c.json(instances);
});

api.post("/instances", async (c) => {
  const isHtmx = c.req.header("HX-Request");

  let body: Record<string, unknown>;
  const contentType = c.req.header("Content-Type") ?? "";

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const form = await c.req.parseBody();
    body = Object.fromEntries(
      Object.entries(form).map(([k, v]) => {
        if (k === "linked_qbittorrent_id") return [k, v ? Number(v) : null];
        return [k, v];
      }),
    );
  } else {
    body = await c.req.json();
  }

  const result = await db
    .insertInto("instances")
    .values(body as Omit<Instance, "id" | "created_at">)
    .returningAll()
    .executeTakeFirstOrThrow();

  if (isHtmx) {
    return c.html(<InstanceSaved />);
  }
  return c.json(result, 201);
});

api.get("/instances/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const inst = await db.selectFrom("instances").where("id", "=", id).selectAll().executeTakeFirst();
  return inst ? c.json(inst) : c.json({ error: "Not found" }, 404);
});

api.put("/instances/:id", async (c) => {
  const isHtmx = c.req.header("HX-Request");
  const id = Number(c.req.param("id"));

  let body: Record<string, unknown>;
  const contentType = c.req.header("Content-Type") ?? "";

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const form = await c.req.parseBody();
    body = Object.fromEntries(
      Object.entries(form).map(([k, v]) => {
        if (k === "linked_qbittorrent_id") return [k, v ? Number(v) : null];
        return [k, v];
      }),
    );
  } else {
    body = await c.req.json();
  }

  await db.updateTable("instances").set(body).where("id", "=", id).execute();

  if (isHtmx) {
    return c.html(<InstanceSaved />);
  }

  const updated = await db
    .selectFrom("instances")
    .where("id", "=", id)
    .selectAll()
    .executeTakeFirst();
  return c.json(updated);
});

api.delete("/instances/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await db.deleteFrom("instances").where("id", "=", id).execute();
  if (c.req.header("HX-Request")) {
    return c.html("");
  }
  return c.json({ ok: true });
});

// Scans
api.get("/scans", async (c) => {
  const runs = await db
    .selectFrom("scan_runs")
    .selectAll()
    .orderBy("id", "desc")
    .limit(50)
    .execute();
  return c.json(runs);
});

api.post("/scans", async (c) => {
  const id = await startScan("manual");
  const run = await db
    .selectFrom("scan_runs")
    .where("id", "=", id)
    .selectAll()
    .executeTakeFirstOrThrow();
  return c.json(run, 201);
});

api.get("/scans/latest", async (c) => {
  const run = await db.selectFrom("scan_runs").orderBy("id", "desc").selectAll().executeTakeFirst();
  return c.json(run);
});

// Flagged items
api.get("/flagged-items", async (c) => {
  let query = db.selectFrom("flagged_items").selectAll();
  const status = c.req.query("status");
  if (status) query = query.where("status", "=", status as "pending" | "approved" | "dismissed");
  const items = await query.orderBy("id", "desc").limit(200).execute();

  const instanceIds = new Set<number>();
  for (const item of items) {
    instanceIds.add(item.qbittorrent_instance_id);
    if (item.arr_instance_id) instanceIds.add(item.arr_instance_id);
  }
  const instances =
    instanceIds.size > 0
      ? await db
          .selectFrom("instances")
          .where("id", "in", [...instanceIds])
          .selectAll()
          .execute()
      : [];
  const instanceMap = Object.fromEntries(instances.map((i) => [i.id, i]));

  const itemIds = items.map((item) => item.id);
  const peers =
    itemIds.length > 0
      ? await db
          .selectFrom("cross_seed_peers")
          .where("flagged_item_id", "in", itemIds)
          .select(["flagged_item_id", "torrent_hash", "torrent_name"])
          .execute()
      : [];
  const peersByItemId = new Map<number, { torrent_hash: string; torrent_name: string }[]>();
  for (const p of peers) {
    const arr = peersByItemId.get(p.flagged_item_id) ?? [];
    arr.push({ torrent_hash: p.torrent_hash, torrent_name: p.torrent_name });
    peersByItemId.set(p.flagged_item_id, arr);
  }

  return c.json(
    items.map((item) => ({
      ...item,
      qbittorrent_instance: instanceMap[item.qbittorrent_instance_id],
      arr_instance: item.arr_instance_id ? instanceMap[item.arr_instance_id] : null,
      cross_seed_peers: peersByItemId.get(item.id) ?? [],
    })),
  );
});

api.post("/flagged-items/:id/approve", async (c) => {
  await approveItem(Number(c.req.param("id")), "manual");
  if (c.req.header("HX-Request")) {
    return c.html(<ReviewList />);
  }
  return c.json({ ok: true });
});

api.post("/flagged-items/:id/dismiss", async (c) => {
  await db
    .updateTable("flagged_items")
    .set({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .where("id", "=", Number(c.req.param("id")))
    .execute();
  if (c.req.header("HX-Request")) {
    return c.html(<ReviewList />);
  }
  return c.json({ ok: true });
});

// Audit
api.get("/audit", async (c) => {
  const entries = await db
    .selectFrom("audit_log")
    .selectAll()
    .orderBy("id", "desc")
    .limit(200)
    .execute();
  return c.json(entries);
});

// Config
api.get("/config", async (c) => {
  const entries = await db.selectFrom("config").selectAll().execute();
  return c.json(Object.fromEntries(entries.map((e) => [e.key, e.value])));
});

api.put("/config", async (c) => {
  let body: Record<string, string>;
  const contentType = c.req.header("Content-Type") ?? "";

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await c.req.parseBody();
    body = Object.fromEntries(Object.entries(form).filter(([k]) => k !== "htmx")) as Record<
      string,
      string
    >;
  } else {
    body = await c.req.json();
  }

  for (const [key, value] of Object.entries(body)) {
    await db
      .insertInto("config")
      .values({ key, value })
      .onConflict((oc) => oc.doUpdateSet({ value }))
      .execute();
  }
  restartWithConfig();
  if (c.req.header("HX-Request")) {
    return c.html(<span style={{ color: "var(--success)", marginLeft: 8 }}>Saved</span>);
  }
  return c.json({ ok: true });
});
