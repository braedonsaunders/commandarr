import type { ToolDefinition } from '../../_base';

interface CalendarEntry {
  title: string;
  year: number;
  releaseDate: string;
  status: string;
  monitored: boolean;
  hasFile: boolean;
  overview?: string;
}

export const tool: ToolDefinition = {
  name: 'radarr_calendar',
  integration: 'radarr',
  description: 'Get upcoming and recent movie releases from Radarr',
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
    category: 'Movies',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { days: 7 },
  },
  async handler(params, ctx) {
    const days = typeof params.days === 'number' && params.days > 0 ? params.days : 7;

    const client = ctx.getClient('radarr');
    ctx.log(`Fetching Radarr calendar for next ${days} days...`);

    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);

    const results = await client.get('/api/v3/calendar', {
      start: start.toISOString().split('T')[0]!,
      end: end.toISOString().split('T')[0]!,
      includeUnmonitored: 'false',
    });

    const entries: CalendarEntry[] = [];

    if (Array.isArray(results)) {
      for (const movie of results) {
        const releaseDate =
          movie.digitalRelease ??
          movie.physicalRelease ??
          movie.inCinemas ??
          'Unknown';

        entries.push({
          title: movie.title ?? 'Unknown',
          year: movie.year ?? 0,
          releaseDate:
            typeof releaseDate === 'string'
              ? releaseDate.split('T')[0]!
              : 'Unknown',
          status: movie.status ?? 'unknown',
          monitored: movie.monitored ?? false,
          hasFile: movie.hasFile ?? false,
          overview: movie.overview?.slice(0, 100),
        });
      }
    }

    if (entries.length === 0) {
      return {
        success: true,
        message: `No upcoming releases in the next ${days} days`,
        data: { entries: [] },
      };
    }

    const summary = entries
      .map(
        (e) =>
          `- ${e.title} (${e.year}) - ${e.releaseDate} [${e.status}${e.hasFile ? ', downloaded' : ''}]`,
      )
      .join('\n');

    return {
      success: true,
      message: `${entries.length} upcoming release(s) in the next ${days} days:\n${summary}`,
      data: { entries },
    };
  },
};
