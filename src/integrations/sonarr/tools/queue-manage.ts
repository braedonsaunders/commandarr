import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'sonarr_queue_manage',
  integration: 'sonarr',
  description:
    'Remove an item from the Sonarr download queue. Can optionally blocklist the release to prevent re-downloading, and optionally trigger a search for a replacement.',
  parameters: {
    type: 'object',
    properties: {
      queueId: {
        type: 'number',
        description: 'The queue item ID to remove (from sonarr_queue results)',
      },
      blocklist: {
        type: 'boolean',
        description: 'Add the release to the blocklist to prevent re-downloading (default: false)',
      },
      removeFromClient: {
        type: 'boolean',
        description: 'Remove the download from the download client too (default: true)',
      },
      skipRedownload: {
        type: 'boolean',
        description: 'Skip automatic re-searching after removal (default: false)',
      },
    },
    required: ['queueId'],
  },
  ui: {
    category: 'Downloads',
    dangerLevel: 'high',
    testable: false,
  },
  async handler(params, ctx) {
    const { queueId, blocklist = false, removeFromClient = true, skipRedownload = false } = params;
    const client = ctx.getClient('sonarr');

    ctx.log(`Removing queue item ${queueId}...`);

    const queryParams: Record<string, string> = {
      removeFromClient: String(removeFromClient),
      blocklist: String(blocklist),
      skipRedownload: String(skipRedownload),
    };

    const qs = new URLSearchParams(queryParams).toString();

    try {
      await client.delete(`/api/v3/queue/${queueId}?${qs}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to remove queue item: ${message}` };
    }

    const actions: string[] = ['Removed from queue'];
    if (blocklist) actions.push('added to blocklist');
    if (removeFromClient) actions.push('removed from download client');
    if (!skipRedownload) actions.push('will search for replacement');

    return {
      success: true,
      message: `Queue item ${queueId}: ${actions.join(', ')}.`,
      data: { queueId, blocklist, removeFromClient, skipRedownload },
    };
  },
};
