import React from "react";
import { api, type Instance } from "../lib";

export function InstancesPage() {
  const [instances, setInstances] = React.useState<Instance[]>([]);
  const [showForm, setShowForm] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    setInstances(await api.get<Instance[]>("/instances"));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const deleteInstance = async (id: number) => {
    if (confirm("Delete this instance?")) {
      await api.del(`/instances/${id}`);
      load();
    }
  };

  const qbits = instances.filter((i) => i.type === "qbittorrent");
  const arrs = instances.filter((i) => i.type !== "qbittorrent");

  return (
    <>
      <header>
        <h1>Instances</h1>
        <button
          className="primary"
          onClick={() => {
            setEditId(null);
            setShowForm(true);
          }}
        >
          Add Instance
        </button>
      </header>

      {showForm && (
        <InstanceForm
          id={editId}
          instances={instances}
          onSave={() => {
            setShowForm(false);
            load();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <h2>qBittorrent</h2>
      {qbits.length === 0 ? (
        <div className="empty">No qBittorrent instances configured</div>
      ) : (
        <div className="card">
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
                <tr key={i.id}>
                  <td>{i.label}</td>
                  <td>{i.url}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 13 }}>{i.download_dir || "-"}</td>
                  <td>{i.radarr_tag || "radarr"}</td>
                  <td>{i.sonarr_tag || "sonarr"}</td>
                  <td>
                    <button
                      onClick={() => {
                        setEditId(i.id);
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </button>{" "}
                    <button className="danger" onClick={() => deleteInstance(i.id)}>
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
        <div className="empty">No Radarr/Sonarr instances configured</div>
      ) : (
        <div className="card">
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
                <tr key={i.id}>
                  <td>{i.label}</td>
                  <td>{i.type}</td>
                  <td>{i.url}</td>
                  <td>{qbits.find((q) => q.id === i.linked_qbittorrent_id)?.label || "Unknown"}</td>
                  <td>
                    <button
                      onClick={() => {
                        setEditId(i.id);
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </button>{" "}
                    <button className="danger" onClick={() => deleteInstance(i.id)}>
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
}

function InstanceForm({
  id,
  instances,
  onSave,
  onCancel,
}: {
  id: number | null;
  instances: Instance[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const isEdit = id !== null;
  const qbits = instances.filter((i) => i.type === "qbittorrent");
  const existing = isEdit ? instances.find((i) => i.id === id) : null;

  const [type, setType] = React.useState<Instance["type"]>(existing?.type ?? "qbittorrent");
  const [label, setLabel] = React.useState(existing?.label ?? "");
  const [url, setUrl] = React.useState(existing?.url ?? "");
  const [username, setUsername] = React.useState(existing?.username ?? "");
  const [password, setPassword] = React.useState(existing?.password ?? "");
  const [downloadDir, setDownloadDir] = React.useState(existing?.download_dir ?? "");
  const [radarrTag, setRadarrTag] = React.useState(existing?.radarr_tag ?? "radarr");
  const [sonarrTag, setSonarrTag] = React.useState(existing?.sonarr_tag ?? "sonarr");
  const [apiKey, setApiKey] = React.useState(existing?.api_key ?? "");
  const [linkedQbit, setLinkedQbit] = React.useState<string>(
    String(existing?.linked_qbittorrent_id ?? ""),
  );

  const save = async () => {
    const body: Record<string, unknown> = { type, label, url };
    if (type === "qbittorrent") {
      body.username = username;
      body.password = password;
      body.download_dir = downloadDir;
      body.radarr_tag = radarrTag || "radarr";
      body.sonarr_tag = sonarrTag || "sonarr";
    } else {
      body.api_key = apiKey;
      body.linked_qbittorrent_id = linkedQbit ? Number(linkedQbit) : null;
    }
    if (isEdit) await api.put(`/instances/${id}`, body);
    else await api.post("/instances", body);
    onSave();
  };

  return (
    <div className="card" style={{ maxWidth: 600 }}>
      <h2>{isEdit ? "Edit" : "Add"} Instance</h2>
      <div className="form-group">
        <label>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value as Instance["type"])}>
          <option value="qbittorrent">qBittorrent</option>
          <option value="radarr">Radarr</option>
          <option value="sonarr">Sonarr</option>
        </select>
      </div>
      <div className="form-group">
        <label>Label</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="form-group">
        <label>URL</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://..." />
      </div>

      {type === "qbittorrent" ? (
        <>
          <div className="form-group">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Download Directory</label>
            <input
              value={downloadDir}
              onChange={(e) => setDownloadDir(e.target.value)}
              placeholder="/path/to/downloads"
            />
          </div>
          <div className="form-group">
            <label>Radarr Tag</label>
            <input value={radarrTag} onChange={(e) => setRadarrTag(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Sonarr Tag</label>
            <input value={sonarrTag} onChange={(e) => setSonarrTag(e.target.value)} />
          </div>
        </>
      ) : (
        <>
          <div className="form-group">
            <label>API Key</label>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Linked qBittorrent</label>
            <select value={linkedQbit} onChange={(e) => setLinkedQbit(e.target.value)}>
              <option value="">Select...</option>
              {qbits.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button className="primary" onClick={save}>
          Save
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
