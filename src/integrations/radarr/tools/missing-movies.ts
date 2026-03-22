import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'radarr_missing_movies',
  integration: 'radarr',
  description:
    'Find monitored movies in Radarr that are missing (not yet downloaded). Shows movies that are being tracked but have no file on disk.',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Max results to return (default: 50)',
      },
      sortBy: {
        type: 'string',
        description:
          '"added" to sort by date added, "year" to sort by release year, "title" to sort alphabetically (default: "added")',
      },
    },
  },
  ui: {
    category: 'Content Gaps',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const { limit = 50, sortBy = 'added' } = params;

    const client = ctx.getClient('radarr');
    ctx.log('Scanning for missing movies...');

    const queryParams: Record<string, string> = {
      page: '1',
      pageSize: String(Math.min(limit, 100)),
      monitored: 'true',
      sortDirection: 'descending',
    };

    if (sortBy === 'year') {
      queryParams.sortKey = 'year';
    } else if (sortBy === 'title') {
      queryParams.sortKey = 'sortTitle';
      queryParams.sortDirection = 'ascending';
    } else {
      queryParams.sortKey = 'added';
    }

    const response = await client.get('/api/v3/wanted/missing', queryParams);
    const records = response.records ?? [];
    const totalRecords = response.totalRecords ?? 0;

    if (!Array.isArray(records) || records.length === 0) {
      return {
        success: true,
        message: 'No missing movies found. Your movie library is complete!',
        data: { missing: [], totalMissing: 0 },
      };
    }

    const missing = records.map((m: any) => ({
      title: m.title ?? 'Unknown',
      year: m.year ?? 0,
      tmdbId: m.tmdbId,
      status: m.status ?? 'unknown',
      monitored: m.monitored ?? false,
      added: m.added
        ? new Date(m.added).toLocaleDateString()
        : 'unknown',
      isAvailable: m.isAvailable ?? false,
    }));

    const available = missing.filter((m: any) => m.isAvailable).length;
    const unavailable = missing.length - available;

    const summary = missing
      .map(
        (m: any) =>
          `- ${m.title} (${m.year}) [TMDB: ${m.tmdbId}] — ${m.isAvailable ? 'available for download' : 'not yet released'}${m.status !== 'released' ? ` (${m.status})` : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${totalRecords} missing movie(s) (${available} available, ${unavailable} not yet released):\n${summary}${totalRecords > missing.length ? `\n\n(Showing ${missing.length} of ${totalRecords})` : ''}`,
      data: {
        missing,
        totalMissing: totalRecords,
        availableCount: available,
        unavailableCount: unavailable,
      },
    };
  },
};
