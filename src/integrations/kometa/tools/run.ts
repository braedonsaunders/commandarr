import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'kometa_run',
  integration: 'kometa',
  description: 'Trigger a full Kometa run across all configured libraries. This will update collections, overlays, and metadata in Plex.',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Actions',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('kometa');
    ctx.log('Triggering full Kometa run...');

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

    const result = await client.post('/api/v1/run');

    const message = result?.message ?? 'Full Kometa run has been triggered';

    return {
      success: true,
      message: `${message}. Kometa will process all configured libraries, updating collections, overlays, and metadata. Use kometa_status to monitor progress.`,
      data: { triggered: true },
    };
  },
};
