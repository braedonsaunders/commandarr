import type { ToolDefinition } from '../../_base';

interface CalendarEntry {
  author: string;
  bookTitle: string;
  releaseDate: string;
  monitored: boolean;
  hasFile: boolean;
  overview?: string;
}

export const tool: ToolDefinition = {
  name: 'readarr_calendar',
  integration: 'readarr',
  description: 'Get upcoming and recent book releases from Readarr',
  parameters: {
    type: 'object',
    properties: {
      days: {
        type: 'number',
        description: 'Number of days to look ahead (default: 30)',
      },
    },
  },
  ui: {
    category: 'Books',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { days: 30 },
  },
  async handler(params, ctx) {
    const days = typeof params.days === 'number' && params.days > 0 ? params.days : 30;

    const client = ctx.getClient('readarr');
    ctx.log(`Fetching Readarr calendar for next ${days} days...`);

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
      for (const book of results) {
        const releaseDate = book.releaseDate ?? 'Unknown';

        entries.push({
          author: book.author?.authorName ?? 'Unknown',
          bookTitle: book.title ?? 'Unknown',
          releaseDate:
            typeof releaseDate === 'string'
              ? releaseDate.split('T')[0]!
              : 'Unknown',
          monitored: book.monitored ?? false,
          hasFile: book.grabbed ?? false,
          overview: book.overview?.slice(0, 100),
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
          `- ${e.author} - ${e.bookTitle} - ${e.releaseDate} [${e.monitored ? 'monitored' : 'unmonitored'}${e.hasFile ? ', downloaded' : ''}]`,
      )
      .join('\n');

    return {
      success: true,
      message: `${entries.length} upcoming release(s) in the next ${days} days:\n${summary}`,
      data: { entries },
    };
  },
};
