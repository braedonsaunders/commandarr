import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'jellyfin_session_message',
  integration: 'jellyfin',
  description:
    'Send a message to a connected Jellyfin client device (e.g., "Server restarting in 5 minutes"). Use jellyfin_now_playing to get session IDs.',
  parameters: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The session ID to send the message to',
      },
      header: {
        type: 'string',
        description: 'Message header/title',
      },
      text: {
        type: 'string',
        description: 'Message body text',
      },
      timeoutMs: {
        type: 'number',
        description: 'How long the message should display in milliseconds (default: 5000)',
      },
    },
    required: ['sessionId', 'header', 'text'],
  },
  ui: {
    category: 'Playback',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('jellyfin');
    const { sessionId, header, text, timeoutMs = 5000 } = params;

    ctx.log(`Sending message to session ${sessionId}...`);

    try {
      await client.post(`/Sessions/${sessionId}/Message`, {
        Header: header,
        Text: text,
        TimeoutMs: timeoutMs,
      });

      return {
        success: true,
        message: `Message sent to session ${sessionId}: "${header}"`,
        data: { sessionId, header, text, timeoutMs },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to send message: ${msg}` };
    }
  },
};
