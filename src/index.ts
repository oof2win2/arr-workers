import { createQBittorrentClient } from "@oof2win2/qbittorrent-api";

const qbittorrent = createQBittorrentClient({
  password: Bun.env.QBITTORRENT_PASSWORD!,
  url: Bun.env.QBITTORRENT_URL!,
  username: Bun.env.QBITTORRENT_USERNAME!,
});
