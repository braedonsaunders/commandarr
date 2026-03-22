import type { ToolDefinition } from '../../_base';

interface JellyfinUser {
  Name: string;
  Id: string;
  LastLoginDate?: string;
  LastActivityDate?: string;
  HasPassword: boolean;
  Policy?: {
    IsAdministrator: boolean;
    IsDisabled: boolean;
  };
}

export const tool: ToolDefinition = {
  name: 'jellyfin_users',
  integration: 'jellyfin',
  description: 'List all Jellyfin users and their last activity',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'System',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('jellyfin');
    ctx.log('Fetching Jellyfin users...');

    const users: JellyfinUser[] = await client.get('/Users');

    if (!Array.isArray(users) || users.length === 0) {
      return {
        success: true,
        message: 'No users found',
        data: { users: [] },
      };
    }

    const results = users.map((u) => ({
      name: u.Name,
      id: u.Id,
      isAdmin: u.Policy?.IsAdministrator ?? false,
      isDisabled: u.Policy?.IsDisabled ?? false,
      lastLogin: u.LastLoginDate,
      lastActivity: u.LastActivityDate,
    }));

    const summary = results
      .map(
        (u) =>
          `- ${u.name}${u.isAdmin ? ' (admin)' : ''}${u.isDisabled ? ' [disabled]' : ''} — last active: ${u.lastActivity ? new Date(u.lastActivity).toLocaleString() : 'never'}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${results.length} user(s):\n${summary}`,
      data: { users: results },
    };
  },
};
