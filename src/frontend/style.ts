export const css = `
:root {
  --bg: #0f1117;
  --surface: #1a1d27;
  --surface-hover: #242835;
  --border: #2d3140;
  --text: #e1e4ed;
  --text-muted: #8b8fa3;
  --accent: #6c8aff;
  --accent-hover: #5a75e6;
  --danger: #ff6b6b;
  --danger-hover: #e05555;
  --success: #51cf66;
  --warning: #fcc419;
  --radius: 8px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}

a {
  color: var(--accent);
  text-decoration: none;
}

nav {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 24px;
  height: 56px;
}

nav .brand {
  font-weight: 700;
  font-size: 18px;
  color: var(--text);
}

nav a {
  padding: 16px 0;
  color: var(--text-muted);
  font-size: 14px;
  border-bottom: 2px solid transparent;
  transition:
    color 0.2s,
    border-color 0.2s;
}

nav a:hover,
nav a.active {
  color: var(--text);
  border-bottom-color: var(--accent);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

h1 {
  font-size: 24px;
  font-weight: 600;
}

h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

button {
  padding: 8px 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}

button:hover {
  background: var(--surface-hover);
}

button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

button.primary:hover {
  background: var(--accent-hover);
}

button.danger {
  background: transparent;
  border-color: var(--danger);
  color: var(--danger);
}

button.danger:hover {
  background: var(--danger);
  color: #fff;
}

button.success {
  background: transparent;
  border-color: var(--success);
  color: var(--success);
}

button.success:hover {
  background: var(--success);
  color: #fff;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  margin-bottom: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.card-title {
  font-weight: 600;
  font-size: 16px;
}

.card-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.badge {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.badge.orphaned_files {
  background: #2d2520;
  color: #fcc419;
}

.badge.tagged_no_arr_record {
  background: #2d2020;
  color: #ff6b6b;
}

.badge.arr_deleted {
  background: #2d2025;
  color: #ff8fa5;
}

.badge.superseded {
  background: #20252d;
  color: #6c8aff;
}

.badge.pending {
  background: #2d2d20;
  color: #fcc419;
}

.badge.approved {
  background: #1d2d20;
  color: #51cf66;
}

.badge.dismissed {
  background: #252525;
  color: #8b8fa3;
}

.card-reason {
  color: var(--text-muted);
  font-size: 14px;
  margin-bottom: 12px;
}

.card-files {
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
  margin-bottom: 12px;
}

.card-cross-seed {
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: var(--radius);
  background: rgba(108, 138, 255, 0.08);
  border: 1px solid rgba(108, 138, 255, 0.15);
}

.card-actions {
  display: flex;
  gap: 8px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

th {
  color: var(--text-muted);
  font-weight: 500;
}

.form-group {
  margin-bottom: 16px;
}

label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--text-muted);
}

input,
select {
  width: 100%;
  padding: 8px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
}

input:focus,
select:focus {
  outline: none;
  border-color: var(--accent);
}

.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.toolbar select,
.toolbar input {
  width: auto;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.tabs button {
  border-bottom: 2px solid transparent;
  border-radius: var(--radius) var(--radius) 0 0;
}

.tabs button.active {
  border-bottom-color: var(--accent);
  background: var(--surface-hover);
}

.empty {
  text-align: center;
  padding: 48px;
  color: var(--text-muted);
}

#page-content {
  min-height: calc(100vh - 56px);
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
}

.stat-label {
  color: var(--text-muted);
  font-size: 14px;
}
`;
