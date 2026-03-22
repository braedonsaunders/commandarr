import type { ToolDefinition } from '../../_base';

interface CalendarEntry {
  artist: string;
  albumTitle: string;
  releaseDate: string;
  albumType: string;
  monitored: boolean;
  hasFile: boolean;
  overview?: string;
}

export const tool: ToolDefinition = {
  name: 'lidarr_calendar',
  integration: 'lidarr',
  description: 'Get upcoming and recent album releases from Lidarr',
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
    category: 'Music',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { days: 7 },
  },
  async handler(params, ctx) {
    const days = typeof params.days === 'number' && params.days > 0 ? params.days : 7;

    const client = ctx.getClient('lidarr');
    ctx.log(`Fetching Lidarr calendar for next ${days} days...`);

    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);

    const results = await client.get('/api/v1/calendar', {
      start: start.toISOString().split('T')[0]!,
      end: end.toISOString().split('T')[0]!,
      includeUnmonitored: 'false',
    });

    const entries: CalendarEntry[] = [];

    if (Array.isArray(results)) {
      for (const album of results) {
        const releaseDate = album.releaseDate ?? 'Unknown';

        entries.push({
          artist: album.artist?.artistName ?? 'Unknown',
          albumTitle: album.title ?? 'Unknown',
          releaseDate:
            typeof releaseDate === 'string'
              ? releaseDate.split('T')[0]!
              : 'Unknown',
          albumType: album.albumType ?? 'Unknown',
          monitored: album.monitored ?? false,
          hasFile: (album.statistics?.percentOfTracks === 100) || false,
          overview: album.overview?.slice(0, 100),
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
          `- ${e.artist} - ${e.albumTitle} (${e.albumType}) - ${e.releaseDate} [${e.monitored ? 'monitored' : 'unmonitored'}${e.hasFile ? ', downloaded' : ''}]`,
      )
      .join('\n');

    return {
      success: true,
      message: `${entries.length} upcoming release(s) in the next ${days} days:\n${summary}`,
      data: { entries },
    };
  },
};
