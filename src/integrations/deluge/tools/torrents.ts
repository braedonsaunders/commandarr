import type { ToolDefinition } from '../../_base';

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
  if (seconds < 0 || seconds === 0) return '\u221E';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function mapState(state: string): string {
  const stateMap: Record<string, string> = {
    Downloading: 'Downloading',
    Seeding: 'Seeding',
    Paused: 'Paused',
    Checking: 'Checking',
    Queued: 'Queued',
    Error: 'Error',
    Moving: 'Moving',
  };
  return stateMap[state] ?? state;
}

function buildFilterDict(filter: string): Record<string, string> {
  if (filter === 'all') return {};
  const filterMap: Record<string, string> = {
    downloading: 'Downloading',
    seeding: 'Seeding',
    paused: 'Paused',
  };
  const state = filterMap[filter];
  if (state) return { state };
  return {};
}

const TORRENT_KEYS = [
  'name',
  'state',
  'progress',
  'download_payload_rate',
  'upload_payload_rate',
  'eta',
  'total_size',
  'save_path',
  'label',
];

export const tool: ToolDefinition = {
  name: 'deluge_torrents',
  integration: 'deluge',
  description: 'List torrents in Deluge with status, progress, and speed info',
  parameters: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        description: 'Filter torrents by state',
        enum: ['all', 'downloading', 'seeding', 'paused'],
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
    const client = ctx.getClient('deluge');
    ctx.log(`Fetching Deluge torrents (filter: ${filter})...`);

    const filterDict = buildFilterDict(filter);
    const result = await client.post('core.get_torrents_status', [filterDict, TORRENT_KEYS]);

    if (!result || typeof result !== 'object') {
      return {
        success: true,
        message: `No torrents found (filter: ${filter})`,
        data: { torrents: [] },
      };
    }

    const entries = Object.entries(result) as [string, any][];
    if (entries.length === 0) {
      return {
        success: true,
        message: `No torrents found (filter: ${filter})`,
        data: { torrents: [] },
      };
    }

    const items = entries.map(([hash, t]) => ({
      name: t.name ?? 'Unknown',
      hash,
      state: mapState(t.state ?? 'Unknown'),
      progress: `${(t.progress ?? 0).toFixed(1)}%`,
      dlspeed: formatSpeed(t.download_payload_rate ?? 0),
      upspeed: formatSpeed(t.upload_payload_rate ?? 0),
      eta: formatEta(t.eta ?? 0),
      size: formatBytes(t.total_size ?? 0),
      savePath: t.save_path ?? '',
      label: t.label || 'Uncategorized',
    }));

    const summary = items
      .map(
        (t) =>
          `- ${t.name}: ${t.state} (${t.progress}) DL: ${t.dlspeed} UL: ${t.upspeed} ETA: ${t.eta}${t.label !== 'Uncategorized' ? ` [${t.label}]` : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${entries.length} torrent(s) (filter: ${filter}):\n${summary}`,
      data: { torrents: items },
    };
  },
};
