import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'emby_play_control',
  integration: 'emby',
  description:
    'Control playback on active Emby sessions — stop, pause, or unpause. Use emby_now_playing first to get session IDs.',
  parameters: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The session ID to control. Get from emby_now_playing.',
      },
      action: {
        type: 'string',
        enum: ['stop', 'pause', 'unpause'],
        description: 'Playback action to perform',
      },
    },
    required: ['sessionId', 'action'],
  },
  ui: {
    category: 'Playback',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('emby');
    const { sessionId, action } = params;

    const endpoints: Record<string, string> = {
      stop: `/Sessions/${sessionId}/Playing/Stop`,
      pause: `/Sessions/${sessionId}/Playing/Pause`,
      unpause: `/Sessions/${sessionId}/Playing/Unpause`,
    };

    const endpoint = endpoints[action];
    if (!endpoint) {
      return { success: false, message: `Invalid action: ${action}. Use stop, pause, or unpause.` };
    }

    ctx.log(`Sending ${action} command to session ${sessionId}...`);

    try {
      await client.post(endpoint);
      return {
        success: true,
        message: `Playback ${action} command sent to session ${sessionId}.`,
        data: { sessionId, action },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to ${action} playback: ${msg}` };
    }
  },
};
