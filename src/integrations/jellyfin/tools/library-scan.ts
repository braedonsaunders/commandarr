import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'jellyfin_library_scan',
  integration: 'jellyfin',
  description:
    'Trigger a Jellyfin library scan. Scans all libraries by default, or a specific library if libraryId is provided.',
  parameters: {
    type: 'object',
    properties: {
      libraryId: {
        type: 'string',
        description:
          'Optional library ID to scan. If omitted, all libraries are scanned. Use jellyfin_libraries to find IDs.',
      },
    },
  },
  ui: {
    category: 'Library',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('jellyfin');
    const { libraryId } = params;

    if (libraryId) {
      ctx.log(`Triggering library scan for library ${libraryId}...`);
      try {
        await client.post(`/Items/${libraryId}/Refresh`);
        return {
          success: true,
          message: `Library scan triggered for library ${libraryId}.`,
          data: { libraryId, scope: 'single' },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, message: `Failed to trigger library scan: ${msg}` };
      }
    }

    ctx.log('Triggering full library scan...');
    try {
      await client.post('/Library/Refresh');
      return {
        success: true,
        message: 'Full library scan triggered for all libraries.',
        data: { scope: 'all' },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to trigger library scan: ${msg}` };
    }
  },
};
