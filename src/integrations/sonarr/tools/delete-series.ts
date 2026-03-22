import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'sonarr_delete_series',
  integration: 'sonarr',
  description:
    'Delete a series from Sonarr, optionally deleting files from disk and adding an import list exclusion.',
  parameters: {
    type: 'object',
    properties: {
      seriesId: {
        type: 'number',
        description: 'Sonarr series ID to delete',
      },
      deleteFiles: {
        type: 'boolean',
        description:
          'Also delete downloaded files from disk (default: false)',
      },
      addExclusion: {
        type: 'boolean',
        description:
          'Add series to import list exclusion to prevent re-adding (default: false)',
      },
    },
    required: ['seriesId'],
  },
  ui: {
    category: 'TV Shows',
    dangerLevel: 'high',
    testable: false,
  },
  async handler(params, ctx) {
    const { seriesId, deleteFiles = false, addExclusion = false } = params;
    if (!seriesId || typeof seriesId !== 'number') {
      return { success: false, message: 'Series ID is required' };
    }

    const client = ctx.getClient('sonarr');

    // Fetch series info first so we can report what was deleted
    ctx.log(`Fetching series info for ID ${seriesId}...`);
    let seriesInfo: Record<string, unknown>;
    try {
      seriesInfo = await client.get(`/api/v3/series/${seriesId}`);
    } catch {
      return {
        success: false,
        message: `Series with ID ${seriesId} not found in Sonarr`,
      };
    }

    const title = (seriesInfo.title as string) ?? 'Unknown';
    const year = (seriesInfo.year as number) ?? '';

    ctx.log(
      `Deleting "${title}" (${year}) — deleteFiles: ${deleteFiles}, addExclusion: ${addExclusion}`,
    );

    await client.delete(
      `/api/v3/series/${seriesId}?deleteFiles=${deleteFiles}&addImportListExclusion=${addExclusion}`,
    );

    const parts: string[] = [`Deleted "${title}" (${year}) from Sonarr`];
    if (deleteFiles) {
      parts.push('files were also removed from disk');
    }
    if (addExclusion) {
      parts.push('added to import list exclusion');
    }

    return {
      success: true,
      message: parts.join('. ') + '.',
      data: {
        seriesId,
        title,
        year,
        deleteFiles,
        addExclusion,
      },
    };
  },
};
