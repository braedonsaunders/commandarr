import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'sonarr_blocklist',
  integration: 'sonarr',
  description:
    'View or manage the Sonarr blocklist. Shows releases that have been blocklisted to prevent re-downloading. Can also remove items from the blocklist.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: '"list" to view the blocklist, "delete" to remove an item, "clear" to clear all',
        enum: ['list', 'delete', 'clear'],
      },
      blocklistId: {
        type: 'number',
        description: 'The blocklist item ID to remove (required for "delete" action)',
      },
    },
    required: ['action'],
  },
  ui: {
    category: 'Downloads',
    dangerLevel: 'medium',
    testable: true,
    testDefaults: { action: 'list' },
  },
  async handler(params, ctx) {
    const { action, blocklistId } = params;
    const client = ctx.getClient('sonarr');

    if (action === 'delete') {
      if (!blocklistId) {
        return { success: false, message: 'blocklistId is required for delete action' };
      }
      ctx.log(`Removing blocklist item ${blocklistId}...`);
      await client.delete(`/api/v3/blocklist/${blocklistId}`);
      return {
        success: true,
        message: `Blocklist item ${blocklistId} removed.`,
        data: { blocklistId },
      };
    }

    if (action === 'clear') {
      ctx.log('Clearing entire blocklist...');
      await client.delete('/api/v3/blocklist/bulk');
      return {
        success: true,
        message: 'Blocklist cleared.',
      };
    }

    // List
    ctx.log('Fetching blocklist...');
    const response = await client.get('/api/v3/blocklist', {
      page: '1',
      pageSize: '50',
    });

    const records = response.records ?? response ?? [];
    if (!Array.isArray(records) || records.length === 0) {
      return {
        success: true,
        message: 'Blocklist is empty.',
        data: { items: [], totalRecords: 0 },
      };
    }

    const items = records.map((r: any) => ({
      id: r.id,
      seriesTitle: r.series?.title ?? 'Unknown',
      sourceTitle: r.sourceTitle ?? 'Unknown',
      quality: r.quality?.quality?.name ?? 'Unknown',
      date: r.date ? new Date(r.date).toLocaleDateString() : 'Unknown',
      indexer: r.indexer ?? 'Unknown',
      message: r.message ?? '',
    }));

    const lines = items.map(
      (item: any) =>
        `- [ID: ${item.id}] ${item.seriesTitle} — "${item.sourceTitle}" (${item.quality}, ${item.indexer}, ${item.date})`,
    );

    return {
      success: true,
      message: `${items.length} blocklisted release(s):\n${lines.join('\n')}`,
      data: { items, totalRecords: response.totalRecords ?? items.length },
    };
  },
};
