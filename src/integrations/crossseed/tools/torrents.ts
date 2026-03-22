import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'crossseed_torrents',
  integration: 'crossseed',
  description: 'List torrents tracked by Cross-seed with their match and cross-seed status',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of torrents to return (default: 25)',
      },
    },
  },
  ui: {
    category: 'Seeding',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { limit: 10 },
  },
  async handler(params, ctx) {
    const client = ctx.getClient('crossseed');
    const limit = (params.limit as number) ?? 25;

    ctx.log(`Fetching tracked torrents (limit: ${limit})...`);

    const response = await client.get('/api/torrents');

    const torrents = Array.isArray(response) ? response : response?.torrents ?? response?.data ?? [];

    const limited = torrents.slice(0, limit);

    if (limited.length === 0) {
      return {
        success: true,
        message: 'No tracked torrents found in Cross-seed.',
        data: { torrents: [] },
      };
    }

    const summary = limited
      .map((t: any) => {
        const name = t.name ?? t.title ?? 'Unknown';
        const status = t.status ?? t.matchStatus ?? 'unknown';
        const matched = t.matched ?? t.crossSeeded ?? false;
        return `- ${name}: ${status}${matched ? ' (cross-seeded)' : ''}`;
      })
      .join('\n');

    const totalNote = torrents.length > limit ? ` (showing ${limit} of ${torrents.length})` : '';

    return {
      success: true,
      message: `${limited.length} tracked torrent(s)${totalNote}:\n${summary}`,
      data: { torrents: limited, total: torrents.length },
    };
  },
};
