import type { ToolDefinition } from '../../_base';

interface QueueItem {
  filename: string;
  status: string;
  progress: number;
  fileSizeMB: number;
  remainingMB: number;
  category: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export const tool: ToolDefinition = {
  name: 'nzbget_queue',
  integration: 'nzbget',
  description: 'List active downloads in the NZBGet queue',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Downloads',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('nzbget');
    ctx.log('Fetching NZBGet download queue...');

    const response = await client.get('listgroups');

    const result = response.result ?? response ?? [];
    const groups = Array.isArray(result) ? result : [];
    const items: QueueItem[] = [];

    for (const group of groups) {
      const fileSizeMB = (group.FileSizeLo + group.FileSizeHi * 4294967296) / (1024 * 1024);
      const remainingMB = (group.RemainingSizeLo + group.RemainingSizeHi * 4294967296) / (1024 * 1024);
      const progress = fileSizeMB > 0 ? ((fileSizeMB - remainingMB) / fileSizeMB) * 100 : 0;

      let status = 'queued';
      if (group.Status === 'DOWNLOADING') status = 'downloading';
      else if (group.Status === 'PAUSED' || group.ActiveDownloads === 0 && group.Status !== 'DOWNLOADING') {
        status = group.Status?.toLowerCase() ?? 'queued';
      }

      items.push({
        filename: group.NZBName ?? 'Unknown',
        status,
        progress: Math.round(progress * 10) / 10,
        fileSizeMB: Math.round(fileSizeMB * 10) / 10,
        remainingMB: Math.round(remainingMB * 10) / 10,
        category: group.Category || 'Default',
      });
    }

    if (items.length === 0) {
      return {
        success: true,
        message: 'Download queue is empty.',
        data: { items: [] },
      };
    }

    const summary = items
      .map(
        (item) =>
          `- ${item.filename}: ${item.status} (${item.progress}%, ${formatBytes(item.remainingMB * 1024 * 1024)} remaining, ${formatBytes(item.fileSizeMB * 1024 * 1024)} total)`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} item(s) in queue:\n${summary}`,
      data: { items },
    };
  },
};
