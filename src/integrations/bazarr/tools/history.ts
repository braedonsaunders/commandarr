import type { ToolDefinition } from '../../_base';

interface HistoryItem {
  title: string;
  language: string;
  provider: string;
  score: string;
  timestamp: string;
  action: string;
}

export const tool: ToolDefinition = {
  name: 'bazarr_history',
  integration: 'bazarr',
  description: 'View recent subtitle download history in Bazarr',
  parameters: {
    type: 'object',
    properties: {
      page: {
        type: 'number',
        description: 'Page number (default: 1)',
      },
      pageSize: {
        type: 'number',
        description: 'Number of results per page (default: 25)',
      },
    },
  },
  ui: {
    category: 'Subtitles',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;

    const client = ctx.getClient('bazarr');
    ctx.log('Fetching subtitle history...');

    const response = await client.get('/api/history', {
      page: String(page),
      pagesize: String(pageSize),
    });

    const records = response.data ?? response ?? [];

    if (!Array.isArray(records) || records.length === 0) {
      return {
        success: true,
        message: 'No subtitle history found',
        data: { items: [], total: response.total ?? 0 },
      };
    }

    const items: HistoryItem[] = records.map((r: any) => ({
      title: r.seriesTitle ?? r.title ?? 'Unknown',
      language: r.language?.name ?? r.language ?? 'Unknown',
      provider: r.provider ?? 'Unknown',
      score: r.score ?? 'N/A',
      timestamp: r.timestamp
        ? new Date(r.timestamp).toLocaleString()
        : 'Unknown',
      action: r.action === 1 || r.action === 'download'
        ? 'download'
        : r.action === 2 || r.action === 'upgrade'
          ? 'upgrade'
          : String(r.action ?? 'unknown'),
    }));

    const summary = items
      .map(
        (h) =>
          `- ${h.title} — ${h.language} via ${h.provider} (score: ${h.score}, ${h.action}) at ${h.timestamp}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} history entry/entries (page ${page}):\n${summary}`,
      data: { items, total: response.total ?? items.length },
    };
  },
};
