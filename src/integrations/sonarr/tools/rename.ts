import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'sonarr_rename',
  integration: 'sonarr',
  description:
    'Preview or trigger a rename of episode files in Sonarr based on the current naming configuration. Shows what files would be renamed before executing.',
  parameters: {
    type: 'object',
    properties: {
      seriesId: {
        type: 'number',
        description: 'Sonarr series ID to rename files for',
      },
      seasonNumber: {
        type: 'number',
        description: 'Optional season number to limit rename to a specific season',
      },
      execute: {
        type: 'boolean',
        description: 'Set to true to actually rename the files. Defaults to false (preview only).',
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
    const { seriesId, seasonNumber, execute = false } = params;
    const client = ctx.getClient('sonarr');

    const queryParams: Record<string, string> = { seriesId: String(seriesId) };
    if (seasonNumber !== undefined) {
      queryParams.seasonNumber = String(seasonNumber);
    }

    ctx.log(`Fetching rename preview for series ${seriesId}${seasonNumber !== undefined ? ` season ${seasonNumber}` : ''}...`);
    const previews: any[] = await client.get('/api/v3/rename', queryParams);

    if (!Array.isArray(previews) || previews.length === 0) {
      return {
        success: true,
        message: 'No files need renaming.',
        data: { previews: [] },
      };
    }

    const formatted = previews.map((p: any) => ({
      episodeFileId: p.episodeFileId,
      seasonNumber: p.seasonNumber,
      episodeNumbers: p.episodeNumbers,
      existingPath: p.existingPath,
      newPath: p.newPath,
    }));

    if (!execute) {
      const lines = formatted.map(
        (p) =>
          `- S${String(p.seasonNumber).padStart(2, '0')}E${(p.episodeNumbers ?? []).map((e: number) => String(e).padStart(2, '0')).join('E')}: "${p.existingPath}"\n  → "${p.newPath}"`,
      );

      return {
        success: true,
        message: `${formatted.length} file(s) would be renamed:\n${lines.join('\n')}\n\nSet execute=true to perform the rename.`,
        data: { previews: formatted },
      };
    }

    // Execute the rename
    ctx.log('Executing rename...');
    const fileIds = formatted.map((p) => p.episodeFileId);
    await client.post('/api/v3/command', {
      name: 'RenameFiles',
      seriesId,
      files: fileIds,
    });

    return {
      success: true,
      message: `Rename triggered for ${fileIds.length} file(s).`,
      data: { previews: formatted, renamed: true },
    };
  },
};
