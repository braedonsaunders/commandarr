import type { ToolDefinition } from '../../_base';

interface NtfyMessage {
  id: string;
  time: number;
  event: string;
  topic: string;
  title?: string;
  message?: string;
  priority?: number;
  tags?: string[];
}

export const tool: ToolDefinition = {
  name: 'ntfy_recent_messages',
  integration: 'ntfy',
  description:
    'Get recent messages from an ntfy topic — poll for notifications within a time window',
  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description:
          'Topic to poll. Defaults to the configured default topic if not specified.',
      },
      since: {
        type: 'string',
        description:
          'Time window to look back (e.g. "10m", "1h", "24h", "7d"). Defaults to "24h".',
      },
    },
  },
  ui: {
    category: 'Notifications',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { since: '24h' },
  },
  async handler(params, ctx) {
    const client = ctx.getClient('ntfy');
    const topic = params.topic || '{defaultTopic}';
    const since = params.since || '24h';
    ctx.log(`Polling messages from topic "${topic}" since ${since}...`);

    // ntfy returns newline-delimited JSON when using ?poll=1
    const rawResponse = await client.get(
      `/${encodeURIComponent(topic)}/json`,
      { poll: '1', since },
    );

    // Response may be a string of newline-delimited JSON or already parsed
    let messages: NtfyMessage[] = [];

    if (typeof rawResponse === 'string') {
      const lines = rawResponse.split('\n').filter((line: string) => line.trim());
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.event === 'message') {
            messages.push(msg);
          }
        } catch {
          // Skip malformed lines
        }
      }
    } else if (Array.isArray(rawResponse)) {
      messages = rawResponse.filter((m: any) => m.event === 'message');
    }

    if (messages.length === 0) {
      return {
        success: true,
        message: `No messages found on topic "${topic}" in the last ${since}`,
        data: { messages: [], topic, since },
      };
    }

    const priorityLabels: Record<number, string> = {
      1: 'min',
      2: 'low',
      3: 'default',
      4: 'high',
      5: 'urgent',
    };

    const summary = messages
      .sort((a, b) => b.time - a.time)
      .map((m) => {
        const date = new Date(m.time * 1000).toLocaleString();
        const prio = m.priority ? ` [${priorityLabels[m.priority] ?? m.priority}]` : '';
        const tags = m.tags?.length ? ` (${m.tags.join(', ')})` : '';
        const title = m.title ? `${m.title}: ` : '';
        return `- ${date}${prio}${tags} ${title}${m.message ?? ''}`;
      })
      .join('\n');

    return {
      success: true,
      message: `${messages.length} message(s) on topic "${topic}" (last ${since}):\n${summary}`,
      data: { messages, topic, since, count: messages.length },
    };
  },
};
