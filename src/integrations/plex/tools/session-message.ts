import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'plex_session_message',
  integration: 'plex',
  description:
    'Send a message to a connected Plex client (e.g., "Server maintenance in 5 minutes"). Use plex_now_playing to get session/player IDs.',
  parameters: {
    type: 'object',
    properties: {
      playerId: {
        type: 'string',
        description: 'The player/client machine identifier. Get from plex_now_playing.',
      },
      message: {
        type: 'string',
        description: 'The message text to display on the client',
      },
    },
    required: ['playerId', 'message'],
  },
  ui: {
    category: 'Playback',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('plex');
    const { playerId, message } = params;

    ctx.log(`Sending message to player ${playerId}...`);

    try {
      await client.get('/player/timeline/poll', {
        commandID: '1',
        type: 'text',
      });

      // Plex client messaging via sendString
      await client.post(`/player/proxy/sendString?text=${encodeURIComponent(message)}&commandID=1&X-Plex-Target-Client-Identifier=${playerId}`);

      return {
        success: true,
        message: `Message sent to player ${playerId}: "${message}"`,
        data: { playerId, message },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to send message: ${msg}` };
    }
  },
};
