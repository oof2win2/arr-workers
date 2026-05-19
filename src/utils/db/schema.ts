import { type SQL, sql } from "drizzle-orm"
import {
	boolean,
	check,
	date,
	foreignKey,
	index,
	integer,
	json,
	numeric,
	pgTable,
	primaryKey,
	text,
	time,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core"

// --- Auth ---

export const adminUser = pgTable("admin_user", {
	id: uuid().primaryKey().defaultRandom(),
	email: text().notNull().unique(),
	password_hash: text().notNull(),
	name: text().notNull(),
	created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const adminSession = pgTable("admin_session", {
	id: text().primaryKey(),
	secret_hash: text().notNull(),
	user_id: uuid()
		.notNull()
		.references(() => adminUser.id, { onDelete: "cascade" }),
	created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
	expires_at: timestamp({ withTimezone: true }).notNull(),
})

export const storeSession = pgTable("store_session", {
	id: text().primaryKey(),
	secret_hash: text().notNull(),
	store_id: uuid()
		.notNull()
		.references(() => store.id, { onDelete: "cascade" }),
	created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
	expires_at: timestamp({ withTimezone: true }).notNull(),
})

export const appConfig = pgTable("app_config", {
	id: text().primaryKey(),
	protocol_cron_enabled: boolean().notNull().default(false),
	protocol_email_enabled: boolean().notNull().default(false),
	updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const region = pgTable("region", {
	id: uuid().primaryKey().defaultRandom(),
	name: text().notNull().unique(),
	status: text().$type<"active" | "inactive">().notNull().default("active"),
	created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
	updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const managerRegion = pgTable(
	"manager_region",
	{
		manager_user_id: uuid()
			.notNull()
			.references(() => adminUser.id, { onDelete: "cascade" }),
		region_id: uuid()
			.notNull()
			.references(() => region.id, { onDelete: "cascade" }),
		permission_type: text()
			.$type<"read" | "write" | "update" | "remove" | "add">()
			.notNull()
			.default("read"),
		created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(tbl) => [
		primaryKey({ columns: [tbl.manager_user_id, tbl.region_id] }),
		index("manager_region_region_id_idx").on(tbl.region_id),
	],
)

// --- Schedule ---

export const protocolSchedule = pgTable("protocol_schedule", {
	id: uuid().primaryKey(),
	label: text().notNull(),
})

export const protocolScheduleItem = pgTable(
	"protocol_schedule_item",
	{
		schedule_id: uuid()
			.notNull()
			.references(() => protocolSchedule.id, { onDelete: "restrict" }),
		item_id: uuid().unique().notNull(),
		weekday: integer().notNull(),
		time: time().notNull(),
	},
	(tbl) => [
		primaryKey({ columns: [tbl.schedule_id, tbl.item_id] }),
		index("protocol_schedule_item_weekday_time_idx").on(
			tbl.weekday,
			tbl.time,
		),
	],
)

// --- Store ---

export const store = pgTable(
	"store",
	{
		id: uuid().primaryKey(),
		name: text().notNull(),
		location: text(),
		region_id: uuid().references(() => region.id, { onDelete: "set null" }),
		opening_times: json()
			.$type<Array<{ weekday: number; from: string; to: string }>>()
			.default([]),
		import_metadata: json().$type<Record<string, unknown>>().default({}),
		protocol_schedule_id: uuid()
			.notNull()
			.references(() => protocolSchedule.id, {
				onDelete: "restrict",
			}),
		login_code: text().notNull(),
		onboarding_complete: boolean().notNull().default(false),
	},
	(tbl) => [
		index("store_region_id_idx").on(tbl.region_id),
		index("store_protocol_schedule_id_idx").on(tbl.protocol_schedule_id),
	],
)

export const storeContact = pgTable("store_contact", {
	id: uuid().primaryKey().defaultRandom(),
	store_id: uuid()
		.notNull()
		.references(() => store.id, { onDelete: "cascade" }),
	name: text().notNull(),
	phone: text().notNull(),
	email: text(),
	has_whatsapp: boolean().notNull().default(false),
	created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const storeExposition = pgTable(
	"store_exposition",
	{
		store_id: uuid()
			.notNull()
			.references(() => store.id, { onDelete: "cascade" }),
		exposition_id: uuid().notNull().defaultRandom(),
		label: text().notNull(),
		status: text().$type<"active" | "disabled">().notNull().default("active"),
	},
	(tbl) => [primaryKey({ columns: [tbl.store_id, tbl.exposition_id] })],
)

export const expectation = pgTable(
	"expectation",
	{
		id: uuid().primaryKey().defaultRandom(),
		product_category: text().notNull(),
		display_type: text().notNull(),
		protocol_time: time().notNull(),
		expected_fill_ratio: integer().notNull(),
		created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
		updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(tbl) => [
		unique("expectation_category_display_time_uidx").on(
			tbl.product_category,
			tbl.display_type,
			tbl.protocol_time,
		),
		index("expectation_protocol_time_idx").on(tbl.protocol_time),
		check(
			"expectation_expected_fill_ratio_pct_chk",
			sql`${tbl.expected_fill_ratio} >= 0 AND ${tbl.expected_fill_ratio} <= 100`,
		),
	],
)

// --- Protocol ---

export const protocol = pgTable(
	"protocol",
	{
		/**
		 * Mirrors the Temporal workflow ID: `{storeId}-{scheduledTimestamp}`.
		 * Used by Temporal activities to look up the protocol without
		 * needing to pass the UUID through the workflow.
		 */
		id: text().primaryKey(),

		store_id: uuid()
			.notNull()
			.references(() => store.id, { onDelete: "cascade" }),
		protocol_schedule_id: uuid().references(() => protocolSchedule.id),
		protocol_schedule_item_id: uuid().references(
			() => protocolScheduleItem.item_id,
		),

		/**
		 * Calendar date the protocol was due
		 */
		scheduled_date: date().notNull(),
		scheduled_at: time().notNull(),
		scheduled_datetime: timestamp()
			.notNull()
			.generatedAlwaysAs(
				(): SQL =>
					sql`(${protocol.scheduled_date} + ${protocol.scheduled_at})::timestamp`,
			),

		created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
		submitted_at: timestamp({ withTimezone: true }),
		completed_at: timestamp({ withTimezone: true }),
		location_latitude: numeric(),
		location_longitude: numeric(),
		location_captured_at: timestamp({ withTimezone: true }),

		/** Populated only on failure */
		failure_reason: text(),

		average_fill_rate: numeric(),
		},
		(tbl) => [
			index("protocol_store_id_idx").on(tbl.store_id),
			index("protocol_scheduled_date_idx").on(tbl.scheduled_date),
			index("protocol_store_scheduled_datetime_idx").on(
				tbl.store_id,
				tbl.scheduled_datetime.desc(),
				tbl.id.desc(),
			),
			unique("protocol_store_item_date_uidx").on(
				tbl.store_id,
				tbl.protocol_schedule_item_id,
			tbl.scheduled_date,
		),
	],
)

// --- Protocol Image ---

export const protocolImage = pgTable(
	"protocol_image",
	{
		id: uuid().primaryKey(),
		protocol_id: text()
			.notNull()
			.references(() => protocol.id, { onDelete: "cascade" }),
		store_id: uuid().notNull(),
		store_exposition_id: uuid().notNull(),

		image_key: text().notNull(),

		annotations: json(),
		fill_rate: numeric(),
		comments: text(),

		created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
		annotated_at: timestamp({ withTimezone: true }),
		evaluated_at: timestamp({ withTimezone: true }),
	},
	(tbl) => [
		foreignKey({
			columns: [tbl.store_id],
			foreignColumns: [store.id],
		}),
		foreignKey({
			columns: [tbl.store_id, tbl.store_exposition_id],
			foreignColumns: [storeExposition.store_id, storeExposition.exposition_id],
		}),
		index("protocol_image_protocol_id_idx").on(tbl.protocol_id),
		unique("protocol_image_unique_per_exposition").on(
			tbl.protocol_id,
			tbl.store_id,
			tbl.store_exposition_id,
		),
	],
)
