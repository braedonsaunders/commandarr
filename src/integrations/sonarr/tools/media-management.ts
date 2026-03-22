import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'sonarr_media_management',
  integration: 'sonarr',
  description:
    'View or update Sonarr media management settings. Controls file handling, permissions, recycling bin, importing behavior, and more.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: '"get" to view current settings, "update" to change settings',
        enum: ['get', 'update'],
      },
      recycleBin: {
        type: 'string',
        description: 'Path to recycling bin folder (for "update")',
      },
      recycleBinCleanupDays: {
        type: 'number',
        description: 'Days before recycling bin is cleaned up (for "update")',
      },
      autoUnmonitorPreviouslyDownloadedEpisodes: {
        type: 'boolean',
        description: 'Automatically unmonitor episodes after download (for "update")',
      },
      minimumFreeSpaceWhenImporting: {
        type: 'number',
        description: 'Minimum free space in MB when importing (for "update")',
      },
      copyUsingHardlinks: {
        type: 'boolean',
        description: 'Use hardlinks instead of copy when possible (for "update")',
      },
      importExtraFiles: {
        type: 'boolean',
        description: 'Import extra files (subtitles, etc) (for "update")',
      },
      extraFileExtensions: {
        type: 'string',
        description: 'Extra file extensions to import, e.g. "srt,nfo" (for "update")',
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
      ctx.log('Fetching Sonarr media management config...');
      const config = await client.get('/api/v3/config/mediamanagement');

      return {
        success: true,
        message: [
          'Sonarr Media Management Settings:',
          `Recycle Bin: ${config.recycleBin || '(not set)'}`,
          `Recycle Bin Cleanup: ${config.recycleBinCleanupDays} days`,
          `Auto Unmonitor Downloaded: ${config.autoUnmonitorPreviouslyDownloadedEpisodes ? 'Yes' : 'No'}`,
          `Min Free Space on Import: ${config.minimumFreeSpaceWhenImporting} MB`,
          `Use Hardlinks: ${config.copyUsingHardlinks ? 'Yes' : 'No'}`,
          `Import Extra Files: ${config.importExtraFiles ? 'Yes' : 'No'}`,
          `Extra Extensions: ${config.extraFileExtensions || '(none)'}`,
          `File Date: ${config.fileDate}`,
          `Download Propers: ${config.downloadPropersAndRepacks}`,
          `Create Empty Folders: ${config.createEmptySeriesFolders ? 'Yes' : 'No'}`,
          `Delete Empty Folders: ${config.deleteEmptyFolders ? 'Yes' : 'No'}`,
          `Episode Title Required: ${config.episodeTitleRequired}`,
          `Chmod Folder: ${config.chmodFolder || '(not set)'}`,
          `Chown Group: ${config.chownGroup || '(not set)'}`,
        ].join('\n'),
        data: config,
      };
    }

    // Update
    ctx.log('Fetching current media management config...');
    const current = await client.get('/api/v3/config/mediamanagement');

    const updates: Record<string, any> = { ...current };
    for (const key of [
      'recycleBin', 'recycleBinCleanupDays', 'autoUnmonitorPreviouslyDownloadedEpisodes',
      'minimumFreeSpaceWhenImporting', 'copyUsingHardlinks', 'importExtraFiles', 'extraFileExtensions',
    ]) {
      if ((params as any)[key] !== undefined) {
        updates[key] = (params as any)[key];
      }
    }

    ctx.log('Updating media management config...');
    const updated = await client.put('/api/v3/config/mediamanagement', updates);

    return {
      success: true,
      message: 'Media management settings updated successfully.',
      data: updated,
    };
  },
};
