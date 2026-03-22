import type { ToolDefinition } from '../../_base';

interface HistoryItem {
  name: string;
  status: string;
  sizeMB: number;
  category: string;
  completedAt: string;
  failMessage?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export const tool: ToolDefinition = {
  name: 'nzbget_history',
  integration: 'nzbget',
  description: 'View recent completed downloads in NZBGet history',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Number of history items to retrieve (default: 20)',
      },
    },
  },
  ui: {
    category: 'Downloads',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { limit: 20 },
  },
  async handler(params, ctx) {
    const limit = params.limit ?? 20;
    const client = ctx.getClient('nzbget');
    ctx.log(`Fetching NZBGet history (limit: ${limit})...`);

    // NZBGet history method accepts Hidden parameter (false = only visible items)
    const response = await client.post('/jsonrpc', {
      method: 'history',
      params: [false],
    });

    const result = response.result ?? response ?? [];
    const allItems = Array.isArray(result) ? result : [];
    const entries = allItems.slice(0, limit);
    const items: HistoryItem[] = [];

    for (const entry of entries) {
      const sizeMB = (entry.FileSizeLo + entry.FileSizeHi * 4294967296) / (1024 * 1024);

      let status = 'unknown';
      const markStatus = entry.MarkStatus ?? '';
      const parStatus = entry.ParStatus ?? '';
      const unpackStatus = entry.UnpackStatus ?? '';

      if (markStatus === 'SUCCESS' || (parStatus === 'SUCCESS' && unpackStatus === 'SUCCESS')) {
        status = 'success';
      } else if (markStatus === 'BAD' || parStatus === 'FAILURE' || unpackStatus === 'FAILURE') {
        status = 'failure';
      } else {
        status = (entry.Status ?? 'unknown').toLowerCase();
      }

      items.push({
        name: entry.Name ?? entry.NZBName ?? 'Unknown',
        status,
        sizeMB: Math.round(sizeMB * 10) / 10,
        category: entry.Category || 'Default',
        completedAt: entry.HistoryTime
          ? new Date(entry.HistoryTime * 1000).toLocaleString()
          : 'Unknown',
        failMessage: entry.FailMessage || undefined,
      });
    }

    if (items.length === 0) {
      return {
        success: true,
        message: 'No items in download history.',
        data: { items: [] },
      };
    }

    const summary = items
      .map(
        (item) =>
          `- ${item.name}: ${item.status} (${formatBytes(item.sizeMB * 1024 * 1024)}, category: ${item.category}, completed: ${item.completedAt}${item.failMessage ? `, error: ${item.failMessage}` : ''})`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} item(s) in history:\n${summary}`,
      data: { items },
    };
  },
};
