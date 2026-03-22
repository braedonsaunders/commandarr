import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'docker_logs',
  integration: 'docker',
  description:
    'Get recent logs from a Docker container. Useful for debugging issues after updates or restarts.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Container name',
      },
      tail: {
        type: 'number',
        description: 'Number of lines from the end (default: 100)',
      },
      since: {
        type: 'string',
        description:
          'Show logs since timestamp or relative (e.g., "1h", "30m", "2024-01-01T00:00:00Z")',
      },
    },
    required: ['name'],
  },
  ui: {
    category: 'Containers',
    dangerLevel: 'low',
    testable: false,
  },
  async handler(params, ctx) {
    const { name, tail = 100, since } = params;

    if (!name || typeof name !== 'string') {
      return { success: false, message: 'Container name is required' };
    }

    const client = ctx.getClient('docker');
    ctx.log(`Fetching logs for container: ${name}`);

    const queryParams: Record<string, string> = {
      stdout: 'true',
      stderr: 'true',
      tail: String(tail),
    };

    if (since) {
      // Handle relative time strings like "1h", "30m"
      const relativeMatch = since.match(/^(\d+)([smhd])$/);
      if (relativeMatch) {
        const amount = parseInt(relativeMatch[1], 10);
        const unit = relativeMatch[2];
        const multipliers: Record<string, number> = {
          s: 1,
          m: 60,
          h: 3600,
          d: 86400,
        };
        const sinceEpoch =
          Math.floor(Date.now() / 1000) - amount * (multipliers[unit] ?? 1);
        queryParams.since = String(sinceEpoch);
      } else {
        // Assume ISO timestamp
        queryParams.since = String(
          Math.floor(new Date(since).getTime() / 1000),
        );
      }
    }

    try {
      const logs = await client.get(
        `/containers/${name}/logs`,
        queryParams,
      );

      // Docker log stream includes 8-byte header per line in multiplexed mode
      // The text response may include these binary headers — clean them
      const cleanedLogs =
        typeof logs === 'string'
          ? logs
              .split('\n')
              .map((line: string) => {
                // Strip Docker stream headers (first 8 bytes if present)
                if (line.length > 8 && line.charCodeAt(0) <= 2) {
                  return line.slice(8);
                }
                return line;
              })
              .filter((line: string) => line.trim().length > 0)
              .join('\n')
          : String(logs);

      const lines = cleanedLogs.split('\n');
      const errorLines = lines.filter(
        (l: string) =>
          /error|fatal|panic|exception|critical/i.test(l) &&
          !/no error/i.test(l),
      );

      return {
        success: true,
        message: `Last ${Math.min(lines.length, tail)} log lines for "${name}"${errorLines.length > 0 ? ` (${errorLines.length} error(s) detected)` : ''}:\n\n${cleanedLogs}`,
        data: {
          name,
          lineCount: lines.length,
          errorCount: errorLines.length,
          logs: cleanedLogs,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Failed to get logs for "${name}": ${msg}`,
      };
    }
  },
};
