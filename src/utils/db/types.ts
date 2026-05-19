import type { Kyselify } from "drizzle-orm/kysely"
import type { Selectable } from "kysely"
import type * as schema from "./schema"

export interface DB {
	admin_user: Kyselify<(typeof schema)["adminUser"]>
	admin_session: Kyselify<(typeof schema)["adminSession"]>
	store_session: Kyselify<(typeof schema)["storeSession"]>
	app_config: Kyselify<(typeof schema)["appConfig"]>
	region: Kyselify<(typeof schema)["region"]>
	manager_region: Kyselify<(typeof schema)["managerRegion"]>

	protocol_schedule: Kyselify<(typeof schema)["protocolSchedule"]>
	protocol_schedule_item: Kyselify<(typeof schema)["protocolScheduleItem"]>
	protocol: Kyselify<(typeof schema)["protocol"]>
	protocol_image: Kyselify<(typeof schema)["protocolImage"]>

	store: Kyselify<(typeof schema)["store"]>
	store_contact: Kyselify<(typeof schema)["storeContact"]>
	store_exposition: Kyselify<(typeof schema)["storeExposition"]>
	expectation: Kyselify<(typeof schema)["expectation"]>
}

export type AdminUser = Selectable<DB["admin_user"]>
export type AdminSession = Selectable<DB["admin_session"]>
export type StoreSession = Selectable<DB["store_session"]>
export type AppConfig = Selectable<DB["app_config"]>
export type Region = Selectable<DB["region"]>
export type ManagerRegion = Selectable<DB["manager_region"]>
export type ProtocolSchedule = Selectable<DB["protocol_schedule"]>
export type ProtocolScheduleItem = Selectable<DB["protocol_schedule_item"]>
export type Protocol = Selectable<DB["protocol"]>
export type ProtocolImage = Selectable<DB["protocol_image"]>
export type Store = Selectable<DB["store"]>
export type StoreContact = Selectable<DB["store_contact"]>
export type StoreExposition = Selectable<DB["store_exposition"]>
export type Expectation = Selectable<DB["expectation"]>
