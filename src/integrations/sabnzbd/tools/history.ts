import type { ToolDefinition } from '../../_base';

interface HistorySlot {
  name: string;
  status: string;
  size: string;
  category: string;
  completedAt: string;
  downloadTime: number;
  failMessage?: string;
}

export const tool: ToolDefinition = {
  name: 'sabnzbd_history',
  integration: 'sabnzbd',
  description: 'View recent completed downloads in SABnzbd history',
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
    const client = ctx.getClient('sabnzbd');
    ctx.log(`Fetching SABnzbd history (limit: ${limit})...`);

    const response = await client.get(`/api?mode=history&limit=${limit}`);

    const history = response.history ?? {};
    const slots = history.slots ?? [];
    const items: HistorySlot[] = [];

    if (Array.isArray(slots)) {
      for (const slot of slots) {
        items.push({
          name: slot.name ?? 'Unknown',
          status: slot.status ?? 'unknown',
          size: slot.size ?? 'Unknown',
          category: slot.category ?? 'Default',
          completedAt: slot.completed
            ? new Date(slot.completed * 1000).toLocaleString()
            : 'Unknown',
          downloadTime: slot.download_time ?? 0,
          failMessage: slot.fail_message || undefined,
        });
      }
    }

    if (items.length === 0) {
      return {
        success: true,
        message: 'No items in download history',
        data: { items: [] },
      };
    }

    const summary = items
      .map(
        (item) =>
          `- ${item.name}: ${item.status} (${item.size}, completed: ${item.completedAt}${item.failMessage ? `, error: ${item.failMessage}` : ''})`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} item(s) in history:\n${summary}`,
      data: { items },
    };
  },
};
