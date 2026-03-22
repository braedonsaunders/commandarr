import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'kometa_status',
  integration: 'kometa',
  description: 'Get current Kometa run status including whether a run is active, last run time, next scheduled run, and any errors from the last run',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Status',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('kometa');
    ctx.log('Fetching Kometa status...');

    const status = await client.get('/api/v1/status');

    const running = status.running ?? false;
    const lastRun = status.last_run ?? status.lastRun;
    const nextRun = status.next_run ?? status.nextRun;
    const lastRunErrors = status.last_run_errors ?? status.lastRunErrors ?? 0;
    const lastRunWarnings = status.last_run_warnings ?? status.lastRunWarnings ?? 0;
    const currentLibrary = status.current_library ?? status.currentLibrary;
    const version = status.version;

    const lines: string[] = [];

    if (version) {
      lines.push(`Version: ${version}`);
    }

    lines.push(`Status: ${running ? 'RUNNING' : 'IDLE'}`);

    if (running && currentLibrary) {
      lines.push(`Currently processing: ${currentLibrary}`);
    }

    if (lastRun) {
      const lastRunDate = new Date(lastRun);
      const ago = getTimeAgo(lastRunDate);
      lines.push(`Last run: ${lastRunDate.toLocaleString()} (${ago})`);
    } else {
      lines.push('Last run: Never');
    }

    if (nextRun) {
      const nextRunDate = new Date(nextRun);
      lines.push(`Next scheduled run: ${nextRunDate.toLocaleString()}`);
    }

    if (lastRunErrors > 0) {
      lines.push(`Last run errors: ${lastRunErrors}`);
    }

    if (lastRunWarnings > 0) {
      lines.push(`Last run warnings: ${lastRunWarnings}`);
    }

    if (lastRunErrors === 0 && lastRunWarnings === 0 && lastRun) {
      lines.push('Last run completed cleanly with no errors or warnings');
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        running,
        lastRun,
        nextRun,
        lastRunErrors,
        lastRunWarnings,
        currentLibrary,
        version,
      },
    };
  },
};

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
