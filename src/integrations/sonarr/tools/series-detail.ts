import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'sonarr_series_detail',
  integration: 'sonarr',
  description:
    'Look up a series in your Sonarr library by name or ID. Returns episode counts, download status, and per-season breakdown. Use this to answer questions like "how many episodes of X do I have?" or "is X fully downloaded?"',
  parameters: {
    type: 'object',
    properties: {
      term: {
        type: 'string',
        description:
          'Search term to match against series titles in your library (case-insensitive partial match)',
      },
      seriesId: {
        type: 'number',
        description: 'Sonarr series ID for exact lookup',
      },
    },
  },
  ui: {
    category: 'TV Shows',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { term: 'breaking' },
  },
  async handler(params, ctx) {
    const { term, seriesId } = params;

    if (!term && !seriesId) {
      return {
        success: false,
        message:
          'Provide either a search term or a seriesId to look up a series.',
      };
    }

    const client = ctx.getClient('sonarr');

    // If we have a seriesId, fetch directly; otherwise search by name
    let series: any;

    if (seriesId) {
      ctx.log(`Looking up series ID ${seriesId}`);
      try {
        series = await client.get(`/api/v3/series/${seriesId}`);
      } catch {
        return {
          success: false,
          message: `No series found with ID ${seriesId}`,
        };
      }
    } else {
      ctx.log(`Searching library for: ${term}`);
      const allSeries: any[] = await client.get('/api/v3/series');
      const needle = term!.toLowerCase();
      const matches = allSeries.filter((s: any) =>
        s.title?.toLowerCase().includes(needle),
      );

      if (matches.length === 0) {
        return {
          success: true,
          message: `No series matching "${term}" found in your Sonarr library. It may not be added yet — use sonarr_search to find it externally.`,
          data: { found: false },
        };
      }

      if (matches.length > 1) {
        const list = matches
          .slice(0, 10)
          .map(
            (s: any) =>
              `- ${s.title} (${s.year}) [ID: ${s.id}] — ${s.statistics?.episodeFileCount ?? 0}/${s.statistics?.totalEpisodeCount ?? 0} episodes`,
          )
          .join('\n');
        return {
          success: true,
          message: `Multiple matches for "${term}":\n${list}\n\nUse seriesId for an exact lookup.`,
          data: {
            found: true,
            multiple: true,
            matches: matches.slice(0, 10).map((s: any) => ({
              id: s.id,
              title: s.title,
              year: s.year,
            })),
          },
        };
      }

      series = matches[0];
    }

    // Fetch episodes for this series
    const episodes: any[] = await client.get('/api/v3/episode', {
      seriesId: String(series.id),
    });

    // Build per-season breakdown
    const seasons: Record<
      number,
      { total: number; downloaded: number; monitored: number }
    > = {};

    for (const ep of episodes) {
      const sn = ep.seasonNumber ?? 0;
      if (sn === 0) continue; // skip specials
      if (!seasons[sn]) seasons[sn] = { total: 0, downloaded: 0, monitored: 0 };
      seasons[sn].total++;
      if (ep.hasFile) seasons[sn].downloaded++;
      if (ep.monitored) seasons[sn].monitored++;
    }

    const totalEpisodes = Object.values(seasons).reduce(
      (sum, s) => sum + s.total,
      0,
    );
    const downloadedEpisodes = Object.values(seasons).reduce(
      (sum, s) => sum + s.downloaded,
      0,
    );
    const missingEpisodes = totalEpisodes - downloadedEpisodes;

    const seasonLines = Object.entries(seasons)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(
        ([sn, stats]) =>
          `  Season ${sn}: ${stats.downloaded}/${stats.total} episodes${stats.downloaded === stats.total ? ' ✓' : ` (${stats.total - stats.downloaded} missing)`}`,
      )
      .join('\n');

    const percentComplete =
      totalEpisodes > 0
        ? Math.round((downloadedEpisodes / totalEpisodes) * 100)
        : 100;

    const sizeOnDisk = series.statistics?.sizeOnDisk ?? 0;
    const sizeStr = formatBytes(sizeOnDisk);

    const summary = [
      `${series.title} (${series.year}) — ${series.status}`,
      `${downloadedEpisodes}/${totalEpisodes} episodes downloaded (${percentComplete}%)${missingEpisodes > 0 ? ` — ${missingEpisodes} missing` : ''}`,
      `Size on disk: ${sizeStr}`,
      `Monitored: ${series.monitored ? 'Yes' : 'No'} | Network: ${series.network ?? 'Unknown'}`,
      '',
      'Seasons:',
      seasonLines,
    ].join('\n');

    return {
      success: true,
      message: summary,
      data: {
        found: true,
        id: series.id,
        title: series.title,
        year: series.year,
        status: series.status,
        network: series.network,
        monitored: series.monitored,
        totalEpisodes,
        downloadedEpisodes,
        missingEpisodes,
        percentComplete,
        sizeOnDisk: sizeStr,
        seasons: Object.fromEntries(
          Object.entries(seasons).map(([sn, stats]) => [sn, stats]),
        ),
      },
    };
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
