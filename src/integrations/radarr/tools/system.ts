import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'radarr_system',
  integration: 'radarr',
  description:
    'Get Radarr system information including status, health checks, running tasks, disk space, and update availability.',
  parameters: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        description: 'Which system info to retrieve',
        enum: ['status', 'health', 'tasks', 'diskspace', 'updates', 'all'],
      },
    },
    required: ['section'],
  },
  ui: {
    category: 'Configuration',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { section: 'status' },
  },
  async handler(params, ctx) {
    const { section } = params;
    const client = ctx.getClient('radarr');
    const lines: string[] = [];
    const data: Record<string, any> = {};

    const fetchSection = async (name: string) => {
      if (section !== 'all' && section !== name) return;

      if (name === 'status') {
        ctx.log('Fetching system status...');
        const status = await client.get('/api/v3/system/status');
        data.status = status;
        lines.push(
          '--- System Status ---',
          `Version: ${status.version}`,
          `OS: ${status.osName} ${status.osVersion}`,
          `Runtime: ${status.runtimeName} ${status.runtimeVersion}`,
          `Branch: ${status.branch}`,
          `Auth: ${status.authentication}`,
          `Start Time: ${status.startTime ? new Date(status.startTime).toLocaleString() : 'Unknown'}`,
          `App Data: ${status.appData}`,
          '',
        );
      }

      if (name === 'health') {
        ctx.log('Fetching health checks...');
        const health: any[] = await client.get('/api/v3/health');
        data.health = health;
        if (health.length === 0) {
          lines.push('--- Health ---', 'All checks passed!', '');
        } else {
          lines.push('--- Health Issues ---');
          for (const h of health) {
            lines.push(`[${h.type}] ${h.message}`);
            if (h.wikiUrl) lines.push(`  Wiki: ${h.wikiUrl}`);
          }
          lines.push('');
        }
      }

      if (name === 'tasks') {
        ctx.log('Fetching scheduled tasks...');
        const tasks: any[] = await client.get('/api/v3/system/task');
        data.tasks = tasks;
        lines.push('--- Scheduled Tasks ---');
        for (const t of tasks) {
          const lastExec = t.lastExecution
            ? new Date(t.lastExecution).toLocaleString()
            : 'Never';
          const nextExec = t.nextExecution
            ? new Date(t.nextExecution).toLocaleString()
            : 'N/A';
          lines.push(`- ${t.name}: last ${lastExec}, next ${nextExec} (every ${t.interval}min)`);
        }
        lines.push('');
      }

      if (name === 'diskspace') {
        ctx.log('Fetching disk space...');
        const disks: any[] = await client.get('/api/v3/diskspace');
        data.diskspace = disks;
        lines.push('--- Disk Space ---');
        for (const d of disks) {
          const free = formatBytes(d.freeSpace ?? 0);
          const total = formatBytes(d.totalSpace ?? 0);
          const pct = d.totalSpace ? Math.round(((d.totalSpace - d.freeSpace) / d.totalSpace) * 100) : 0;
          lines.push(`- ${d.path}: ${free} free / ${total} total (${pct}% used)`);
        }
        lines.push('');
      }

      if (name === 'updates') {
        ctx.log('Fetching updates...');
        const updates: any[] = await client.get('/api/v3/update');
        data.updates = updates;
        if (updates.length === 0) {
          lines.push('--- Updates ---', 'Up to date!', '');
        } else {
          lines.push('--- Available Updates ---');
          for (const u of updates.slice(0, 3)) {
            lines.push(`- v${u.version} (${u.branch}) — ${u.releaseDate ? new Date(u.releaseDate).toLocaleDateString() : ''}`);
            if (u.installed) lines.push('  [Currently installed]');
          }
          lines.push('');
        }
      }
    };

    if (section === 'all') {
      for (const s of ['status', 'health', 'tasks', 'diskspace', 'updates']) {
        await fetchSection(s);
      }
    } else {
      await fetchSection(section);
    }

    return {
      success: true,
      message: lines.join('\n'),
      data,
    };
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
