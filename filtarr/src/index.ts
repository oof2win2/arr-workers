import { AutoRouter } from "itty-router";
import { loadConfig } from "./config.js";
import { QBittorrentClient } from "./qbittorrent.js";
import {
	RadarrClient,
	RadarrWebhookSchema,
	type RadarrWebhook,
} from "./radarr.js";
import PQueue from "p-queue";
import { SonarrClient, SonarrWebhookSchema, type SonarrWebhook } from "./sonarr.js";

const config = await loadConfig();
const qbClient = new QBittorrentClient(config.qbittorrent);
const radarrClient = new RadarrClient(config.radarr);
const sonarrClient = new SonarrClient(config.sonarr)
const queue = new PQueue({ concurrency: 1 });

const processRadarrWebhook = async (webhook: RadarrWebhook) => {
	const files = await qbClient.getTorrentFiles(webhook.downloadId);
	if (!qbClient.hasBlacklistedFiles(files, config.blacklistedExtensions)) {
		await qbClient.resumeTorrent(webhook.downloadId);
		return;
	}

	const { records: queueItems } = await radarrClient.getQueueItems({
		movieIds: [webhook.movie.id],
	});

	const itemToRemove = queueItems.find(
		(i) => i.downloadId === webhook.downloadId,
	);
	// the item was removed
	if (!itemToRemove) {
		await qbClient.resumeTorrent(webhook.downloadId);
		return;
	}

	await radarrClient.removeFromQueue({
		id: itemToRemove.id,
		blocklist: true,
		removeFromClient: true,
	});
	console.log(`Removed and blacklisted ${webhook.release.releaseTitle}`);

	return;
};

const processSonarrWebhook = async (webhook: SonarrWebhook) => {
	const files = await qbClient.getTorrentFiles(webhook.downloadId);
	if (!qbClient.hasBlacklistedFiles(files, config.blacklistedExtensions)) {
		await qbClient.resumeTorrent(webhook.downloadId);
		return;
	}

	const { records: queueItems } = await sonarrClient.getQueueItems({
		seriesIds: [webhook.series.id],
	});

	const itemToRemove = queueItems.find(
		(i) => i.downloadId === webhook.downloadId,
	);
	// the item was removed
	if (!itemToRemove) {
		await qbClient.resumeTorrent(webhook.downloadId);
		return;
	}

	await radarrClient.removeFromQueue({
		id: itemToRemove.id,
		blocklist: true,
		removeFromClient: true,
	});
	console.log(`Removed and blacklisted ${webhook.release.releaseTitle}`);

	return;
};


const router = AutoRouter({ port: config.port });

router.post("/radarr", async (request) => {
	const body = await request.json();
	if (body.eventType === "Test") return new Response("OK");
	const wh = RadarrWebhookSchema.safeParse(body);
	if (!wh.success) {
		return new Response(JSON.stringify(wh.error), { status: 400 });
	}
	queue.add(async () => {
		await Bun.sleep(10_000);
		await processRadarrWebhook(wh.data);
	});

	return new Response("OK");
});

router.post("/sonarr", async (request) => {
	const body = await request.json();
	if (body.eventType === "Test") return new Response("OK");
	const wh = SonarrWebhookSchema.safeParse(body);
	if (!wh.success) {
		return new Response(JSON.stringify(wh.error), { status: 400 });
	}
	queue.add(async () => {
		await Bun.sleep(10_000);
		await processSonarrWebhook(wh.data);
	});

	return new Response("OK");
});

// Serve via Bun
export default { ...router };
