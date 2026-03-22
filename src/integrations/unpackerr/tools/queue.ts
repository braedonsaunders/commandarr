import type { ToolDefinition } from '../../_base';

interface QueueItem {
  filename: string;
  app: string;
  status: string;
  progress: number;
}

export const tool: ToolDefinition = {
  name: 'unpackerr_queue',
  integration: 'unpackerr',
  description: 'View items currently being extracted or waiting in Unpackerr',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Extractions',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('unpackerr');
    ctx.log('Fetching Unpackerr extraction queue...');

    const response = await client.get('/api/queue');

    const records = Array.isArray(response) ? response : response?.items ?? [];

    if (records.length === 0) {
      return {
        success: true,
        message: 'Extraction queue is empty.',
        data: { items: [] },
      };
    }

    const items: QueueItem[] = records.map((record: any) => ({
      filename: record.filename ?? record.name ?? 'Unknown',
      app: record.app ?? 'unknown',
      status: record.status ?? 'unknown',
      progress: record.progress ?? 0,
    }));

    const summary = items
      .map(
        (item) =>
          `- ${item.filename} (${item.app}) - ${item.status}, ${item.progress}% complete`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} item(s) in extraction queue:\n${summary}`,
      data: { items },
    };
  },
};
