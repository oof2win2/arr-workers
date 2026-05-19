import React from "react";
import { api, type ScanRun } from "../lib";
import { Badge } from "../components/Badge";

export function ScansPage() {
  const [scans, setScans] = React.useState<ScanRun[]>([]);

  const load = React.useCallback(async () => {
    setScans(await api.get<ScanRun[]>("/scans"));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const triggerScan = async () => {
    await api.post("/scans");
    load();
  };

  return (
    <>
      <header>
        <h1>Scan History</h1>
        <button className="primary" onClick={triggerScan}>
          Run Scan Now
        </button>
      </header>
      {scans.length === 0 ? (
        <div className="empty">No scans yet</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Started</th>
                <th>Completed</th>
                <th>Status</th>
                <th>Trigger</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{new Date(s.started_at).toLocaleString()}</td>
                  <td>{s.completed_at ? new Date(s.completed_at).toLocaleString() : "-"}</td>
                  <td>
                    <Badge className={s.status}>{s.status}</Badge>
                  </td>
                  <td>{s.triggered_by}</td>
                  <td>{s.summary || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
