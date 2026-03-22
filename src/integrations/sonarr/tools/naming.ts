import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'sonarr_naming',
  integration: 'sonarr',
  description:
    'View or update the episode naming and folder naming configuration in Sonarr. Shows current naming format, season/series folder format, and whether renaming is enabled.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: '"get" to view current naming config, "update" to change settings',
        enum: ['get', 'update'],
      },
      renameEpisodes: {
        type: 'boolean',
        description: 'Whether to rename episodes on import (for "update")',
      },
      replaceIllegalCharacters: {
        type: 'boolean',
        description: 'Whether to replace illegal path characters (for "update")',
      },
      standardEpisodeFormat: {
        type: 'string',
        description: 'Standard episode naming format string (for "update")',
      },
      dailyEpisodeFormat: {
        type: 'string',
        description: 'Daily episode naming format string (for "update")',
      },
      animeEpisodeFormat: {
        type: 'string',
        description: 'Anime episode naming format string (for "update")',
      },
      seriesFolderFormat: {
        type: 'string',
        description: 'Series folder naming format string (for "update")',
      },
      seasonFolderFormat: {
        type: 'string',
        description: 'Season folder naming format string (for "update")',
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
    const client = ctx.getClient('sonarr');

    if (action === 'get') {
      ctx.log('Fetching Sonarr naming config...');
      const config = await client.get('/api/v3/config/naming');

      return {
        success: true,
        message: [
          'Sonarr Naming Configuration:',
          `Rename Episodes: ${config.renameEpisodes ? 'Yes' : 'No'}`,
          `Replace Illegal Characters: ${config.replaceIllegalCharacters ? 'Yes' : 'No'}`,
          `Standard Format: ${config.standardEpisodeFormat || '(default)'}`,
          `Daily Format: ${config.dailyEpisodeFormat || '(default)'}`,
          `Anime Format: ${config.animeEpisodeFormat || '(default)'}`,
          `Series Folder: ${config.seriesFolderFormat || '(default)'}`,
          `Season Folder: ${config.seasonFolderFormat || '(default)'}`,
        ].join('\n'),
        data: {
          renameEpisodes: config.renameEpisodes,
          replaceIllegalCharacters: config.replaceIllegalCharacters,
          standardEpisodeFormat: config.standardEpisodeFormat,
          dailyEpisodeFormat: config.dailyEpisodeFormat,
          animeEpisodeFormat: config.animeEpisodeFormat,
          seriesFolderFormat: config.seriesFolderFormat,
          seasonFolderFormat: config.seasonFolderFormat,
        },
      };
    }

    // Update
    ctx.log('Fetching current naming config for update...');
    const current = await client.get('/api/v3/config/naming');

    const updates: Record<string, any> = { ...current };
    if (params.renameEpisodes !== undefined) updates.renameEpisodes = params.renameEpisodes;
    if (params.replaceIllegalCharacters !== undefined) updates.replaceIllegalCharacters = params.replaceIllegalCharacters;
    if (params.standardEpisodeFormat !== undefined) updates.standardEpisodeFormat = params.standardEpisodeFormat;
    if (params.dailyEpisodeFormat !== undefined) updates.dailyEpisodeFormat = params.dailyEpisodeFormat;
    if (params.animeEpisodeFormat !== undefined) updates.animeEpisodeFormat = params.animeEpisodeFormat;
    if (params.seriesFolderFormat !== undefined) updates.seriesFolderFormat = params.seriesFolderFormat;
    if (params.seasonFolderFormat !== undefined) updates.seasonFolderFormat = params.seasonFolderFormat;

    ctx.log('Updating naming config...');
    const updated = await client.put('/api/v3/config/naming', updates);

    return {
      success: true,
      message: 'Naming configuration updated successfully.',
      data: {
        renameEpisodes: updated.renameEpisodes,
        replaceIllegalCharacters: updated.replaceIllegalCharacters,
        standardEpisodeFormat: updated.standardEpisodeFormat,
        dailyEpisodeFormat: updated.dailyEpisodeFormat,
        animeEpisodeFormat: updated.animeEpisodeFormat,
        seriesFolderFormat: updated.seriesFolderFormat,
        seasonFolderFormat: updated.seasonFolderFormat,
      },
    };
  },
};
