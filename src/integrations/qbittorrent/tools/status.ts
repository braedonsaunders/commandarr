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

export const tool: ToolDefinition = {
  name: 'qbittorrent_status',
  integration: 'qbittorrent',
  description: 'Get qBittorrent global transfer info (speeds, totals, DHT nodes)',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'System',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('qbittorrent');
    ctx.log('Fetching qBittorrent transfer info...');

    const info = await client.get('/api/v2/transfer/info');

    const status = {
      dlSpeed: formatSpeed(info.dl_info_speed ?? 0),
      ulSpeed: formatSpeed(info.up_info_speed ?? 0),
      totalDownloaded: formatBytes(info.dl_info_data ?? 0),
      totalUploaded: formatBytes(info.up_info_data ?? 0),
      dhtNodes: info.dht_nodes ?? 0,
    };

    const summary = [
      `Download Speed: ${status.dlSpeed}`,
      `Upload Speed: ${status.ulSpeed}`,
      `Total Downloaded: ${status.totalDownloaded}`,
      `Total Uploaded: ${status.totalUploaded}`,
      `DHT Nodes: ${status.dhtNodes}`,
    ].join('\n');

    return {
      success: true,
      message: `qBittorrent Transfer Status:\n${summary}`,
      data: { status },
    };
  },
};
