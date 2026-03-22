import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'kometa_library_run',
  integration: 'kometa',
  description: 'Trigger a Kometa run for a specific library only. Faster than a full run when you only need to update one library.',
  parameters: {
    type: 'object',
    properties: {
      library: {
        type: 'string',
        description: 'Name of the Plex library to run Kometa against (e.g., "Movies", "TV Shows")',
      },
    },
    required: ['library'],
  },
  ui: {
    category: 'Actions',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { library } = params;
    if (!library || typeof library !== 'string') {
      return { success: false, message: 'Library name is required' };
    }

    const client = ctx.getClient('kometa');
    ctx.log(`Triggering Kometa run for library: ${library}...`);

    // Check if already running
    const status = await client.get('/api/v1/status');
    const running = status.running ?? false;

    if (running) {
      const currentLibrary = status.current_library ?? status.currentLibrary ?? 'unknown library';
      return {
        success: false,
        message: `Kometa is already running (currently processing: ${currentLibrary}). Wait for the current run to complete before starting a new one.`,
        data: { alreadyRunning: true, currentLibrary },
      };
    }

    const encodedLibrary = encodeURIComponent(library);
    const result = await client.post(`/api/v1/run/library/${encodedLibrary}`);

    const message = result?.message ?? `Kometa run triggered for library "${library}"`;

    return {
      success: true,
      message: `${message}. Kometa will process collections, overlays, and metadata for the "${library}" library. Use kometa_status to monitor progress.`,
      data: { triggered: true, library },
    };
  },
};
