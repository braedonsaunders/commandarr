import type { ToolDefinition } from '../../_base';

interface QueueItem {
  title: string;
  episodeTitle: string;
  season: number;
  episode: number;
  status: string;
  progress: number;
  size: string;
  sizeleft: string;
  eta?: string;
  quality: string;
  indexer?: string;
  downloadClient?: string;
  errorMessage?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export const tool: ToolDefinition = {
  name: 'sonarr_queue',
  integration: 'sonarr',
  description: 'Check the Sonarr download queue',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Downloads',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('sonarr');
    ctx.log('Fetching Sonarr download queue...');

    const response = await client.get('/api/v3/queue', {
      page: '1',
      pageSize: '50',
      includeSeries: 'true',
      includeEpisode: 'true',
    });

    const records = response.records ?? response ?? [];
    const items: QueueItem[] = [];

    if (Array.isArray(records)) {
      for (const record of records) {
        const totalSize = record.size ?? 0;
        const sizeLeft = record.sizeleft ?? 0;
        const progress =
          totalSize > 0
            ? Math.round(((totalSize - sizeLeft) / totalSize) * 100)
            : 0;

        const series = record.series;
        const episode = record.episode;

        items.push({
          title: series?.title ?? record.title ?? 'Unknown',
          episodeTitle: episode?.title ?? 'Unknown',
          season: episode?.seasonNumber ?? 0,
          episode: episode?.episodeNumber ?? 0,
          status: record.status ?? 'unknown',
          progress,
          size: formatBytes(totalSize),
          sizeleft: formatBytes(sizeLeft),
          eta: record.estimatedCompletionTime
            ? new Date(record.estimatedCompletionTime).toLocaleString()
            : undefined,
          quality: record.quality?.quality?.name ?? 'Unknown',
          indexer: record.indexer,
          downloadClient: record.downloadClient,
          errorMessage: record.errorMessage,
        });
      }
    }

    if (items.length === 0) {
      return {
        success: true,
        message: 'Download queue is empty',
        data: { items: [] },
      };
    }

    const summary = items
      .map(
        (item) =>
          `- ${item.title} S${String(item.season).padStart(2, '0')}E${String(item.episode).padStart(2, '0')} "${item.episodeTitle}": ${item.status} (${item.progress}%, ${item.sizeleft} remaining${item.eta ? `, ETA: ${item.eta}` : ''})`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} item(s) in queue:\n${summary}`,
      data: { items },
    };
  },
};
