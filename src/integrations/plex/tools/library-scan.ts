import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'plex_library_scan',
  integration: 'plex',
  description:
    'Trigger a Plex library scan. Scans all libraries by default, or a specific library if libraryKey is provided. Use plex_libraries to find library keys.',
  parameters: {
    type: 'object',
    properties: {
      libraryKey: {
        type: 'string',
        description:
          'Optional library key to scan (e.g., "1", "2"). If omitted, all libraries are scanned. Use plex_libraries to find keys.',
      },
    },
  },
  ui: {
    category: 'Libraries',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('plex');
    const { libraryKey } = params;

    if (libraryKey) {
      ctx.log(`Triggering library scan for section ${libraryKey}...`);
      try {
        await client.get(`/library/sections/${libraryKey}/refresh`);
        return {
          success: true,
          message: `Library scan triggered for section ${libraryKey}.`,
          data: { libraryKey, scope: 'single' },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, message: `Failed to trigger library scan: ${msg}` };
      }
    }

    // Scan all libraries by fetching sections first
    ctx.log('Fetching libraries to scan all...');
    let sectionKeys: string[] = [];

    try {
      const response = await client.get('/library/sections');
      if (response.MediaContainer) {
        const dirs = response.MediaContainer.Directory ?? [];
        const items = Array.isArray(dirs) ? dirs : [dirs];
        sectionKeys = items.map((d: any) => d.key).filter(Boolean);
      } else if (response._xml) {
        const keyMatches = (response._xml as string).matchAll(/key="(\d+)"/g);
        for (const m of keyMatches) {
          sectionKeys.push(m[1]!);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to fetch libraries: ${msg}` };
    }

    if (sectionKeys.length === 0) {
      return { success: false, message: 'No libraries found to scan.' };
    }

    ctx.log(`Triggering scan for ${sectionKeys.length} libraries...`);
    for (const key of sectionKeys) {
      try {
        await client.get(`/library/sections/${key}/refresh`);
      } catch {
        ctx.log(`Warning: failed to trigger scan for section ${key}`);
      }
    }

    return {
      success: true,
      message: `Library scan triggered for ${sectionKeys.length} libraries.`,
      data: { scope: 'all', libraryKeys: sectionKeys },
    };
  },
};
