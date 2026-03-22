import type { ToolDefinition } from '../../_base';

interface SeerrUser {
  id: number;
  displayName: string;
  email?: string;
  requestCount: number;
  permissions: number;
  createdAt: string;
}

function permissionLabels(permissions: number): string[] {
  const labels: string[] = [];
  if (permissions & 2) labels.push('Admin');
  if (permissions & 8) labels.push('Request');
  if (permissions & 16) labels.push('Vote');
  if (permissions & 32) labels.push('Auto-Approve');
  if (permissions & 64) labels.push('Auto-Approve Movies');
  if (permissions & 128) labels.push('Auto-Approve TV');
  if (labels.length === 0) labels.push('None');
  return labels;
}

export const tool: ToolDefinition = {
  name: 'seerr_users',
  integration: 'seerr',
  description: 'List users in Seerr (Overseerr/Jellyseerr)',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Users',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('seerr');
    ctx.log('Fetching Seerr users...');

    const response = await client.get('/api/v1/user', {
      take: '50',
    });

    const results: SeerrUser[] = response.results ?? response ?? [];

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: 'No users found.',
        data: { users: [] },
      };
    }

    const users = results.map((u) => ({
      id: u.id,
      username: u.displayName,
      email: u.email ?? 'N/A',
      requestCount: u.requestCount ?? 0,
      permissions: permissionLabels(u.permissions ?? 0),
    }));

    const summary = users
      .map(
        (u) =>
          `- ${u.username} (${u.email}) - ${u.requestCount} request(s), permissions: ${u.permissions.join(', ')}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${users.length} user(s):\n${summary}`,
      data: { users },
    };
  },
};
