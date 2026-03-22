import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'radarr_rename',
  integration: 'radarr',
  description:
    'Preview or trigger a rename of movie files in Radarr based on the current naming configuration. Shows what files would be renamed before executing.',
  parameters: {
    type: 'object',
    properties: {
      movieId: {
        type: 'number',
        description: 'Radarr movie ID to rename files for',
      },
      execute: {
        type: 'boolean',
        description: 'Set to true to actually rename the files. Defaults to false (preview only).',
      },
    },
    required: ['movieId'],
  },
  ui: {
    category: 'Movies',
    dangerLevel: 'high',
    testable: false,
  },
  async handler(params, ctx) {
    const { movieId, execute = false } = params;
    const client = ctx.getClient('radarr');

    ctx.log(`Fetching rename preview for movie ${movieId}...`);
    const previews: any[] = await client.get('/api/v3/rename', {
      movieId: String(movieId),
    });

    if (!Array.isArray(previews) || previews.length === 0) {
      return {
        success: true,
        message: 'No files need renaming for this movie.',
        data: { previews: [] },
      };
    }

    const formatted = previews.map((p: any) => ({
      movieFileId: p.movieFileId,
      existingPath: p.existingPath,
      newPath: p.newPath,
    }));

    if (!execute) {
      const lines = formatted.map(
        (p) => `- "${p.existingPath}"\n  → "${p.newPath}"`,
      );

      return {
        success: true,
        message: `${formatted.length} file(s) would be renamed:\n${lines.join('\n')}\n\nSet execute=true to perform the rename.`,
        data: { previews: formatted },
      };
    }

    // Execute the rename
    ctx.log('Executing rename...');
    const fileIds = formatted.map((p) => p.movieFileId);
    await client.post('/api/v3/command', {
      name: 'RenameFiles',
      movieId,
      files: fileIds,
    });

    return {
      success: true,
      message: `Rename triggered for ${fileIds.length} file(s).`,
      data: { previews: formatted, renamed: true },
    };
  },
};
