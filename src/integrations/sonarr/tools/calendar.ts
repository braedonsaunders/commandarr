import type { ToolDefinition } from '../../_base';

interface CalendarEntry {
  seriesTitle: string;
  episodeTitle: string;
  season: number;
  episode: number;
  airDate: string;
  hasFile: boolean;
  monitored: boolean;
  overview?: string;
}

export const tool: ToolDefinition = {
  name: 'sonarr_calendar',
  integration: 'sonarr',
  description: 'Get upcoming and recent TV episode releases from Sonarr',
  parameters: {
    type: 'object',
    properties: {
      days: {
        type: 'number',
        description: 'Number of days to look ahead (default: 7)',
      },
    },
  },
  ui: {
    category: 'TV Shows',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { days: 7 },
  },
  async handler(params, ctx) {
    const days =
      typeof params.days === 'number' && params.days > 0 ? params.days : 7;

    const client = ctx.getClient('sonarr');
    ctx.log(`Fetching Sonarr calendar for next ${days} days...`);

    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);

    const results = await client.get('/api/v3/calendar', {
      start: start.toISOString().split('T')[0]!,
      end: end.toISOString().split('T')[0]!,
      includeSeries: 'true',
      includeEpisodeFile: 'false',
      unmonitored: 'false',
    });

    const entries: CalendarEntry[] = [];

    if (Array.isArray(results)) {
      for (const ep of results) {
        entries.push({
          seriesTitle: ep.series?.title ?? ep.seriesTitle ?? 'Unknown',
          episodeTitle: ep.title ?? 'Unknown',
          season: ep.seasonNumber ?? 0,
          episode: ep.episodeNumber ?? 0,
          airDate: ep.airDateUtc
            ? new Date(ep.airDateUtc).toLocaleDateString()
            : ep.airDate ?? 'Unknown',
          hasFile: ep.hasFile ?? false,
          monitored: ep.monitored ?? false,
          overview: ep.overview?.slice(0, 100),
        });
      }
    }

    if (entries.length === 0) {
      return {
        success: true,
        message: `No upcoming episodes in the next ${days} days`,
        data: { entries: [] },
      };
    }

    const summary = entries
      .map(
        (e) =>
          `- ${e.seriesTitle} S${String(e.season).padStart(2, '0')}E${String(e.episode).padStart(2, '0')} "${e.episodeTitle}" - ${e.airDate}${e.hasFile ? ' [downloaded]' : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${entries.length} upcoming episode(s) in the next ${days} days:\n${summary}`,
      data: { entries },
    };
  },
};
