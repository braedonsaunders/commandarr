import type { ToolDefinition } from '../../_base';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export const tool: ToolDefinition = {
  name: 'radarr_releases',
  integration: 'radarr',
  description:
    'Search indexers for available releases of a movie (interactive search). Returns all available downloads with quality, size, indexer, seeders, custom format score, and rejection reasons. Use this to see what releases are available before grabbing one.',
  parameters: {
    type: 'object',
    properties: {
      movieId: {
        type: 'number',
        description: 'Radarr movie ID to search releases for',
      },
    },
    required: ['movieId'],
  },
  ui: {
    category: 'Movies',
    dangerLevel: 'low',
    testable: false,
  },
  async handler(params, ctx) {
    const { movieId } = params;
    const client = ctx.getClient('radarr');

    ctx.log(`Fetching movie info for ID ${movieId}...`);
    let movie: any;
    try {
      movie = await client.get(`/api/v3/movie/${movieId}`);
    } catch {
      return { success: false, message: `No movie found with ID ${movieId}` };
    }

    const title = movie.title ?? 'Unknown';
    const year = movie.year ?? '';

    ctx.log(`Searching indexers for releases of: ${title} (${year})...`);
    const releases: any[] = await client.get('/api/v3/release', {
      movieId: String(movieId),
    });

    if (!Array.isArray(releases) || releases.length === 0) {
      return {
        success: true,
        message: `No releases found for ${title} (${year}). Your indexers may not have any results.`,
        data: { movie: { id: movieId, title, year }, releases: [] },
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
      };
    });

    const approved = formatted.filter((r) => !r.rejected);
    const rejectedCount = formatted.filter((r) => r.rejected).length;

    const lines = approved.slice(0, 15).map(
      (r, i) =>
        `${i + 1}. [${r.quality}] ${r.title}\n   Size: ${r.size} | Seeds: ${r.seeders} | ${r.indexer} | Age: ${r.age} | CF: ${r.customFormatScore}`,
    );

    const summary = [
      `Releases for ${title} (${year}):`,
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

    summary.push('\nUse radarr_grab_release with the guid to download a specific release.');

    return {
      success: true,
      message: summary.join('\n'),
      data: {
        movie: { id: movieId, title, year },
        totalReleases: releases.length,
        approvedCount: approved.length,
        rejectedCount,
        releases: formatted,
      },
    };
  },
};
