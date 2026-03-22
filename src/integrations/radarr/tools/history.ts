import type { ToolDefinition } from '../../_base';

interface HistoryRecord {
  movieTitle: string;
  year: number;
  eventType: string;
  date: string;
  quality: string;
  sourceTitle: string;
}

export const tool: ToolDefinition = {
  name: 'radarr_history',
  integration: 'radarr',
  description:
    'Get recent activity history from Radarr, including grabs, imports, deletions, and renames. Optionally filter by movie or event type.',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 20)',
      },
      movieId: {
        type: 'number',
        description: 'Filter history to a specific movie by Radarr ID',
      },
      eventType: {
        type: 'string',
        description:
          'Filter by event type: grabbed, downloadFolderImported, downloadFailed, movieFileDeleted, movieFileRenamed',
      },
    },
  },
  ui: {
    category: 'Movies',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const { limit = 20, movieId, eventType } = params;
    const client = ctx.getClient('radarr');

    ctx.log('Fetching Radarr history...');

    const queryParams: Record<string, string> = {
      page: '1',
      pageSize: String(limit),
      sortKey: 'date',
      sortDirection: 'descending',
      includeMovie: 'true',
    };

    if (movieId !== undefined) {
      queryParams.movieId = String(movieId);
    }

    if (eventType) {
      queryParams.eventType = eventType;
    }

    const response = await client.get('/api/v3/history', queryParams);

    const records = response.records ?? response ?? [];
    const items: HistoryRecord[] = [];

    if (Array.isArray(records)) {
      for (const record of records) {
        items.push({
          movieTitle: record.movie?.title ?? record.sourceTitle ?? 'Unknown',
          year: record.movie?.year ?? 0,
          eventType: record.eventType ?? 'unknown',
          date: record.date
            ? new Date(record.date).toLocaleString()
            : 'Unknown',
          quality: record.quality?.quality?.name ?? 'Unknown',
          sourceTitle: record.sourceTitle ?? '',
        });
      }
    }

    if (items.length === 0) {
      return {
        success: true,
        message: 'No history records found.',
        data: { items: [] },
      };
    }

    const summary = items
      .map(
        (item) =>
          `- ${item.movieTitle}${item.year ? ` (${item.year})` : ''}: ${item.eventType} — ${item.quality} — ${item.date}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} history record(s):\n${summary}`,
      data: { items },
    };
  },
};
