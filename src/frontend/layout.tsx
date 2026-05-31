import type { FC, PropsWithChildren } from "hono/jsx";
import { css } from "./style";

function Nav({ page, base }: { page: string; base: string }) {
  const links = [
    { href: "/", page: "review", label: "Review Queue" },
    { href: "/instances", page: "instances", label: "Instances" },
    { href: "/scans", page: "scans", label: "Scan History" },
    { href: "/audit", page: "audit", label: "Audit Log" },
    { href: "/settings", page: "settings", label: "Settings" },
  ];
  return (
    <nav>
      <span class="brand">Cleanuparr</span>
      {links.map((l) => (
        <a href={base + l.href} class={page === l.page ? "active" : ""}>
          {l.label}
        </a>
      ))}
    </nav>
  );
}

export const Layout: FC<PropsWithChildren<{ page: string; base?: string; title?: string }>> = ({
  page,
  base = "",
  title = "Cleanuparr",
  children,
}) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <script
          src="https://cdn.jsdelivr.net/npm/htmx.org@2.0.10/dist/htmx.min.js"
          integrity="sha384-H5SrcfygHmAuTDZphMHqBJLc3FhssKjG7w/CeCpFReSfwBWDTKpkzPP8c+cLsK+V"
          crossorigin="anonymous"
        ></script>
      </head>
      <body>
        <Nav page={page} base={base} />
        <div id="page-content" class="container">
          {children}
        </div>
      </body>
    </html>
  );
};
