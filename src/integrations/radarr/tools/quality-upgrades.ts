import type { ToolDefinition } from '../../_base';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// Quality ranking — lower quality IDs that could be upgraded
const QUALITY_RANK: Record<string, number> = {
  'SDTV': 1,
  'DVD': 2,
  'WEBDL-480p': 3,
  'WEBRip-480p': 3,
  'Bluray-480p': 4,
  'WEBDL-720p': 5,
  'WEBRip-720p': 5,
  'Bluray-720p': 6,
  'HDTV-720p': 5,
  'HDTV-1080p': 7,
  'WEBDL-1080p': 8,
  'WEBRip-1080p': 8,
  'Bluray-1080p': 9,
  'Remux-1080p': 10,
  'WEBDL-2160p': 11,
  'WEBRip-2160p': 11,
  'Bluray-2160p': 12,
  'Remux-2160p': 13,
};

export const tool: ToolDefinition = {
  name: 'radarr_quality_upgrades',
  integration: 'radarr',
  description:
    'Find movies in your library that could be upgraded to better quality. Identifies movies in lower quality (e.g., 720p) that your quality profile allows upgrading (e.g., to 1080p or 4K).',
  parameters: {
    type: 'object',
    properties: {
      maxQuality: {
        type: 'string',
        description:
          'Only show movies below this quality (e.g., "WEBDL-1080p", "Bluray-720p"). If not set, shows all movies that can be upgraded per their quality profile.',
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
    const { maxQuality, limit = 50 } = params;

    const client = ctx.getClient('radarr');
    ctx.log('Scanning for quality upgrade opportunities...');

    // Get all movies and quality profiles
    const [movies, profiles] = await Promise.all([
      client.get('/api/v3/movie'),
      client.get('/api/v3/qualityprofile'),
    ]);

    if (!Array.isArray(movies) || movies.length === 0) {
      return {
        success: true,
        message: 'No movies found in Radarr',
        data: { upgrades: [] },
      };
    }

    // Build profile cutoff map
    const profileCutoffs: Record<number, { name: string; cutoffId: number; cutoffName: string }> = {};
    if (Array.isArray(profiles)) {
      for (const p of profiles) {
        const cutoffItem = findQualityById(p.items, p.cutoff);
        profileCutoffs[p.id] = {
          name: p.name,
          cutoffId: p.cutoff,
          cutoffName: cutoffItem ?? 'Unknown',
        };
      }
    }

    const upgradeable: any[] = [];

    for (const movie of movies) {
      if (!movie.hasFile || !movie.movieFile) continue;

      const currentQuality = movie.movieFile.quality?.quality?.name ?? '';
      const currentQualityId = movie.movieFile.quality?.quality?.id ?? 0;
      const profile = profileCutoffs[movie.qualityProfileId];

      if (!profile) continue;

      // Check if current quality is below the profile cutoff
      const currentRank = QUALITY_RANK[currentQuality] ?? 0;

      // Apply maxQuality filter if specified
      if (maxQuality) {
        const maxRank = QUALITY_RANK[maxQuality] ?? 999;
        if (currentRank >= maxRank) continue;
      }

      // Check if quality is below cutoff (upgrade allowed)
      const isBelowCutoff = currentQualityId !== profile.cutoffId;
      if (!isBelowCutoff && !maxQuality) continue;
      if (!maxQuality && !isBelowCutoff) continue;

      upgradeable.push({
        title: movie.title,
        year: movie.year,
        tmdbId: movie.tmdbId,
        currentQuality,
        currentQualityRank: currentRank,
        profileName: profile.name,
        cutoff: profile.cutoffName,
        sizeOnDisk: formatBytes(movie.movieFile.size ?? 0),
        path: movie.path,
        monitored: movie.monitored,
      });
    }

    // Sort by quality rank (lowest first = most in need of upgrade)
    upgradeable.sort((a, b) => a.currentQualityRank - b.currentQualityRank);
    const results = upgradeable.slice(0, limit);

    if (results.length === 0) {
      return {
        success: true,
        message: 'All movies are at or above their quality profile cutoff. No upgrades needed.',
        data: { upgrades: [], totalMovies: movies.length },
      };
    }

    // Group by current quality for summary
    const byQuality: Record<string, number> = {};
    for (const m of upgradeable) {
      byQuality[m.currentQuality] = (byQuality[m.currentQuality] ?? 0) + 1;
    }

    const qualitySummary = Object.entries(byQuality)
      .sort((a, b) => (QUALITY_RANK[a[0]] ?? 0) - (QUALITY_RANK[b[0]] ?? 0))
      .map(([q, count]) => `${q}: ${count} movies`)
      .join(', ');

    const summary = results
      .map(
        (m) =>
          `- ${m.title} (${m.year}): ${m.currentQuality} → cutoff: ${m.cutoff} [${m.sizeOnDisk}]`,
      )
      .join('\n');

    return {
      success: true,
      message: `${upgradeable.length} movie(s) can be upgraded.\nBreakdown: ${qualitySummary}\n\n${summary}${upgradeable.length > results.length ? `\n\n(Showing ${results.length} of ${upgradeable.length})` : ''}`,
      data: {
        upgrades: results,
        totalUpgradeable: upgradeable.length,
        totalMovies: movies.length,
        byQuality,
      },
    };
  },
};

function findQualityById(items: any[], targetId: number): string | null {
  for (const item of items ?? []) {
    if (item.quality?.id === targetId) return item.quality.name;
    if (item.items) {
      const found = findQualityById(item.items, targetId);
      if (found) return found;
    }
  }
  return null;
}
