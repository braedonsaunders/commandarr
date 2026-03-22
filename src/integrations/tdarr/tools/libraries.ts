import type { ToolDefinition } from '../../_base';

interface LibraryInfo {
  id: string;
  name: string;
  folder: string;
  fileCount: number;
  transcodeStatus: string;
  healthCheckStatus: string;
  priority: number;
  folderWatch: boolean;
}

export const tool: ToolDefinition = {
  name: 'tdarr_libraries',
  integration: 'tdarr',
  description:
    'List configured Tdarr libraries with their scan status, file counts, and processing priorities',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Transcoding',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('tdarr');
    ctx.log('Fetching Tdarr libraries...');

    const settingsRes = await client.post('/api/v2/cruddb', {
      data: { collection: 'SettingsJSONDB', mode: 'getAll' },
    });

    if (!settingsRes || typeof settingsRes !== 'object') {
      return {
        success: true,
        message: 'No libraries configured',
        data: { libraries: [] },
      };
    }

    const libraries: LibraryInfo[] = [];

    // Settings may contain a libraries array or individual library entries
    const settingsEntries = Object.values(settingsRes) as any[];

    for (const entry of settingsEntries) {
      // Handle the case where libraries are nested in settings
      const libs = entry.libraries ?? entry.Libraries ?? [];
      if (Array.isArray(libs)) {
        for (const lib of libs) {
          libraries.push({
            id: lib._id ?? lib.id ?? 'unknown',
            name: lib.name ?? lib.folder?.split('/').pop() ?? 'Unknown Library',
            folder: lib.folder ?? lib.source ?? 'unknown',
            fileCount: lib.totalFileCount ?? lib.fileCount ?? 0,
            transcodeStatus: lib.transcodeStatus ?? (lib.transcodeEnabled ? 'enabled' : 'disabled'),
            healthCheckStatus: lib.healthCheckStatus ?? (lib.healthCheckEnabled ? 'enabled' : 'disabled'),
            priority: lib.priority ?? 0,
            folderWatch: lib.folderWatch ?? lib.watchFolder ?? false,
          });
        }
      }

      // Handle direct library-like entries
      if (entry.folder || entry.source) {
        libraries.push({
          id: entry._id ?? 'unknown',
          name: entry.name ?? entry.folder?.split('/').pop() ?? 'Unknown Library',
          folder: entry.folder ?? entry.source ?? 'unknown',
          fileCount: entry.totalFileCount ?? entry.fileCount ?? 0,
          transcodeStatus: entry.transcodeStatus ?? 'unknown',
          healthCheckStatus: entry.healthCheckStatus ?? 'unknown',
          priority: entry.priority ?? 0,
          folderWatch: entry.folderWatch ?? false,
        });
      }
    }

    if (libraries.length === 0) {
      return {
        success: true,
        message: 'No libraries found in Tdarr settings',
        data: { libraries: [] },
      };
    }

    const totalFiles = libraries.reduce((sum, l) => sum + l.fileCount, 0);

    const lines: string[] = [
      `${libraries.length} library/libraries configured (${totalFiles.toLocaleString()} total files):`,
    ];

    for (const lib of libraries.sort((a, b) => a.priority - b.priority)) {
      lines.push(
        `- ${lib.name} [Priority: ${lib.priority}]`,
      );
      lines.push(
        `  Folder: ${lib.folder}`,
      );
      lines.push(
        `  Files: ${lib.fileCount.toLocaleString()} | Transcode: ${lib.transcodeStatus} | Health check: ${lib.healthCheckStatus}${lib.folderWatch ? ' | Folder watch: ON' : ''}`,
      );
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: { libraries },
    };
  },
};
