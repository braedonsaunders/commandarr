import type { ToolDefinition } from '../../_base';

interface GotifyApp {
  id: number;
  name: string;
  description: string;
  token: string;
  image: string;
  internal: boolean;
}

export const tool: ToolDefinition = {
  name: 'gotify_applications',
  integration: 'gotify',
  description:
    'List Gotify applications — view app names, descriptions, and message counts',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Notifications',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('gotify');
    ctx.log('Fetching Gotify applications...');

    const data = await client.get('/application');

    const apps: GotifyApp[] = Array.isArray(data) ? data : data?.applications ?? [];

    if (apps.length === 0) {
      return {
        success: true,
        message: 'No applications configured in Gotify',
        data: { applications: [], count: 0 },
      };
    }

    const summary = apps
      .map((app) => {
        const token = app.token
          ? `${app.token.slice(0, 4)}${'*'.repeat(Math.max(0, app.token.length - 4))}`
          : 'N/A';
        const desc = app.description ? ` — ${app.description}` : '';
        const internal = app.internal ? ' [internal]' : '';
        return `- ${app.name}${internal}${desc} (token: ${token})`;
      })
      .join('\n');

    return {
      success: true,
      message: `${apps.length} application(s):\n${summary}`,
      data: { applications: apps, count: apps.length },
    };
  },
};
