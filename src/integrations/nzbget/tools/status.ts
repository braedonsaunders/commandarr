import type { ToolDefinition } from '../../_base';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(1024));
  return `${(bytesPerSec / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.length > 0 ? parts.join(' ') : '< 1m';
}

export const tool: ToolDefinition = {
  name: 'nzbget_status',
  integration: 'nzbget',
  description: 'Get NZBGet server status including speed, disk space, and system info',
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
    const client = ctx.getClient('nzbget');
    ctx.log('Fetching NZBGet server status...');

    const response = await client.get('status');

    const status = response.result ?? response ?? {};

    const downloadRate = status.DownloadRate ?? 0;
    const remainingBytes = (status.RemainingSizeLo ?? 0) + (status.RemainingSizeHi ?? 0) * 4294967296;
    const freeDiskSpace = (status.FreeDiskSpaceLo ?? 0) + (status.FreeDiskSpaceHi ?? 0) * 4294967296;
    const uptime = status.UpTimeSec ?? 0;
    const downloadPaused = status.DownloadPaused ?? false;
    const postJobCount = status.PostJobCount ?? 0;
    const serverVersion = status.NewsServers?.[0]?.ID != null ? 'See version endpoint' : 'Unknown';

    // Also fetch version info
    let version = 'Unknown';
    try {
      const versionResponse = await client.get('version');
      version = versionResponse.result ?? versionResponse ?? 'Unknown';
    } catch {
      // version info not critical
    }

    const lines = [
      `Version: ${version}`,
      `Status: ${downloadPaused ? 'PAUSED' : 'DOWNLOADING'}`,
      `Download speed: ${formatSpeed(downloadRate)}`,
      `Remaining size: ${formatBytes(remainingBytes)}`,
      `Free disk space: ${formatBytes(freeDiskSpace)}`,
      `Uptime: ${formatUptime(uptime)}`,
      `Post-processing queue: ${postJobCount} job(s)`,
    ];

    return {
      success: true,
      message: `NZBGet Status:\n${lines.join('\n')}`,
      data: {
        version,
        paused: downloadPaused,
        downloadRate,
        downloadSpeed: formatSpeed(downloadRate),
        remainingBytes,
        remainingSize: formatBytes(remainingBytes),
        freeDiskSpace: formatBytes(freeDiskSpace),
        uptime: formatUptime(uptime),
        postJobCount,
      },
    };
  },
};
