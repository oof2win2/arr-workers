import { Hono } from "hono";
import { Layout } from "../frontend/layout";
import { ReviewPage } from "../frontend/pages/ReviewPage";
import { InstancesPage, InstanceForm } from "../frontend/pages/InstancesPage";
import { ScansPage } from "../frontend/pages/ScansPage";
import { AuditPage } from "../frontend/pages/AuditPage";
import { SettingsPage } from "../frontend/pages/SettingsPage";
import { db } from "../utils/db/index";
import type { Instance } from "../utils/db/types";
import { BASE } from "../config";

export const pages = new Hono();

pages.get("/", async (c) => {
  return c.html(
    <Layout page="review" base={BASE}>
      <ReviewPage />
    </Layout>,
  );
});

pages.get("/instances", async (c) => {
  return c.html(
    <Layout page="instances" base={BASE}>
      <InstancesPage />
    </Layout>,
  );
});

// Instance form partial (loaded via htmx)
pages.get("/instances/form", async (c) => {
  const id = c.req.query("id");
  return c.html(<InstanceForm id={id} />);
});

// Instance form type partial (for dynamic type switching)
pages.get("/instances/form-type", async (c) => {
  const type = c.req.query("type") ?? "qbittorrent";
  const instances = await db.selectFrom("instances").selectAll().orderBy("id").execute();
  const qbits = instances.filter((i) => i.type === "qbittorrent") as Instance[];

  if (type === "qbittorrent") {
    return c.html(
      <>
        <div class="form-group">
          <label>Username</label>
          <input name="username" />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" name="password" />
        </div>
        <div class="form-group">
          <label>Download Directory</label>
          <input name="download_dir" placeholder="/path/to/downloads" />
        </div>
        <div class="form-group">
          <label>Radarr Tag</label>
          <input name="radarr_tag" value="radarr" />
        </div>
        <div class="form-group">
          <label>Sonarr Tag</label>
          <input name="sonarr_tag" value="sonarr" />
        </div>
      </>,
    );
  }
  return c.html(
    <>
      <div class="form-group">
        <label>API Key</label>
        <input name="api_key" />
      </div>
      <div class="form-group">
        <label>Linked qBittorrent</label>
        <select name="linked_qbittorrent_id">
          <option value="">Select...</option>
          {qbits.map((q) => (
            <option value={String(q.id)}>{q.label}</option>
          ))}
        </select>
      </div>
    </>,
  );
});

pages.get("/scans", async (c) => {
  return c.html(
    <Layout page="scans" base={BASE}>
      <ScansPage />
    </Layout>,
  );
});

pages.get("/audit", async (c) => {
  return c.html(
    <Layout page="audit" base={BASE}>
      <AuditPage />
    </Layout>,
  );
});

pages.get("/settings", async (c) => {
  return c.html(
    <Layout page="settings" base={BASE}>
      <SettingsPage />
    </Layout>,
  );
});
