import { Kysely } from "kysely";
import type { DB } from "./types";
import { createClient } from "@libsql/client";
import { LibsqlDialect } from "kysely-libsql";
import { SerializePlugin } from "kysely-plugin-serialize";

export const db = new Kysely<DB>({
  dialect: new LibsqlDialect({
    client: createClient({
      url: Bun.env.DATABASE_URL!,
    }),
  }),
  log: ["error"],
});

export { sql } from "kysely";
