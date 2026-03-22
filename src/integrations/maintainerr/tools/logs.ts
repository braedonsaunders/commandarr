import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'maintainerr_logs',
  integration: 'maintainerr',
  description:
    'Get recent Maintainerr logs, optionally filtered by level. Useful for debugging rule behavior and tracking cleanup actions.',
  parameters: {
    type: 'object',
    properties: {
      level: {
        type: 'string',
        description: 'Filter logs by level: all, info, warn, error, debug',
        enum: ['all', 'info', 'warn', 'error', 'debug'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of log entries to return (default: 50)',
      },
    },
  },
  ui: {
    category: 'System',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { level: 'all', limit: 25 },
  },
  async handler(params, ctx) {
    const client = ctx.getClient('maintainerr');
    const level = params.level ?? 'all';
    const limit = params.limit ?? 50;
    ctx.log(`Fetching Maintainerr logs (level: ${level}, limit: ${limit})...`);

    const queryParams: Record<string, string> = {};
    if (level !== 'all') {
      queryParams.level = level;
    }
    if (limit) {
      queryParams.limit = String(limit);
    }

    const logs = await client.get('/logs', Object.keys(queryParams).length > 0 ? queryParams : undefined);

    if (!logs) {
      return {
        success: false,
        message: 'Unable to retrieve logs from Maintainerr',
      };
    }

    // Handle both array of logs and object with data property
    const entries = Array.isArray(logs) ? logs : (logs.data ?? logs.logs ?? []);

    if (!Array.isArray(entries) || entries.length === 0) {
      return {
        success: true,
        message: `No log entries found${level !== 'all' ? ` for level: ${level}` : ''}.`,
        data: { logs: [] },
      };
    }

    const displayEntries = entries.slice(0, limit);

    const formatted = displayEntries.map((entry: any) => {
      const timestamp = entry.timestamp ?? entry.createdAt ?? entry.date ?? '';
      const dateStr = timestamp ? new Date(timestamp).toLocaleString() : '';
      const entryLevel = (entry.level ?? entry.type ?? 'INFO').toUpperCase();
      const message = entry.message ?? entry.text ?? entry.msg ?? '';
      const context = entry.context ?? entry.source ?? '';
      const contextStr = context ? ` [${context}]` : '';

      return `${dateStr} [${entryLevel}]${contextStr} ${message}`;
    });

    const header = `Maintainerr logs${level !== 'all' ? ` (${level})` : ''} - showing ${displayEntries.length} of ${entries.length} entries:`;

    return {
      success: true,
      message: `${header}\n\n${formatted.join('\n')}`,
      data: {
        totalEntries: entries.length,
        displayedEntries: displayEntries.length,
        level,
      },
    };
  },
};
