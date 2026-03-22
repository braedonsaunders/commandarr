import type { ToolDefinition } from '../../_base';

interface TorrentInfo {
  name: string;
  size: number;
  progress: number;
  dlspeed: number;
  upspeed: number;
  eta: number;
  state: string;
  category: string;
  hash: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatEta(seconds: number): string {
  if (seconds < 0 || seconds === 8640000) return '\u221E';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export const tool: ToolDefinition = {
  name: 'qbittorrent_torrents',
  integration: 'qbittorrent',
  description: 'List torrents in qBittorrent with status, progress, and speed info',
  parameters: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        description: 'Filter torrents by state',
        enum: ['all', 'downloading', 'seeding', 'completed', 'paused', 'active', 'stalled'],
      },
    },
  },
  ui: {
    category: 'Downloads',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { filter: 'all' },
  },
  async handler(params, ctx) {
    const filter = params.filter ?? 'all';
    const client = ctx.getClient('qbittorrent');
    ctx.log(`Fetching qBittorrent torrents (filter: ${filter})...`);

    const torrents: TorrentInfo[] = await client.get('/api/v2/torrents/info', { filter });

    if (!Array.isArray(torrents) || torrents.length === 0) {
      return {
        success: true,
        message: `No torrents found (filter: ${filter})`,
        data: { torrents: [] },
      };
    }

    const items = torrents.map((t) => ({
      name: t.name,
      hash: t.hash,
      size: formatBytes(t.size),
      progress: `${(t.progress * 100).toFixed(1)}%`,
      dlspeed: formatSpeed(t.dlspeed),
      upspeed: formatSpeed(t.upspeed),
      eta: formatEta(t.eta),
      state: t.state,
      category: t.category || 'Uncategorized',
    }));

    const summary = items
      .map(
        (t) =>
          `- ${t.name}: ${t.state} (${t.progress}) DL: ${t.dlspeed} UL: ${t.upspeed} ETA: ${t.eta}${t.category !== 'Uncategorized' ? ` [${t.category}]` : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${torrents.length} torrent(s) (filter: ${filter}):\n${summary}`,
      data: { torrents: items },
    };
  },
};
