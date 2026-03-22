import type { ToolDefinition } from '../../_base';

interface HistoryRecord {
  seriesTitle: string;
  episodeTitle: string;
  season: number;
  episode: number;
  eventType: string;
  date: string;
  quality: string;
  sourceTitle: string;
}

export const tool: ToolDefinition = {
  name: 'sonarr_history',
  integration: 'sonarr',
  description:
    'Get recent activity history from Sonarr, including grabs, imports, failures, and deletions.',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 20)',
      },
      seriesId: {
        type: 'number',
        description: 'Filter history to a specific series ID',
      },
      eventType: {
        type: 'string',
        description:
          'Filter by event type: "grabbed", "downloadFolderImported", "downloadFailed", "episodeFileDeleted", "episodeFileRenamed"',
      },
    },
  },
  ui: {
    category: 'TV Shows',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const { limit = 20, seriesId, eventType } = params;

    const client = ctx.getClient('sonarr');
    ctx.log('Fetching Sonarr history...');

    const queryParams: Record<string, string> = {
      page: '1',
      pageSize: String(limit),
      sortKey: 'date',
      sortDirection: 'descending',
      includeSeries: 'true',
      includeEpisode: 'true',
    };

    if (seriesId !== undefined && seriesId !== null) {
      queryParams.seriesId = String(seriesId);
    }
    if (eventType) {
      queryParams.eventType = eventType;
    }

    const response = await client.get('/api/v3/history', queryParams);
    const records = response.records ?? response ?? [];

    if (!Array.isArray(records) || records.length === 0) {
      return {
        success: true,
        message: 'No history records found',
        data: { records: [] },
      };
    }

    const items: HistoryRecord[] = records.map(
      (record: Record<string, unknown>) => {
        const series = record.series as Record<string, unknown> | undefined;
        const episode = record.episode as Record<string, unknown> | undefined;
        const quality = record.quality as Record<string, unknown> | undefined;
        const qualityObj = quality?.quality as
          | Record<string, unknown>
          | undefined;

        return {
          seriesTitle:
            (series?.title as string) ?? (record.sourceTitle as string) ?? 'Unknown',
          episodeTitle: (episode?.title as string) ?? 'Unknown',
          season: (episode?.seasonNumber as number) ?? 0,
          episode: (episode?.episodeNumber as number) ?? 0,
          eventType: (record.eventType as string) ?? 'unknown',
          date: (record.date as string) ?? '',
          quality: (qualityObj?.name as string) ?? 'Unknown',
          sourceTitle: (record.sourceTitle as string) ?? '',
        };
      },
    );

    // Group by date (day)
    const grouped: Record<string, HistoryRecord[]> = {};
    for (const item of items) {
      const day = item.date ? item.date.substring(0, 10) : 'Unknown';
      if (!grouped[day]) {
        grouped[day] = [];
      }
      grouped[day].push(item);
    }

    const eventLabels: Record<string, string> = {
      grabbed: 'Grabbed',
      downloadFolderImported: 'Imported',
      downloadFailed: 'Failed',
      episodeFileDeleted: 'Deleted',
      episodeFileRenamed: 'Renamed',
    };

    const summaryParts: string[] = [];
    for (const [day, dayItems] of Object.entries(grouped)) {
      summaryParts.push(`**${day}**`);
      for (const item of dayItems) {
        const label = eventLabels[item.eventType] ?? item.eventType;
        const epCode = `S${String(item.season).padStart(2, '0')}E${String(item.episode).padStart(2, '0')}`;
        summaryParts.push(
          `- [${label}] ${item.seriesTitle} ${epCode} "${item.episodeTitle}" (${item.quality})`,
        );
      }
    }

    return {
      success: true,
      message: `${items.length} history record(s):\n${summaryParts.join('\n')}`,
      data: { records: items },
    };
  },
};
