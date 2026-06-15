export interface Config {
	port: number;
	server: {
		port: number;
		host: string;
	};
	qbittorrent: {
		url: string;
		username: string;
		password: string;
	};
	radarr: {
		url: string;
		apiKey: string;
	};
	sonarr: {
		url: string;
		apiKey: string;
	};
	blacklistedExtensions: string[];
}

export const defaultConfig: Config = {
	port: 3000,
	server: {
		port: 3000,
		host: "0.0.0.0",
	},
	qbittorrent: {
		url: process.env.QBITTORRENT_URL || "http://localhost:8080",
		username: process.env.QBITTORRENT_USERNAME || "admin",
		password: process.env.QBITTORRENT_PASSWORD || "adminadmin",
	},
	radarr: {
		url: process.env.RADARR_URL || "http://localhost:7878",
		apiKey: process.env.RADARR_API_KEY || "",
	},
	sonarr: {
		url: process.env.SONARR_URL || "http://localhost:8989",
		apiKey: process.env.SONARR_API_KEY || "",
	},
	blacklistedExtensions: [
		".exe",
		".bat",
		".cmd",
		".com",
		".scr",
		".pif",
		".msi",
		".dll",
		".vbs",
		".js",
		".jar",
		".app",
		".deb",
		".rpm",
		".dmg",
		".pkg",
		".zip",
		".rar",
		".7z",
		".tar",
		".gz",
	],
};

export async function loadConfig(): Promise<Config> {
	try {
		const configPath = "/etc/filtarr/config.json";
		const configFile = Bun.file(configPath);

		// Try to read existing config
		try {
			const configText = await configFile.text();
			const configData = JSON.parse(configText);
			return { ...defaultConfig, ...configData };
		} catch (readError) {
			// File doesn't exist or is invalid, create default config
			console.log("Creating default config at /etc/filtarr/config.json");
			const defaultConfigText = JSON.stringify(defaultConfig, null, 2);

			try {
				await Bun.write(configPath, defaultConfigText);
				console.log("Default config created at /etc/filtarr/config.json");
			} catch (writeError) {
				console.log("Could not create config file, using defaults");
			}

			return defaultConfig;
		}
	} catch (error) {
		console.log(
			"Error accessing config, using default config with environment variables",
		);
		return defaultConfig;
	}
}
