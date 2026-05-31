import type { FC } from "hono/jsx";
import { Badge } from "../components/Badge";
import { db } from "../../utils/db/index";
import { CATEGORY_LABELS } from "../types";

export const AuditPage: FC = async () => {
  const entries = await db
    .selectFrom("audit_log")
    .selectAll()
    .orderBy("id", "desc")
    .limit(200)
    .execute();

  return (
    <>
      <header>
        <h1>Audit Log</h1>
      </header>
      {entries.length === 0 ? (
        <div class="empty">No actions recorded yet</div>
      ) : (
        <div class="card">
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
                  <tr>
                    <td>{new Date(e.created_at).toLocaleString()}</td>
                    <td>{e.torrent_name}</td>
                    <td>
                      <Badge class={e.category}>{CATEGORY_LABELS[e.category] || e.category}</Badge>
                    </td>
                    <td>{e.triggered_by}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                      {files.map((f, i) => (
                        <>
                          {i > 0 && <br />}
                          {f}
                        </>
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
};
