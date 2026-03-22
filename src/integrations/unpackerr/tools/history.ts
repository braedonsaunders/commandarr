import type { ToolDefinition } from '../../_base';

interface HistoryItem {
  filename: string;
  app: string;
  status: string;
  startTime: string;
  elapsed: string;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
}

export const tool: ToolDefinition = {
  name: 'unpackerr_history',
  integration: 'unpackerr',
  description: 'View recent extraction history from Unpackerr',
  parameters: {
    type: 'object',
    properties: {
      count: {
        type: 'number',
        description: 'Number of history entries to return (default: 25)',
      },
    },
  },
  ui: {
    category: 'Extractions',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const count = params.count ?? 25;
    const client = ctx.getClient('unpackerr');
    ctx.log('Fetching Unpackerr extraction history...');

    const response = await client.get('/api/history', {
      count: String(count),
    });

    const records = Array.isArray(response) ? response : response?.records ?? [];

    if (records.length === 0) {
      return {
        success: true,
        message: 'No extraction history found.',
        data: { items: [] },
      };
    }

    const items: HistoryItem[] = records.map((record: any) => ({
      filename: record.filename ?? record.name ?? 'Unknown',
      app: record.app ?? 'unknown',
      status: record.status ?? 'unknown',
      startTime: record.startTime
        ? new Date(record.startTime).toLocaleString()
        : 'unknown',
      elapsed: record.elapsed != null ? formatElapsed(record.elapsed) : 'unknown',
    }));

    const summary = items
      .map(
        (item) =>
          `- ${item.filename} (${item.app}) - ${item.status}, started ${item.startTime}, took ${item.elapsed}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} extraction(s) in history:\n${summary}`,
      data: { items },
    };
  },
};
