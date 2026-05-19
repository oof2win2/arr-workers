import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/utils/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.DB_URL!,
  },
});
