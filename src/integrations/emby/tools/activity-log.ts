import type { ToolDefinition } from '../../_base';

interface ActivityEntry {
  Id: number;
  Name: string;
  Type: string;
  Date: string;
  Severity: string;
  ShortOverview?: string;
  Overview?: string;
  UserId?: string;
}

export const tool: ToolDefinition = {
  name: 'emby_activity_log',
  integration: 'emby',
  description:
    'Get recent Emby server activity log entries (logins, playback events, library changes, errors)',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Number of entries to return (default: 25, max: 100)',
      },
    },
  },
  ui: {
    category: 'System',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { limit: 10 },
  },
  async handler(params, ctx) {
    const client = ctx.getClient('emby');
    const limit = Math.min(params.limit ?? 25, 100);

    ctx.log(`Fetching last ${limit} activity log entries...`);

    const response = await client.get('/System/ActivityLog/Entries', {
      StartIndex: '0',
      Limit: String(limit),
    });

    const items: ActivityEntry[] = response?.Items ?? [];

    if (items.length === 0) {
      return { success: true, message: 'No activity log entries found.', data: { entries: [] } };
    }

    const entries = items.map((e) => ({
      id: e.Id,
      name: e.Name,
      type: e.Type,
      severity: e.Severity,
      date: e.Date,
      overview: e.ShortOverview ?? e.Overview ?? '',
    }));

    const summary = entries
      .map(
        (e) =>
          `- [${e.severity}] ${e.name}${e.overview ? ` — ${e.overview}` : ''} (${new Date(e.date).toLocaleString()})`,
      )
      .join('\n');

    return {
      success: true,
      message: `${entries.length} activity log entries:\n${summary}`,
      data: { entries, total: response?.TotalRecordCount ?? entries.length },
    };
  },
};
