import { Kysely } from "kysely"
import type { DB } from "./types"
import {Database} from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"

export const db = new Kysely<DB>({
  dialect: new BunSqliteDialect({
    database: new Database(Bun.env.DB_URL)
	}),
	log: ["error"],
})

export { sql } from "kysely"
export { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres"
