import { db } from "../utils/db/index";
import { runScan, approveItem } from "../services/scan";
import { restartWithConfig } from "../services/scheduler";
import type { Instance } from "../utils/db/types";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleApi(req: Request, path: string): Promise<Response> {
  const method = req.method;
  const url = new URL(req.url);

  if (path === "/api/instances" && method === "GET") {
    const instances = await db.selectFrom("instances").selectAll().orderBy("id").execute();
    return json(instances);
  }

  if (path === "/api/instances" && method === "POST") {
    const body = (await req.json()) as Omit<Instance, "id" | "created_at">;
    const result = await db
      .insertInto("instances")
      .values(body)
      .returningAll()
      .executeTakeFirstOrThrow();
    return json(result, 201);
  }

  const instanceMatch = path.match(/^\/api\/instances\/(\d+)$/);
  if (instanceMatch) {
    const id = Number(instanceMatch[1]);
    if (method === "GET") {
      const inst = await db
        .selectFrom("instances")
        .where("id", "=", id)
        .selectAll()
        .executeTakeFirst();
      return inst ? json(inst) : json({ error: "Not found" }, 404);
    }
    if (method === "PUT") {
      const body = (await req.json()) as Partial<Instance>;
      await db.updateTable("instances").set(body).where("id", "=", id).execute();
      const updated = await db
        .selectFrom("instances")
        .where("id", "=", id)
        .selectAll()
        .executeTakeFirst();
      return json(updated);
    }
    if (method === "DELETE") {
      await db.deleteFrom("instances").where("id", "=", id).execute();
      return json({ ok: true });
    }
  }

  if (path === "/api/scans" && method === "GET") {
    const runs = await db
      .selectFrom("scan_runs")
      .selectAll()
      .orderBy("id", "desc")
      .limit(50)
      .execute();
    return json(runs);
  }

  if (path === "/api/scans" && method === "POST") {
    const id = await runScan("manual");
    const run = await db
      .selectFrom("scan_runs")
      .where("id", "=", id)
      .selectAll()
      .executeTakeFirstOrThrow();
    return json(run, 201);
  }

  if (path === "/api/scans/latest" && method === "GET") {
    const run = await db
      .selectFrom("scan_runs")
      .orderBy("id", "desc")
      .selectAll()
      .executeTakeFirst();
    return json(run);
  }

  if (path === "/api/flagged-items" && method === "GET") {
    let query = db.selectFrom("flagged_items").selectAll();
    const status = url.searchParams.get("status");
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

    return json(
      items.map((item) => ({
        ...item,
        qbittorrent_instance: instanceMap[item.qbittorrent_instance_id],
        arr_instance: item.arr_instance_id ? instanceMap[item.arr_instance_id] : null,
        cross_seed_peers: peersByItemId.get(item.id) ?? [],
      })),
    );
  }

  const approveMatch = path.match(/^\/api\/flagged-items\/(\d+)\/approve$/);
  if (approveMatch && method === "POST") {
    await approveItem(Number(approveMatch[1]), "manual");
    return json({ ok: true });
  }

  const dismissMatch = path.match(/^\/api\/flagged-items\/(\d+)\/dismiss$/);
  if (dismissMatch && method === "POST") {
    await db
      .updateTable("flagged_items")
      .set({ status: "dismissed", dismissed_at: new Date().toISOString() })
      .where("id", "=", Number(dismissMatch[1]))
      .execute();
    return json({ ok: true });
  }

  if (path === "/api/flagged-items/bulk-approve" && method === "POST") {
    const { ids } = (await req.json()) as { ids: number[] };
    for (const id of ids) {
      try {
        await approveItem(id, "manual");
      } catch {}
    }
    return json({ ok: true });
  }

  if (path === "/api/flagged-items/bulk-dismiss" && method === "POST") {
    const { ids } = (await req.json()) as { ids: number[] };
    const now = new Date().toISOString();
    for (const id of ids) {
      await db
        .updateTable("flagged_items")
        .set({ status: "dismissed", dismissed_at: now })
        .where("id", "=", id)
        .execute();
    }
    return json({ ok: true });
  }

  if (path === "/api/audit" && method === "GET") {
    const entries = await db
      .selectFrom("audit_log")
      .selectAll()
      .orderBy("id", "desc")
      .limit(200)
      .execute();
    return json(entries);
  }

  if (path === "/api/config" && method === "GET") {
    const entries = await db.selectFrom("config").selectAll().execute();
    return json(Object.fromEntries(entries.map((e) => [e.key, e.value])));
  }

  if (path === "/api/config" && method === "PUT") {
    const body = (await req.json()) as Record<string, string>;
    for (const [key, value] of Object.entries(body)) {
      await db
        .insertInto("config")
        .values({ key, value })
        .onConflict((oc) => oc.doUpdateSet({ value }))
        .execute();
    }
    restartWithConfig();
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
}
