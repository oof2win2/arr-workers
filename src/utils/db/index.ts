import { Kysely } from "kysely";
import type { DB } from "./types";
import { Database } from "bun:sqlite";
import { createClient } from "@libsql/client";
import {LibsqlDialect} from "kysely-libsql"

export const db = new Kysely<DB>({
  dialect: new LibsqlDialect({
    client: createClient({
      url: Bun.env.DATABASE_URL!
    })
  }),
  log: ["error"],
});

export { sql } from "kysely";
