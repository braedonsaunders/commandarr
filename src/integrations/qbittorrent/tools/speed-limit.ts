import type { ToolDefinition } from '../../_base';

function formatBytes(bytes: number): string {
  if (bytes === 0) return 'unlimited';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export const tool: ToolDefinition = {
  name: 'qbittorrent_speed_limit',
  integration: 'qbittorrent',
  description: 'Set global download and upload speed limits in qBittorrent',
  parameters: {
    type: 'object',
    properties: {
      download: {
        type: 'number',
        description: 'Download speed limit in bytes/s (0 = unlimited)',
      },
      upload: {
        type: 'number',
        description: 'Upload speed limit in bytes/s (0 = unlimited)',
      },
    },
  },
  ui: {
    category: 'Configuration',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { download, upload } = params;
    if (download === undefined && upload === undefined) {
      return { success: false, message: 'At least one of download or upload limit is required' };
    }

    const client = ctx.getClient('qbittorrent');
    const changes: string[] = [];

    if (download !== undefined) {
      ctx.log(`Setting download limit to ${download} bytes/s`);
      await client.post(
        '/api/v2/transfer/setDownloadLimit',
        `limit=${encodeURIComponent(String(download))}`,
      );
      changes.push(`Download: ${formatBytes(download)}/s`);
    }

    if (upload !== undefined) {
      ctx.log(`Setting upload limit to ${upload} bytes/s`);
      await client.post(
        '/api/v2/transfer/setUploadLimit',
        `limit=${encodeURIComponent(String(upload))}`,
      );
      changes.push(`Upload: ${formatBytes(upload)}/s`);
    }

    return {
      success: true,
      message: `Speed limits updated:\n${changes.join('\n')}`,
    };
  },
};
