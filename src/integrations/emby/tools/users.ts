import type { ToolDefinition } from '../../_base';

interface EmbyUser {
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
  name: 'emby_users',
  integration: 'emby',
  description: 'List all Emby users and their last activity',
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
    const client = ctx.getClient('emby');
    ctx.log('Fetching Emby users...');

    const users: EmbyUser[] = await client.get('/Users');

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
