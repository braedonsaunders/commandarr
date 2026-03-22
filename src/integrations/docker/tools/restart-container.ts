import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'docker_restart_container',
  integration: 'docker',
  description:
    'Restart a Docker container. Optionally restart dependent containers as well.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Container name to restart',
      },
      timeout: {
        type: 'number',
        description: 'Seconds to wait before killing the container (default: 30)',
      },
    },
    required: ['name'],
  },
  ui: {
    category: 'Containers',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { name, timeout = 30 } = params;

    if (!name || typeof name !== 'string') {
      return { success: false, message: 'Container name is required' };
    }

    const client = ctx.getClient('docker');
    ctx.log(`Restarting container: ${name}`);

    try {
      await client.post(`/containers/${name}/restart?t=${timeout}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Failed to restart "${name}": ${msg}`,
      };
    }

    // Wait for container to be running
    await new Promise((resolve) => setTimeout(resolve, 3000));

    let state = 'unknown';
    let health = 'unknown';
    try {
      const inspect = await client.get(`/containers/${name}/json`);
      state = inspect.State?.Running ? 'running' : 'stopped';
      health = inspect.State?.Health?.Status ?? 'no healthcheck';
    } catch {
      // Best effort
    }

    return {
      success: true,
      message: `Restarted "${name}". Status: ${state}, health: ${health}.`,
      data: { name, state, health },
    };
  },
};
