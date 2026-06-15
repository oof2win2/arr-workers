import type { FC } from "hono/jsx";
import { db } from "../../utils/db/index";
import { BASE } from "../../config";

export const SettingsPage: FC = async () => {
  const entries = await db.selectFrom("config").selectAll().execute();
  const config = Object.fromEntries(entries.map((e) => [e.key, e.value]));
  const cron = config.scan_cron || "0 * * * *";

  return (
    <>
      <header>
        <h1>Settings</h1>
      </header>
      <div class="card" style={{ maxWidth: 600 }}>
        <h2>Scan Schedule</h2>
        <form id="settings-form">
          <div class="form-group">
            <label>Cron Expression</label>
            <input name="scan_cron" value={cron} placeholder="0 * * * *" />
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              Default: hourly (0 * * * *)
            </div>
          </div>
        </form>
        <button
          class="primary"
          hx-put={`${BASE}/api/config`}
          hx-include="#settings-form"
          hx-target="#settings-status"
          hx-swap="innerHTML"
        >
          Save
        </button>
        <span id="settings-status" />
      </div>
    </>
  );
};
