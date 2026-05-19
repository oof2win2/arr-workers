import React from "react";
import { api, type AuditEntry, CATEGORY_LABELS } from "../lib";
import { Badge } from "../components/Badge";

export function AuditPage() {
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);

  React.useEffect(() => {
    api.get<AuditEntry[]>("/audit").then(setEntries);
  }, []);

  return (
    <>
      <header>
        <h1>Audit Log</h1>
      </header>
      {entries.length === 0 ? (
        <div className="empty">No actions recorded yet</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Torrent</th>
                <th>Category</th>
                <th>Trigger</th>
                <th>Files Deleted</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                let files: string[] = [];
                try {
                  files = JSON.parse(e.files_deleted);
                } catch {
                  files = [e.files_deleted];
                }
                return (
                  <tr key={e.id}>
                    <td>{new Date(e.created_at).toLocaleString()}</td>
                    <td>{e.torrent_name}</td>
                    <td>
                      <Badge className={e.category}>
                        {CATEGORY_LABELS[e.category] || e.category}
                      </Badge>
                    </td>
                    <td>{e.triggered_by}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                      {files.map((f, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <br />}
                          {f}
                        </React.Fragment>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
