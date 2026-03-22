import type { ToolDefinition } from '../../_base';

interface TautulliUser {
  username: string;
  lastSeen: string;
  totalPlays: number;
  lastPlayed: string;
  ipAddress?: string;
  platform?: string;
}

export const tool: ToolDefinition = {
  name: 'tautulli_users',
  integration: 'tautulli',
  description: 'List Plex users tracked by Tautulli with their activity stats',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Analytics',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('tautulli');
    ctx.log('Fetching Plex users...');

    const data = await client.get('get_users_table', { length: '50' });

    const records = data?.data ?? [];
    const users: TautulliUser[] = [];

    if (Array.isArray(records)) {
      for (const r of records) {
        users.push({
          username: r.friendly_name ?? r.username ?? 'Unknown',
          lastSeen: r.last_seen
            ? new Date(Number(r.last_seen) * 1000).toLocaleString()
            : 'Never',
          totalPlays: Number(r.plays ?? 0),
          lastPlayed: r.last_played ?? 'Nothing',
          ipAddress: r.ip_address ?? undefined,
          platform: r.platform ?? undefined,
        });
      }
    }

    if (users.length === 0) {
      return {
        success: true,
        message: 'No users found',
        data: { users: [] },
      };
    }

    const summary = users
      .map(
        (u) =>
          `- ${u.username}: ${u.totalPlays} plays, last seen ${u.lastSeen}, last played: ${u.lastPlayed}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${users.length} user(s):\n${summary}`,
      data: { users },
    };
  },
};
