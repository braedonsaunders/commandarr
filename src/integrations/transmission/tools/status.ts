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
  name: 'transmission_status',
  integration: 'transmission',
  description: 'Get Transmission session info including version, speeds, and cumulative stats',
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
    const client = ctx.getClient('transmission');
    ctx.log('Fetching Transmission session info...');

    const session = await client.post('session-get', {});
    const stats = await client.post('session-stats', {});

    const status = {
      version: session.version ?? 'unknown',
      dlSpeed: formatSpeed(stats.downloadSpeed ?? 0),
      ulSpeed: formatSpeed(stats.uploadSpeed ?? 0),
      downloadDir: session['download-dir'] ?? 'unknown',
      freeSpace: formatBytes(session['download-dir-free-space'] ?? 0),
      activeTorrents: stats.activeTorrentCount ?? 0,
      pausedTorrents: stats.pausedTorrentCount ?? 0,
      totalTorrents: stats.torrentCount ?? 0,
      totalDownloaded: formatBytes(stats['cumulative-stats']?.downloadedBytes ?? 0),
      totalUploaded: formatBytes(stats['cumulative-stats']?.uploadedBytes ?? 0),
    };

    const summary = [
      `Version: ${status.version}`,
      `Download Speed: ${status.dlSpeed}`,
      `Upload Speed: ${status.ulSpeed}`,
      `Download Directory: ${status.downloadDir}`,
      `Free Space: ${status.freeSpace}`,
      `Torrents: ${status.activeTorrents} active, ${status.pausedTorrents} paused, ${status.totalTorrents} total`,
      `Total Downloaded: ${status.totalDownloaded}`,
      `Total Uploaded: ${status.totalUploaded}`,
    ].join('\n');

    return {
      success: true,
      message: `Transmission Status:\n${summary}`,
      data: { status },
    };
  },
};
