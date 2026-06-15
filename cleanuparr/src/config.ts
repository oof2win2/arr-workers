export const PORT = Number(Bun.env.PORT ?? 3014);
export const BASE = (Bun.env.BASE_URL ?? "").replace(/\/$/, "");
