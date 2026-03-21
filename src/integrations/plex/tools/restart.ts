import type { ToolDefinition } from '../../_base';
import { config } from '../../../utils/config';

export const tool: ToolDefinition = {
  name: 'plex_restart',
  integration: 'plex',
  description:
    'Restart the Plex Media Server. Uses the Plex API restart endpoint or PLEX_RESTART_COMMAND env var if set.',
  parameters: {
    type: 'object',
    properties: {
      confirm: {
        type: 'boolean',
        description: 'Must be true to confirm the restart',
      },
    },
    required: ['confirm'],
  },
  ui: {
    category: 'System',
    dangerLevel: 'high',
    testable: false,
  },
  async handler(params, ctx) {
    if (params.confirm !== true) {
      return {
        success: false,
        message:
          'Restart not confirmed. Set confirm to true to restart Plex.',
      };
    }

    const client = ctx.getClient('plex');
    ctx.log('Restarting Plex Media Server...');

    // Use custom restart command if provided
    if (config.plexRestartCommand) {
      ctx.log(`Using custom restart command: ${config.plexRestartCommand}`);
      try {
        const proc = Bun.spawn(config.plexRestartCommand.split(' '), {
          stdout: 'pipe',
          stderr: 'pipe',
        });
        const exitCode = await proc.exited;

        if (exitCode !== 0) {
          const stderr = await new Response(proc.stderr).text();
          return {
            success: false,
            message: `Restart command failed (exit ${exitCode}): ${stderr.slice(0, 200)}`,
          };
        }
      } catch (err) {
        return {
          success: false,
          message: `Failed to execute restart command: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    } else {
      // Use the Plex API restart endpoint
      try {
        await client.put('/?restart=1');
      } catch {
        // The restart endpoint often closes the connection before responding
        ctx.log('Restart request sent (connection closed, as expected)');
      }
    }

    // Wait for the server to come back up
    ctx.log('Waiting for Plex to restart...');
    const maxWait = 120_000; // 2 minutes
    const pollInterval = 3_000;
    const startTime = Date.now();
    let isBack = false;

    // Give it a moment to actually go down
    await new Promise((resolve) => setTimeout(resolve, 5_000));

    while (Date.now() - startTime < maxWait) {
      try {
        await client.get('/identity');
        isBack = true;
        break;
      } catch {
        // Still down, keep waiting
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    if (isBack) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      return {
        success: true,
        message: `Plex Media Server restarted successfully (came back in ${elapsed}s)`,
        data: { elapsedSeconds: elapsed },
      };
    }

    return {
      success: false,
      message: `Plex did not come back within ${maxWait / 1000}s. It may still be restarting.`,
    };
  },
};
