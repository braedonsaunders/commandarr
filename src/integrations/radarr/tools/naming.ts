import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'radarr_naming',
  integration: 'radarr',
  description:
    'View or update the movie naming and folder naming configuration in Radarr. Shows current naming format, folder format, and whether renaming is enabled.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: '"get" to view current naming config, "update" to change settings',
        enum: ['get', 'update'],
      },
      renameMovies: {
        type: 'boolean',
        description: 'Whether to rename movies on import (for "update")',
      },
      replaceIllegalCharacters: {
        type: 'boolean',
        description: 'Whether to replace illegal path characters (for "update")',
      },
      standardMovieFormat: {
        type: 'string',
        description: 'Movie file naming format string (for "update")',
      },
      movieFolderFormat: {
        type: 'string',
        description: 'Movie folder naming format string (for "update")',
      },
    },
    required: ['action'],
  },
  ui: {
    category: 'Configuration',
    dangerLevel: 'medium',
    testable: true,
    testDefaults: { action: 'get' },
  },
  async handler(params, ctx) {
    const { action } = params;
    const client = ctx.getClient('radarr');

    if (action === 'get') {
      ctx.log('Fetching Radarr naming config...');
      const config = await client.get('/api/v3/config/naming');

      return {
        success: true,
        message: [
          'Radarr Naming Configuration:',
          `Rename Movies: ${config.renameMovies ? 'Yes' : 'No'}`,
          `Replace Illegal Characters: ${config.replaceIllegalCharacters ? 'Yes' : 'No'}`,
          `Movie Format: ${config.standardMovieFormat || '(default)'}`,
          `Folder Format: ${config.movieFolderFormat || '(default)'}`,
        ].join('\n'),
        data: {
          renameMovies: config.renameMovies,
          replaceIllegalCharacters: config.replaceIllegalCharacters,
          standardMovieFormat: config.standardMovieFormat,
          movieFolderFormat: config.movieFolderFormat,
        },
      };
    }

    // Update
    ctx.log('Fetching current naming config for update...');
    const current = await client.get('/api/v3/config/naming');

    const updates: Record<string, any> = { ...current };
    if (params.renameMovies !== undefined) updates.renameMovies = params.renameMovies;
    if (params.replaceIllegalCharacters !== undefined) updates.replaceIllegalCharacters = params.replaceIllegalCharacters;
    if (params.standardMovieFormat !== undefined) updates.standardMovieFormat = params.standardMovieFormat;
    if (params.movieFolderFormat !== undefined) updates.movieFolderFormat = params.movieFolderFormat;

    ctx.log('Updating naming config...');
    const updated = await client.put('/api/v3/config/naming', updates);

    return {
      success: true,
      message: 'Naming configuration updated successfully.',
      data: {
        renameMovies: updated.renameMovies,
        replaceIllegalCharacters: updated.replaceIllegalCharacters,
        standardMovieFormat: updated.standardMovieFormat,
        movieFolderFormat: updated.movieFolderFormat,
      },
    };
  },
};
