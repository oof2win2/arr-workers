import type { FC } from "hono/jsx";

export const Badge: FC<{ class: string; children: string }> = ({ class: className, children }) => {
  return <span class={`badge ${className}`}>{children}</span>;
};
