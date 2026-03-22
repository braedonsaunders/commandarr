import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'sonarr_series_completeness',
  integration: 'sonarr',
  description:
    'Analyze completeness of all series in your library. Shows percentage complete, total vs downloaded episodes, and identifies the most incomplete series.',
  parameters: {
    type: 'object',
    properties: {
      sortBy: {
        type: 'string',
        description:
          '"missing" to sort by most missing episodes, "percent" to sort by lowest completion percentage (default: "missing")',
      },
      onlyIncomplete: {
        type: 'boolean',
        description:
          'Only show series that are not 100% complete (default: true)',
      },
      limit: {
        type: 'number',
        description: 'Max series to return (default: 30)',
      },
    },
  },
  ui: {
    category: 'Content Gaps',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const { sortBy = 'missing', onlyIncomplete = true, limit = 30 } = params;

    const client = ctx.getClient('sonarr');
    ctx.log('Analyzing series completeness...');

    const allSeries = await client.get('/api/v3/series');

    if (!Array.isArray(allSeries) || allSeries.length === 0) {
      return {
        success: true,
        message: 'No series found in Sonarr',
        data: { series: [] },
      };
    }

    const seriesStats = allSeries.map((s: any) => {
      const totalEpisodes = s.statistics?.totalEpisodeCount ?? 0;
      const episodeFileCount = s.statistics?.episodeFileCount ?? 0;
      const sizeOnDisk = s.statistics?.sizeOnDisk ?? 0;
      const missing = totalEpisodes - episodeFileCount;
      const percentComplete =
        totalEpisodes > 0
          ? Math.round((episodeFileCount / totalEpisodes) * 100)
          : 100;

      return {
        title: s.title,
        year: s.year,
        status: s.status,
        monitored: s.monitored,
        seasonCount: s.statistics?.seasonCount ?? 0,
        totalEpisodes,
        downloadedEpisodes: episodeFileCount,
        missingEpisodes: missing,
        percentComplete,
        sizeOnDisk: formatBytes(sizeOnDisk),
      };
    });

    let filtered = onlyIncomplete
      ? seriesStats.filter((s: any) => s.missingEpisodes > 0)
      : seriesStats;

    if (sortBy === 'percent') {
      filtered.sort((a: any, b: any) => a.percentComplete - b.percentComplete);
    } else {
      filtered.sort((a: any, b: any) => b.missingEpisodes - a.missingEpisodes);
    }

    const results = filtered.slice(0, limit);

    const totalMissing = seriesStats.reduce(
      (sum: number, s: any) => sum + s.missingEpisodes,
      0,
    );
    const totalComplete = seriesStats.filter(
      (s: any) => s.missingEpisodes === 0,
    ).length;

    const summary = results
      .map(
        (s: any) =>
          `- ${s.title} (${s.year}): ${s.percentComplete}% complete — ${s.downloadedEpisodes}/${s.totalEpisodes} episodes (${s.missingEpisodes} missing) [${s.status}]`,
      )
      .join('\n');

    return {
      success: true,
      message: `Library: ${allSeries.length} series, ${totalComplete} complete, ${totalMissing} total missing episodes.\n\n${onlyIncomplete ? 'Incomplete' : 'All'} series (sorted by ${sortBy === 'percent' ? 'completion %' : 'most missing'}):\n${summary}`,
      data: {
        series: results,
        totalSeries: allSeries.length,
        completeSeries: totalComplete,
        incompleteSeries: allSeries.length - totalComplete,
        totalMissingEpisodes: totalMissing,
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
