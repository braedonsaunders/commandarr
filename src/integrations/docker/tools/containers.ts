import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'docker_containers',
  integration: 'docker',
  description:
    'List all Docker containers with status, image, health, and uptime',
  parameters: {
    type: 'object',
    properties: {
      all: {
        type: 'boolean',
        description:
          'Include stopped containers (default: true)',
      },
      filter: {
        type: 'string',
        description:
          'Filter by name substring (case-insensitive)',
      },
    },
  },
  ui: {
    category: 'Containers',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('docker');
    const showAll = params.all !== false;
    ctx.log('Listing Docker containers...');

    const containers = await client.get('/containers/json', {
      all: showAll ? 'true' : 'false',
    });

    if (!Array.isArray(containers) || containers.length === 0) {
      return {
        success: true,
        message: 'No containers found',
        data: { containers: [] },
      };
    }

    let filtered = containers;
    if (params.filter && typeof params.filter === 'string') {
      const f = params.filter.toLowerCase();
      filtered = containers.filter((c: any) => {
        const names = (c.Names ?? []).join(' ').toLowerCase();
        const image = (c.Image ?? '').toLowerCase();
        return names.includes(f) || image.includes(f);
      });
    }

    const result = filtered.map((c: any) => {
      const name =
        (c.Names?.[0] ?? '').replace(/^\//, '') || c.Id?.slice(0, 12);
      const state = c.State ?? 'unknown';
      const status = c.Status ?? 'unknown';
      const image = c.Image ?? 'unknown';
      const health = c.State === 'running'
        ? (c.Status?.includes('healthy')
            ? 'healthy'
            : c.Status?.includes('unhealthy')
              ? 'unhealthy'
              : 'no healthcheck')
        : state;
      const created = c.Created
        ? new Date(c.Created * 1000).toISOString()
        : 'unknown';

      return {
        id: c.Id?.slice(0, 12),
        name,
        image,
        state,
        status,
        health,
        created,
        ports: (c.Ports ?? [])
          .filter((p: any) => p.PublicPort)
          .map((p: any) => `${p.PublicPort}:${p.PrivatePort}/${p.Type}`)
          .join(', ') || 'none',
      };
    });

    const summary = result
      .map(
        (c: any) =>
          `- ${c.name}: ${c.state} (${c.image}) [${c.health}] ${c.status}`,
      )
      .join('\n');

    const running = result.filter((c: any) => c.state === 'running').length;
    const stopped = result.length - running;

    return {
      success: true,
      message: `${result.length} container(s) (${running} running, ${stopped} stopped):\n${summary}`,
      data: { containers: result, running, stopped, total: result.length },
    };
  },
};
