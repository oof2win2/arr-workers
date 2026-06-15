import got from "got";
import type { Config } from "./config.js";

export interface TorrentFile {
	name: string;
	size: number;
	progress: number;
	priority: number;
	is_seed: boolean;
	availability: number;
}

export interface TorrentInfo {
	hash: string;
	name: string;
	size: number;
	state: string;
	progress: number;
}

export class QBittorrentClient {
	private api: typeof got;
	private authenticated = false;

	constructor(private config: Config["qbittorrent"]) {
		this.api = got.extend({
			prefixUrl: `${this.config.url}/api/v2`,
			hooks: {
				// beforeRequest: [
				// 	async (req) => {
				// 		console.log(req.url)
				// 		console.log(req.headers)
				// 	},
				// ],
				// afterResponse: [
				// 	async (response) => {
				// 		console.log(response.statusCode)
				// 		return response;
				// 	}
				// ]
			},
		});
	}

	async authenticate(): Promise<void> {
		if (this.authenticated) return;
		try {
			this.authenticated = true;
			await this.api.post("auth/login", {
				form: {
					username: this.config.username,
					password: this.config.password,
				},
			});
		} catch (error) {
			this.authenticated = false;
			throw error;
		}
	}

	async getTorrentFiles(hash: string): Promise<TorrentFile[]> {
		const response = await this.api
			.get(`torrents/files?hash=${hash}`)
			.json<TorrentFile[]>();

		return response;
	}

	async getTorrentInfo(hash: string): Promise<TorrentInfo> {
		const response = await this.api
			.get(`api/v2/torrents/info?hashes=${hash}`)
			.json<TorrentInfo>();

		return response;
	}

	async resumeTorrent(hash: string): Promise<void> {
		await this.authenticate();

		await this.api.post("torrents/start", {
			form: {
				hashes: hash,
			},
		});
	}

	hasBlacklistedFiles(
		files: TorrentFile[],
		blacklistedExtensions: string[],
	): boolean {
		return files.some((file) => {
			const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
			return blacklistedExtensions.includes(ext);
		});
	}
}
