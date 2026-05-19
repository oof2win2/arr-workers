import React from "react";
import { api } from "../lib";

export function SettingsPage() {
  const [cron, setCron] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    api.get<Record<string, string>>("/config").then((c) => setCron(c.scan_cron || "0 * * * *"));
  }, []);

  const save = async () => {
    await api.put("/config", { scan_cron: cron });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <header>
        <h1>Settings</h1>
      </header>
      <div className="card" style={{ maxWidth: 600 }}>
        <h2>Scan Schedule</h2>
        <div className="form-group">
          <label>Cron Expression</label>
          <input value={cron} onChange={(e) => setCron(e.target.value)} placeholder="0 * * * *" />
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Default: hourly (0 * * * *)
          </div>
        </div>
        <button className="primary" onClick={save}>
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </>
  );
}
