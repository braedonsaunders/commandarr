import type { ToolDefinition } from '../../_base';

interface GotifyMessage {
  id: number;
  appid: number;
  title: string;
  message: string;
  priority: number;
  date: string;
}

export const tool: ToolDefinition = {
  name: 'gotify_messages',
  integration: 'gotify',
  description:
    'Get recent messages from Gotify — view notifications with title, content, priority, and date',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of messages to return (default: 20)',
      },
    },
  },
  ui: {
    category: 'Notifications',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { limit: 10 },
  },
  async handler(params, ctx) {
    const client = ctx.getClient('gotify');
    const limit = String(params.limit ?? 20);
    ctx.log(`Fetching last ${limit} messages from Gotify...`);

    const data = await client.get('/message', { limit });

    const messages: GotifyMessage[] = data?.messages ?? (Array.isArray(data) ? data : []);

    if (messages.length === 0) {
      return {
        success: true,
        message: 'No messages found in Gotify',
        data: { messages: [], count: 0 },
      };
    }

    const priorityLabels: Record<number, string> = {
      0: 'none',
      1: 'min',
      2: 'low',
      3: 'low',
      4: 'normal',
      5: 'normal',
      6: 'high',
      7: 'high',
      8: 'critical',
      9: 'critical',
      10: 'max',
    };

    const summary = messages
      .map((m) => {
        const date = new Date(m.date).toLocaleString();
        const prio = priorityLabels[m.priority] ?? String(m.priority);
        const title = m.title ? `${m.title}: ` : '';
        return `- [${prio}] ${date} — ${title}${m.message}`;
      })
      .join('\n');

    return {
      success: true,
      message: `${messages.length} message(s):\n${summary}`,
      data: { messages, count: messages.length },
    };
  },
};
