import type { ToolDefinition } from '../../_base';

interface WantedEpisode {
  seriesTitle: string;
  season: number;
  episode: number;
  episodeTitle: string;
  missing: string[];
}

export const tool: ToolDefinition = {
  name: 'bazarr_wanted_series',
  integration: 'bazarr',
  description: 'List episodes that are missing subtitles in Bazarr',
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
    ctx.log('Fetching episodes missing subtitles...');

    const response = await client.get('/api/episodes/wanted', {
      page: String(page),
      pagesize: String(pageSize),
    });

    const records = response.data ?? response ?? [];

    if (!Array.isArray(records) || records.length === 0) {
      return {
        success: true,
        message: 'No episodes are missing subtitles',
        data: { items: [], total: response.total ?? 0 },
      };
    }

    const items: WantedEpisode[] = records.map((r: any) => ({
      seriesTitle: r.seriesTitle ?? r.series_title ?? 'Unknown',
      season: r.season ?? 0,
      episode: r.episode ?? 0,
      episodeTitle: r.episodeTitle ?? r.episode_title ?? 'Unknown',
      missing: Array.isArray(r.missing_subtitles)
        ? r.missing_subtitles.map((s: any) => s.name ?? s.code2 ?? String(s))
        : [],
    }));

    const summary = items
      .map(
        (e) =>
          `- ${e.seriesTitle} S${String(e.season).padStart(2, '0')}E${String(e.episode).padStart(2, '0')} "${e.episodeTitle}" — missing: ${e.missing.join(', ')}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} episode(s) missing subtitles (page ${page}):\n${summary}`,
      data: { items, total: response.total ?? items.length },
    };
  },
};
