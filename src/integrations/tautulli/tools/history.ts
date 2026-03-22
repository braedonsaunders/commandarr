import type { ToolDefinition } from '../../_base';

interface HistoryItem {
  title: string;
  fullTitle: string;
  user: string;
  date: string;
  duration: string;
  playPercent: number;
  platform: string;
  mediaType: string;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export const tool: ToolDefinition = {
  name: 'tautulli_history',
  integration: 'tautulli',
  description: 'View recent Plex play history',
  parameters: {
    type: 'object',
    properties: {
      length: {
        type: 'number',
        description: 'Number of history items to retrieve (default: 25)',
      },
      user: {
        type: 'string',
        description: 'Filter history by username (optional)',
      },
    },
  },
  ui: {
    category: 'Analytics',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('tautulli');
    const length = String(params.length ?? 25);

    ctx.log('Fetching Plex play history...');

    const queryParams: Record<string, string> = { length };
    if (params.user && typeof params.user === 'string') {
      queryParams.user = params.user;
    }

    const data = await client.get('get_history', queryParams);

    const records = data?.data ?? [];
    const items: HistoryItem[] = [];

    if (Array.isArray(records)) {
      for (const r of records) {
        items.push({
          title: r.title ?? 'Unknown',
          fullTitle: r.full_title ?? r.title ?? 'Unknown',
          user: r.friendly_name ?? r.user ?? 'Unknown',
          date: r.date
            ? new Date(Number(r.date) * 1000).toLocaleString()
            : 'Unknown',
          duration: formatDuration(Number(r.duration ?? 0)),
          playPercent: Math.round(Number(r.percent_complete ?? 0)),
          platform: r.platform ?? r.player ?? 'Unknown',
          mediaType: r.media_type ?? 'unknown',
        });
      }
    }

    if (items.length === 0) {
      return {
        success: true,
        message: 'No play history found',
        data: { items: [] },
      };
    }

    const summary = items
      .map(
        (item) =>
          `- ${item.fullTitle} | ${item.user} | ${item.date} | ${item.duration} (${item.playPercent}%) | ${item.platform}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} history item(s):\n${summary}`,
      data: { items },
    };
  },
};
