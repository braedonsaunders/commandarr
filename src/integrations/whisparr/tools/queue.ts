import type { ToolDefinition } from '../../_base';

interface QueueItem {
  title: string;
  status: string;
  progress: number;
  size: string;
  sizeleft: string;
  eta?: string;
  quality: string;
  indexer?: string;
  downloadClient?: string;
  errorMessage?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export const tool: ToolDefinition = {
  name: 'whisparr_queue',
  integration: 'whisparr',
  description: 'Check the Whisparr download queue',
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
    const client = ctx.getClient('whisparr');
    ctx.log('Fetching Whisparr download queue...');

    const response = await client.get('/api/v3/queue', {
      page: '1',
      pageSize: '50',
      includeMovie: 'true',
    });

    const records = response.records ?? response ?? [];
    const items: QueueItem[] = [];

    if (Array.isArray(records)) {
      for (const record of records) {
        const totalSize = record.size ?? 0;
        const sizeLeft = record.sizeleft ?? 0;
        const progress =
          totalSize > 0
            ? Math.round(((totalSize - sizeLeft) / totalSize) * 100)
            : 0;

        items.push({
          title: record.movie?.title ?? record.title ?? 'Unknown',
          status: record.status ?? 'unknown',
          progress,
          size: formatBytes(totalSize),
          sizeleft: formatBytes(sizeLeft),
          eta: record.estimatedCompletionTime
            ? new Date(record.estimatedCompletionTime).toLocaleString()
            : undefined,
          quality: record.quality?.quality?.name ?? 'Unknown',
          indexer: record.indexer,
          downloadClient: record.downloadClient,
          errorMessage: record.errorMessage,
        });
      }
    }

    if (items.length === 0) {
      return {
        success: true,
        message: 'Download queue is empty',
        data: { items: [] },
      };
    }

    const summary = items
      .map(
        (item) =>
          `- ${item.title}: ${item.status} (${item.progress}%, ${item.sizeleft} remaining${item.eta ? `, ETA: ${item.eta}` : ''})`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} item(s) in queue:\n${summary}`,
      data: { items },
    };
  },
};
