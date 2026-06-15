import got from "got";
import z from "zod/v4";

export const SonarrWebhookSchema = z.object({
	eventType: z.literal("Grab"),
	series: z.object({
		id: z.number(),
		title: z.string(),
		imdbId: z.string(),
		tmdbId: z.number(),
	}),
	release: z.object({
		releaseTitle: z.string(),
	}),
	downloadId: z.string(),
	downloadClient: z.literal("qBittorrent"),
});
export type SonarrWebhook = z.infer<typeof SonarrWebhookSchema>;

type SonarrQueueItem = {
	id: number;
	seriesId: number;
	downloadId: string;
};

type SonarrQueueResponse = {
	page: number;
	pageSize: number;
	sortKey: string;
	sortDirection: string;
	totalRecords: number;
	records: SonarrQueueItem[];
};

export class SonarrClient {
	private api: typeof got;

	constructor(private config: { url: string; apiKey: string }) {
		this.api = got.extend({
			prefixUrl: `${this.config.url}/api/v3`,
			headers: {
				"X-Api-Key": this.config.apiKey,
			},
		});
	}

	async getQueueItems({ seriesIds }: { seriesIds: number[] }) {
		const qs = new URLSearchParams();
		for (const id of seriesIds) {
			qs.append("seriesIds", id.toString());
		}
		qs.append("pageSize", "1000");

		const response = await this.api
			.get("queue", {
				searchParams: qs,
			})
			.json<SonarrQueueResponse>();
		return response;
	}

	async removeFromQueue({
		id,
		removeFromClient,
		blocklist,
	}: {
		id: number;
		removeFromClient: boolean;
		blocklist: boolean;
	}): Promise<void> {
		await this.api.delete(`queue/${id}`, {
			searchParams: {
				removeFromClient: removeFromClient.toString(),
				blocklist: blocklist.toString(),
			},
		});
	}
}
