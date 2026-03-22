import type { ToolDefinition } from '../../_base';

interface IrcNetwork {
  name: string;
  connected: boolean;
  channels: string[];
}

export const tool: ToolDefinition = {
  name: 'autobrr_status',
  integration: 'autobrr',
  description:
    'Get Autobrr system status including version info and IRC connection health',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Automation',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('autobrr');
    ctx.log('Fetching Autobrr status...');

    const [config, ircNetworks] = await Promise.all([
      client.get('/api/config'),
      client.get('/api/irc'),
    ]);

    const version = config?.version ?? 'unknown';

    const networks: IrcNetwork[] = Array.isArray(ircNetworks)
      ? ircNetworks.map((n: any) => ({
          name: n.name ?? 'Unknown',
          connected: n.connected ?? false,
          channels: Array.isArray(n.channels)
            ? n.channels.map((c: any) => c.name ?? c)
            : [],
        }))
      : [];

    const connectedCount = networks.filter((n) => n.connected).length;
    const totalCount = networks.length;

    const ircSummary =
      networks.length > 0
        ? networks
            .map(
              (n) =>
                `- ${n.name}: ${n.connected ? 'connected' : 'DISCONNECTED'}${n.channels.length > 0 ? ` (${n.channels.length} channel(s))` : ''}`,
            )
            .join('\n')
        : 'No IRC networks configured';

    return {
      success: true,
      message: `Autobrr v${version} — IRC: ${connectedCount}/${totalCount} networks connected\n${ircSummary}`,
      data: { version, networks, connectedCount, totalCount },
    };
  },
};
