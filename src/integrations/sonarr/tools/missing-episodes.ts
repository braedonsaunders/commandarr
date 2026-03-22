import type { ToolDefinition } from '../../_base';

interface MissingEpisode {
  seriesTitle: string;
  season: number;
  episode: number;
  episodeTitle: string;
  airDate: string;
  monitored: boolean;
}

export const tool: ToolDefinition = {
  name: 'sonarr_missing_episodes',
  integration: 'sonarr',
  description:
    'Find missing episodes across all monitored series. Shows gaps in your TV library — episodes that have aired but are not downloaded.',
  parameters: {
    type: 'object',
    properties: {
      seriesId: {
        type: 'number',
        description:
          'Filter to a specific series ID. If not set, checks all monitored series.',
      },
      includeUnmonitored: {
        type: 'boolean',
        description:
          'Include unmonitored episodes in results (default: false)',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default: 50)',
      },
    },
  },
  ui: {
    category: 'Content Gaps',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const {
      seriesId,
      includeUnmonitored = false,
      limit = 50,
    } = params;

    const client = ctx.getClient('sonarr');
    ctx.log('Scanning for missing episodes...');

    // Use the wanted/missing endpoint which is purpose-built for this
    const queryParams: Record<string, string> = {
      page: '1',
      pageSize: String(Math.min(limit, 100)),
      sortKey: 'series.sortTitle',
      sortDirection: 'ascending',
      includeSeries: 'true',
      includeImages: 'false',
      monitored: includeUnmonitored ? 'false' : 'true',
    };

    if (seriesId) {
      queryParams.seriesIds = String(seriesId);
    }

    const response = await client.get('/api/v3/wanted/missing', queryParams);
    const records = response.records ?? [];
    const totalRecords = response.totalRecords ?? 0;

    if (!Array.isArray(records) || records.length === 0) {
      return {
        success: true,
        message: 'No missing episodes found. Your TV library is complete!',
        data: { missing: [], totalMissing: 0 },
      };
    }

    const missing: MissingEpisode[] = records.map((ep: any) => ({
      seriesTitle: ep.series?.title ?? 'Unknown',
      season: ep.seasonNumber ?? 0,
      episode: ep.episodeNumber ?? 0,
      episodeTitle: ep.title ?? 'Unknown',
      airDate: ep.airDateUtc
        ? new Date(ep.airDateUtc).toLocaleDateString()
        : 'unknown',
      monitored: ep.monitored ?? false,
    }));

    // Group by series for a cleaner summary
    const bySeries: Record<string, MissingEpisode[]> = {};
    for (const ep of missing) {
      if (!bySeries[ep.seriesTitle]) {
        bySeries[ep.seriesTitle] = [];
      }
      bySeries[ep.seriesTitle].push(ep);
    }

    const summary = Object.entries(bySeries)
      .map(([series, episodes]) => {
        const epList = episodes
          .slice(0, 5)
          .map(
            (e) =>
              `  S${String(e.season).padStart(2, '0')}E${String(e.episode).padStart(2, '0')} "${e.episodeTitle}" (aired ${e.airDate})`,
          )
          .join('\n');
        const extra =
          episodes.length > 5
            ? `\n  ...and ${episodes.length - 5} more`
            : '';
        return `- ${series} (${episodes.length} missing):\n${epList}${extra}`;
      })
      .join('\n');

    return {
      success: true,
      message: `${totalRecords} missing episode(s) across ${Object.keys(bySeries).length} series:\n${summary}${totalRecords > missing.length ? `\n\n(Showing ${missing.length} of ${totalRecords} total)` : ''}`,
      data: {
        missing,
        totalMissing: totalRecords,
        seriesCount: Object.keys(bySeries).length,
        bySeries: Object.fromEntries(
          Object.entries(bySeries).map(([k, v]) => [k, v.length]),
        ),
      },
    };
  },
};
