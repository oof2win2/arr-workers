import type { FC } from "hono/jsx";
import { Badge } from "../components/Badge";
import { db } from "../../utils/db/index";
import type { ScanRun } from "../types";
import { BASE } from "../../config";

export const ScansPage: FC = async () => {
  const scans = await db
    .selectFrom("scan_runs")
    .selectAll()
    .orderBy("id", "desc")
    .limit(50)
    .execute();

  return (
    <>
      <header>
        <h1>Scan History</h1>
        <button
          class="primary"
          onclick={`fetch('${BASE}/api/scans',{method:'POST'}).then(()=>location.reload())`}
        >
          Run Scan Now
        </button>
      </header>
      <div id="scan-content">
        {scans.length === 0 ? (
          <div class="empty">No scans yet</div>
        ) : (
          <div class="card">
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
                {scans.map((s: ScanRun) => (
                  <tr>
                    <td>{s.id}</td>
                    <td>{new Date(s.started_at).toLocaleString()}</td>
                    <td>{s.completed_at ? new Date(s.completed_at).toLocaleString() : "-"}</td>
                    <td>
                      <Badge class={s.status}>{s.status}</Badge>
                    </td>
                    <td>{s.triggered_by}</td>
                    <td>{s.summary || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};
