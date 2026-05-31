import type { FC } from "hono/jsx";
import { db } from "../../utils/db/index";
import type { Instance } from "../types";
import { BASE } from "../../config";

async function getInstances() {
  return db.selectFrom("instances").selectAll().orderBy("id").execute();
}

export const InstancesPage: FC = async () => {
  const instances = await getInstances();
  const qbits = instances.filter((i) => i.type === "qbittorrent") as Instance[];
  const arrs = instances.filter((i) => i.type !== "qbittorrent") as Instance[];

  return (
    <>
      <header>
        <h1>Instances</h1>
        <button
          class="primary"
          hx-get={`${BASE}/instances/form`}
          hx-target="#instance-form-area"
          hx-swap="innerHTML"
        >
          Add Instance
        </button>
      </header>

      <div id="instance-form-area" />

      <h2>qBittorrent</h2>
      {qbits.length === 0 ? (
        <div class="empty">No qBittorrent instances configured</div>
      ) : (
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>URL</th>
                <th>Download Dir</th>
                <th>Radarr Tag</th>
                <th>Sonarr Tag</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {qbits.map((i) => (
                <tr id={`instance-row-${i.id}`}>
                  <td>{i.label}</td>
                  <td>{i.url}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 13 }}>{i.download_dir || "-"}</td>
                  <td>{i.radarr_tag || "radarr"}</td>
                  <td>{i.sonarr_tag || "sonarr"}</td>
                  <td>
                    <button
                      hx-get={`${BASE}/instances/form?id=${i.id}`}
                      hx-target="#instance-form-area"
                      hx-swap="innerHTML"
                    >
                      Edit
                    </button>{" "}
                    <button
                      class="danger"
                      hx-delete={`${BASE}/api/instances/${i.id}`}
                      hx-confirm="Delete this instance?"
                      hx-target="closest tr"
                      hx-swap="outerHTML swap:0.5s"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ marginTop: 32 }}>Radarr / Sonarr</h2>
      {arrs.length === 0 ? (
        <div class="empty">No Radarr/Sonarr instances configured</div>
      ) : (
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Type</th>
                <th>URL</th>
                <th>qBittorrent</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {arrs.map((i) => (
                <tr id={`instance-row-${i.id}`}>
                  <td>{i.label}</td>
                  <td>{i.type}</td>
                  <td>{i.url}</td>
                  <td>{qbits.find((q) => q.id === i.linked_qbittorrent_id)?.label || "Unknown"}</td>
                  <td>
                    <button
                      hx-get={`${BASE}/instances/form?id=${i.id}`}
                      hx-target="#instance-form-area"
                      hx-swap="innerHTML"
                    >
                      Edit
                    </button>{" "}
                    <button
                      class="danger"
                      hx-delete={`${BASE}/api/instances/${i.id}`}
                      hx-confirm="Delete this instance?"
                      hx-target="closest tr"
                      hx-swap="outerHTML swap:0.5s"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export const InstanceForm: FC<{ id?: string }> = async ({ id }) => {
  const isEdit = id !== undefined;
  const instances = await getInstances();
  const qbits = instances.filter((i) => i.type === "qbittorrent") as Instance[];
  const existing = isEdit ? instances.find((i) => i.id === Number(id)) : null;

  const type = existing?.type ?? "qbittorrent";
  const label = existing?.label ?? "";
  const url = existing?.url ?? "";
  const username = existing?.username ?? "";
  const downloadDir = existing?.download_dir ?? "";
  const radarrTag = existing?.radarr_tag ?? "radarr";
  const sonarrTag = existing?.sonarr_tag ?? "sonarr";
  const apiKey = existing?.api_key ?? "";
  const linkedQbit = existing?.linked_qbittorrent_id ?? "";

  return (
    <div class="card" style={{ maxWidth: 600 }}>
      <h2>{isEdit ? "Edit" : "Add"} Instance</h2>
      <form
        hx-post={isEdit ? `${BASE}/api/instances/${id}` : `${BASE}/api/instances`}
        hx-encoding="multipart/form-data"
        hx-target="#instance-form-area"
        hx-swap="innerHTML"
        {...(isEdit ? { "hx-put": `${BASE}/api/instances/${id}` } : {})}
      >
        <div class="form-group">
          <label>Type</label>
          <select
            name="type"
            hx-get={`${BASE}/instances/form-type`}
            hx-target="#type-fields"
            hx-swap="innerHTML"
            hx-include="[name='type']"
          >
            <option value="qbittorrent" selected={type === "qbittorrent"}>
              qBittorrent
            </option>
            <option value="radarr" selected={type === "radarr"}>
              Radarr
            </option>
            <option value="sonarr" selected={type === "sonarr"}>
              Sonarr
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>Label</label>
          <input name="label" value={label} />
        </div>
        <div class="form-group">
          <label>URL</label>
          <input name="url" value={url} placeholder="http://..." />
        </div>

        <div id="type-fields">
          {type === "qbittorrent" ? (
            <>
              <div class="form-group">
                <label>Username</label>
                <input name="username" value={username} />
              </div>
              <div class="form-group">
                <label>Password</label>
                <input type="password" name="password" />
              </div>
              <div class="form-group">
                <label>Download Directory</label>
                <input name="download_dir" value={downloadDir} placeholder="/path/to/downloads" />
              </div>
              <div class="form-group">
                <label>Radarr Tag</label>
                <input name="radarr_tag" value={radarrTag} />
              </div>
              <div class="form-group">
                <label>Sonarr Tag</label>
                <input name="sonarr_tag" value={sonarrTag} />
              </div>
            </>
          ) : (
            <>
              <div class="form-group">
                <label>API Key</label>
                <input name="api_key" value={apiKey} />
              </div>
              <div class="form-group">
                <label>Linked qBittorrent</label>
                <select name="linked_qbittorrent_id">
                  <option value="">Select...</option>
                  {qbits.map((q) => (
                    <option value={String(q.id)} selected={linkedQbit === q.id}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button class="primary" type="submit">
            Save
          </button>
          <button
            type="button"
            onclick="document.getElementById('instance-form-area').innerHTML=''"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export const InstanceSaved: FC = async () => {
  return (
    <div class="card" style={{ maxWidth: 600, borderColor: "var(--success)" }}>
      <p style={{ color: "var(--success)", marginBottom: 8 }}>
        Instance saved. Refresh the page to see updated tables.
      </p>
      <button onclick="document.getElementById('instance-form-area').innerHTML=''; location.reload();">
        OK
      </button>
    </div>
  );
};
