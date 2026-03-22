import type { ToolDefinition } from '../../_base';
import { config } from '../../../utils/config';
import { logger } from '../../../utils/logger';

export const tool: ToolDefinition = {
  name: 'plex_restart',
  integration: 'plex',
  description:
    'Restart the Plex Media Server. Tries multiple methods in order: Plex API restart, Commandarr Helper (host-level restart), custom command. Always ask the user to confirm before restarting.',
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
        message: 'Restart not confirmed. Set confirm to true to restart Plex.',
      };
    }

    const client = ctx.getClient('plex');
    ctx.log('Attempting Plex restart...');

    const methods: string[] = [];

    // ── Method 1: Plex API restart ──────────────────────────────────
    try {
      ctx.log('Trying Plex API restart...');
      await client.put('/?restart=1');
      methods.push('Plex API');
      ctx.log('Plex API restart request sent');
    } catch {
      ctx.log('Plex API restart request sent (connection closed, expected)');
      methods.push('Plex API');
    }

    // Quick check — did the API restart work?
    await new Promise(r => setTimeout(r, 8000));
    try {
      await client.get('/identity');
      return {
        success: true,
        message: 'Plex restarted via API and is back online.',
        data: { method: 'plex_api' },
      };
    } catch {
      ctx.log('Plex not responding after API restart, trying other methods...');
    }

    // ── Method 2: Commandarr Helper (host-level restart) ────────────
    const helperUrl = config.helperUrl;
    if (helperUrl) {
      try {
        ctx.log(`Trying Commandarr Helper at ${helperUrl}...`);
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (config.helperToken) {
          headers['Authorization'] = `Bearer ${config.helperToken}`;
        }

        const res = await fetch(`${helperUrl}/restart-plex`, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(35000),
        });
        const data = await res.json() as { success: boolean; message: string };

        if (data.success) {
          methods.push('Helper');
          ctx.log(`Helper restart succeeded: ${data.message}`);
        } else {
          ctx.log(`Helper restart reported failure: ${data.message}`);
        }
      } catch (e) {
        ctx.log(`Helper restart failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ── Method 3: Custom command (legacy) ───────────────────────────
    if (config.plexRestartCommand) {
      try {
        ctx.log(`Running custom command: ${config.plexRestartCommand}`);
        const proc = Bun.spawn(config.plexRestartCommand.split(' '), {
          stdout: 'pipe',
          stderr: 'pipe',
        });
        await proc.exited;
        methods.push('Custom command');
      } catch (e) {
        ctx.log(`Custom command failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ── Wait for Plex to come back ──────────────────────────────────
    ctx.log('Waiting for Plex to come back online...');
    const maxWait = 120_000;
    const pollInterval = 3_000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      try {
        await client.get('/identity');
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        return {
          success: true,
          message: `Plex restarted successfully and is back online (took ${elapsed}s). Methods tried: ${methods.join(', ')}.`,
          data: { method: methods.join('+'), elapsedSeconds: elapsed },
        };
      } catch {
        // Still down
      }
      await new Promise(r => setTimeout(r, pollInterval));
    }

    return {
      success: false,
      message: `Plex did not come back within 2 minutes. Methods tried: ${methods.join(', ')}. Manual intervention may be needed.`,
      data: { methods },
    };
  },
};
