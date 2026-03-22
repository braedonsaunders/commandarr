import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'sonarr_toggle_monitoring',
  integration: 'sonarr',
  description:
    'Toggle monitoring for a series or a specific season in Sonarr. Use this to enable or disable monitoring so Sonarr will (or will not) search for and download episodes.',
  parameters: {
    type: 'object',
    properties: {
      seriesId: {
        type: 'number',
        description: 'Sonarr series ID',
      },
      monitored: {
        type: 'boolean',
        description: 'Whether to enable (true) or disable (false) monitoring',
      },
      seasonNumber: {
        type: 'number',
        description:
          'If provided, toggle monitoring only for this specific season instead of the entire series',
      },
    },
    required: ['seriesId', 'monitored'],
  },
  ui: {
    category: 'TV Shows',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { seriesId, monitored, seasonNumber } = params;

    if (!seriesId || typeof seriesId !== 'number') {
      return { success: false, message: 'Series ID is required' };
    }
    if (typeof monitored !== 'boolean') {
      return { success: false, message: 'monitored must be a boolean' };
    }

    const client = ctx.getClient('sonarr');

    // Fetch the full series object
    ctx.log(`Fetching series ID ${seriesId}...`);
    let series: any;
    try {
      series = await client.get(`/api/v3/series/${seriesId}`);
    } catch {
      return {
        success: false,
        message: `No series found with ID ${seriesId}`,
      };
    }

    const title = series.title ?? 'Unknown';

    if (seasonNumber !== undefined && seasonNumber !== null) {
      // Toggle a specific season
      const season = series.seasons?.find(
        (s: any) => s.seasonNumber === seasonNumber,
      );
      if (!season) {
        return {
          success: false,
          message: `Season ${seasonNumber} not found for "${title}"`,
        };
      }

      ctx.log(
        `Setting season ${seasonNumber} of "${title}" monitored = ${monitored}`,
      );
      season.monitored = monitored;
    } else {
      // Toggle the entire series
      ctx.log(`Setting "${title}" monitored = ${monitored}`);
      series.monitored = monitored;
    }

    // PUT the updated series back
    await client.put(`/api/v3/series/${seriesId}`, series);

    const target =
      seasonNumber !== undefined && seasonNumber !== null
        ? `season ${seasonNumber} of "${title}"`
        : `"${title}"`;
    const action = monitored ? 'enabled' : 'disabled';

    return {
      success: true,
      message: `Monitoring ${action} for ${target}.`,
      data: {
        seriesId,
        title,
        monitored,
        seasonNumber: seasonNumber ?? null,
      },
    };
  },
};
