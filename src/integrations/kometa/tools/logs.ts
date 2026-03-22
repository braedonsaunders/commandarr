import type { ToolDefinition } from '../../_base';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export const tool: ToolDefinition = {
  name: 'kometa_logs',
  integration: 'kometa',
  description: 'Get recent Kometa logs, optionally filtered by level. Essential for debugging failed runs and understanding what happened during processing.',
  parameters: {
    type: 'object',
    properties: {
      level: {
        type: 'string',
        description: 'Filter logs by level: "info", "warning", "error", or "all" (default: "all")',
        enum: ['all', 'info', 'warning', 'error'],
      },
      lines: {
        type: 'number',
        description: 'Number of log lines to retrieve (default: 50, max: 200)',
      },
    },
  },
  ui: {
    category: 'Diagnostics',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { level: 'error', lines: 20 },
  },
  async handler(params, ctx) {
    const client = ctx.getClient('kometa');
    const level = params.level ?? 'all';
    const requestedLines = Math.min(params.lines ?? 50, 200);

    ctx.log(`Fetching Kometa logs (level: ${level}, lines: ${requestedLines})...`);

    const queryParams: Record<string, string> = {
      lines: String(requestedLines),
    };
    if (level !== 'all') {
      queryParams.level = level;
    }

    const response = await client.get('/api/v1/logs', queryParams);

    const rawLogs = Array.isArray(response)
      ? response
      : response.logs ?? response.data ?? [];

    // Handle both structured and plain-text log formats
    let entries: LogEntry[];

    if (rawLogs.length > 0 && typeof rawLogs[0] === 'string') {
      // Plain text log lines
      entries = rawLogs.map((line: string) => {
        const parsed = parseLogLine(line);
        return parsed;
      });
    } else {
      entries = rawLogs.map((entry: any) => ({
        timestamp: entry.timestamp ?? entry.time ?? '',
        level: (entry.level ?? entry.severity ?? 'info').toLowerCase(),
        message: entry.message ?? entry.msg ?? entry.text ?? String(entry),
      }));
    }

    // Apply client-side level filter as a fallback
    let filtered = entries;
    if (level !== 'all') {
      filtered = entries.filter((e) => e.level === level);
    }

    if (filtered.length === 0) {
      return {
        success: true,
        message: level === 'all'
          ? 'No recent logs found'
          : `No ${level}-level logs found in recent entries`,
        data: { logs: [] },
      };
    }

    // Count by level
    const errorCount = filtered.filter((e) => e.level === 'error').length;
    const warningCount = filtered.filter((e) => e.level === 'warning').length;

    const logOutput = filtered
      .slice(-requestedLines)
      .map((e) => {
        const prefix = e.level === 'error' ? '[ERROR]' : e.level === 'warning' ? '[WARN]' : '[INFO]';
        const ts = e.timestamp ? `${e.timestamp} ` : '';
        return `${ts}${prefix} ${e.message}`;
      })
      .join('\n');

    const summaryParts: string[] = [`${filtered.length} log entries`];
    if (errorCount > 0) summaryParts.push(`${errorCount} errors`);
    if (warningCount > 0) summaryParts.push(`${warningCount} warnings`);

    return {
      success: true,
      message: `${summaryParts.join(', ')}:\n${logOutput}`,
      data: {
        logs: filtered,
        counts: {
          total: filtered.length,
          errors: errorCount,
          warnings: warningCount,
        },
      },
    };
  },
};

function parseLogLine(line: string): LogEntry {
  // Common Kometa log format: "2024-01-15 10:30:00 [INFO] Message here"
  const match = line.match(
    /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})?\s*\[?(INFO|WARNING|WARN|ERROR|DEBUG|CRITICAL)\]?\s*(.*)$/i,
  );

  if (match) {
    let level = (match[2] ?? 'info').toLowerCase();
    if (level === 'warn') level = 'warning';
    if (level === 'critical') level = 'error';
    return {
      timestamp: match[1] ?? '',
      level,
      message: match[3] ?? line,
    };
  }

  return {
    timestamp: '',
    level: 'info',
    message: line,
  };
}
