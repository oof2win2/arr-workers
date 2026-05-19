import React from "react";

export function Nav({ page }: { page: string }) {
  const links = [
    { href: "#/", page: "review", label: "Review Queue" },
    { href: "#/instances", page: "instances", label: "Instances" },
    { href: "#/scans", page: "scans", label: "Scan History" },
    { href: "#/audit", page: "audit", label: "Audit Log" },
    { href: "#/settings", page: "settings", label: "Settings" },
  ];
  return (
    <nav>
      <span className="brand">Cleanuparr</span>
      {links.map((l) => (
        <a key={l.page} href={l.href} className={page === l.page ? "active" : ""}>
          {l.label}
        </a>
      ))}
    </nav>
  );
}
