import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'plex_play_control',
  integration: 'plex',
  description:
    'Control playback on active Plex sessions — stop a stream. Use plex_now_playing first to see active sessions and find session keys.',
  parameters: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The session ID/key to stop. Get from plex_now_playing.',
      },
      reason: {
        type: 'string',
        description: 'Optional reason for stopping playback (logged for context)',
      },
    },
    required: ['sessionId'],
  },
  ui: {
    category: 'Playback',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('plex');
    const { sessionId, reason } = params;

    ctx.log(`Stopping session ${sessionId}${reason ? ` — reason: ${reason}` : ''}...`);

    try {
      await client.get('/status/sessions/terminate', {
        sessionId,
        reason: reason ?? 'Stopped by Commandarr',
      });

      return {
        success: true,
        message: `Playback stopped for session ${sessionId}.${reason ? ` Reason: ${reason}` : ''}`,
        data: { sessionId, reason },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to stop playback: ${msg}` };
    }
  },
};
