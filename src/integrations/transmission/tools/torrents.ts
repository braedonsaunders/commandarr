import type { ToolDefinition } from '../../_base';

const STATUS_MAP: Record<number, string> = {
  0: 'stopped',
  1: 'check wait',
  2: 'checking',
  3: 'download wait',
  4: 'downloading',
  5: 'seed wait',
  6: 'seeding',
};

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
  if (seconds < 0) return '\u221E';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export const tool: ToolDefinition = {
  name: 'transmission_torrents',
  integration: 'transmission',
  description: 'List torrents in Transmission with status, progress, and speed info',
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
    const client = ctx.getClient('transmission');
    ctx.log(`Fetching Transmission torrents (filter: ${filter})...`);

    const result = await client.post('torrent-get', {
      fields: [
        'id',
        'name',
        'status',
        'percentDone',
        'rateDownload',
        'rateUpload',
        'eta',
        'sizeWhenDone',
        'totalSize',
        'downloadDir',
      ],
    });

    let torrents: any[] = result.torrents ?? [];

    // Apply filter
    if (filter === 'downloading') {
      torrents = torrents.filter((t: any) => t.status === 3 || t.status === 4);
    } else if (filter === 'seeding') {
      torrents = torrents.filter((t: any) => t.status === 5 || t.status === 6);
    } else if (filter === 'paused') {
      torrents = torrents.filter((t: any) => t.status === 0);
    }

    if (torrents.length === 0) {
      return {
        success: true,
        message: `No torrents found (filter: ${filter})`,
        data: { torrents: [] },
      };
    }

    const items = torrents.map((t: any) => ({
      id: t.id,
      name: t.name,
      status: STATUS_MAP[t.status] ?? `unknown (${t.status})`,
      progress: `${(t.percentDone * 100).toFixed(1)}%`,
      dlspeed: formatSpeed(t.rateDownload ?? 0),
      upspeed: formatSpeed(t.rateUpload ?? 0),
      eta: formatEta(t.eta ?? -1),
      size: formatBytes(t.sizeWhenDone ?? t.totalSize ?? 0),
      downloadDir: t.downloadDir,
    }));

    const summary = items
      .map(
        (t) =>
          `- ${t.name}: ${t.status} (${t.progress}) DL: ${t.dlspeed} UL: ${t.upspeed} ETA: ${t.eta} [${t.size}]`,
      )
      .join('\n');

    return {
      success: true,
      message: `${torrents.length} torrent(s) (filter: ${filter}):\n${summary}`,
      data: { torrents: items },
    };
  },
};
