import type { ToolDefinition } from '../../_base';

interface WantedMovie {
  title: string;
  year: number;
  missing: string[];
  sceneName?: string;
}

export const tool: ToolDefinition = {
  name: 'bazarr_wanted_movies',
  integration: 'bazarr',
  description: 'List movies that are missing subtitles in Bazarr',
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
    ctx.log('Fetching movies missing subtitles...');

    const response = await client.get('/api/movies/wanted', {
      page: String(page),
      pagesize: String(pageSize),
    });

    const records = response.data ?? response ?? [];

    if (!Array.isArray(records) || records.length === 0) {
      return {
        success: true,
        message: 'No movies are missing subtitles',
        data: { items: [], total: response.total ?? 0 },
      };
    }

    const items: WantedMovie[] = records.map((r: any) => ({
      title: r.title ?? 'Unknown',
      year: r.year ?? 0,
      missing: Array.isArray(r.missing_subtitles)
        ? r.missing_subtitles.map((s: any) => s.name ?? s.code2 ?? String(s))
        : [],
      sceneName: r.sceneName ?? undefined,
    }));

    const summary = items
      .map(
        (m) =>
          `- ${m.title} (${m.year}) — missing: ${m.missing.join(', ')}${m.sceneName ? ` [${m.sceneName}]` : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} movie(s) missing subtitles (page ${page}):\n${summary}`,
      data: { items, total: response.total ?? items.length },
    };
  },
};
