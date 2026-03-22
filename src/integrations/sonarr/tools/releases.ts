import type { ToolDefinition } from '../../_base';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export const tool: ToolDefinition = {
  name: 'sonarr_releases',
  integration: 'sonarr',
  description:
    'Search indexers for available releases of an episode (interactive search). Returns all available downloads with quality, size, indexer, seeders, custom format score, and rejection reasons. Can search by episode ID or series ID + season.',
  parameters: {
    type: 'object',
    properties: {
      episodeId: {
        type: 'number',
        description: 'Sonarr episode ID to search releases for (use sonarr_series_detail to find episode IDs)',
      },
      seriesId: {
        type: 'number',
        description: 'Sonarr series ID (use with seasonNumber for season pack searches)',
      },
      seasonNumber: {
        type: 'number',
        description: 'Season number (use with seriesId for season pack searches)',
      },
    },
  },
  ui: {
    category: 'TV Shows',
    dangerLevel: 'low',
    testable: false,
  },
  async handler(params, ctx) {
    const { episodeId, seriesId, seasonNumber } = params;
    const client = ctx.getClient('sonarr');

    if (!episodeId && !seriesId) {
      return { success: false, message: 'Provide either episodeId or seriesId (with optional seasonNumber)' };
    }

    const queryParams: Record<string, string> = {};
    let searchLabel: string;

    if (episodeId) {
      queryParams.episodeId = String(episodeId);
      searchLabel = `episode ID ${episodeId}`;
    } else {
      queryParams.seriesId = String(seriesId);
      if (seasonNumber !== undefined) {
        queryParams.seasonNumber = String(seasonNumber);
        searchLabel = `series ${seriesId} season ${seasonNumber}`;
      } else {
        searchLabel = `series ${seriesId}`;
      }
    }

    ctx.log(`Searching indexers for releases: ${searchLabel}...`);
    const releases: any[] = await client.get('/api/v3/release', queryParams);

    if (!Array.isArray(releases) || releases.length === 0) {
      return {
        success: true,
        message: `No releases found for ${searchLabel}. Your indexers may not have any results.`,
        data: { releases: [] },
      };
    }

    const formatted = releases.slice(0, 30).map((r: any) => {
      const quality = r.quality?.quality?.name ?? 'Unknown';
      const size = formatBytes(r.size ?? 0);
      const seeders = r.seeders ?? 'N/A';
      const leechers = r.leechers ?? 'N/A';
      const indexer = r.indexer ?? 'Unknown';
      const age = r.ageHours != null ? `${Math.round(r.ageHours / 24)}d` : '?';
      const cfScore = r.customFormatScore ?? 0;
      const rejected = r.rejected ?? false;
      const rejections = (r.rejections ?? []).map((rej: any) => rej.reason ?? rej).join(', ');
      const fullSeason = r.fullSeason ?? false;

      return {
        guid: r.guid,
        title: r.title,
        quality,
        size,
        sizeBytes: r.size ?? 0,
        seeders,
        leechers,
        indexer,
        age,
        customFormatScore: cfScore,
        rejected,
        rejections: rejections || undefined,
        indexerId: r.indexerId,
        downloadAllowed: r.downloadAllowed ?? true,
        protocol: r.protocol ?? 'unknown',
        fullSeason,
      };
    });

    const approved = formatted.filter((r) => !r.rejected);
    const rejectedCount = formatted.filter((r) => r.rejected).length;

    const lines = approved.slice(0, 15).map(
      (r, i) =>
        `${i + 1}. [${r.quality}]${r.fullSeason ? ' [SEASON PACK]' : ''} ${r.title}\n   Size: ${r.size} | Seeds: ${r.seeders} | ${r.indexer} | Age: ${r.age} | CF: ${r.customFormatScore}`,
    );

    const summary = [
      `Releases for ${searchLabel}:`,
      `Found ${releases.length} total (${approved.length} approved, ${rejectedCount} rejected)`,
      '',
      ...lines,
    ];

    if (approved.length > 15) {
      summary.push(`\n...and ${approved.length - 15} more approved releases`);
    }
    if (rejectedCount > 0) {
      summary.push(`\n${rejectedCount} release(s) rejected by quality/custom format filters`);
    }

    summary.push('\nUse sonarr_grab_release with the guid to download a specific release.');

    return {
      success: true,
      message: summary.join('\n'),
      data: {
        searchLabel,
        totalReleases: releases.length,
        approvedCount: approved.length,
        rejectedCount,
        releases: formatted,
      },
    };
  },
};
