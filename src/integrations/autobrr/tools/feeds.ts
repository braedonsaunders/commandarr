import type { ToolDefinition } from '../../_base';

interface Feed {
  id: number;
  name: string;
  type: string;
  enabled: boolean;
  url: string;
  lastRun: string | null;
  errorCount: number;
}

export const tool: ToolDefinition = {
  name: 'autobrr_feeds',
  integration: 'autobrr',
  description:
    'List Autobrr RSS/torznab feeds — shows feed name, type, enabled status, last run time, and error count',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Connectivity',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('autobrr');
    ctx.log('Fetching Autobrr feeds...');

    const results = await client.get('/api/feeds');

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: 'No feeds configured',
        data: { feeds: [] },
      };
    }

    const feeds: Feed[] = results.map((f: any) => ({
      id: f.id ?? 0,
      name: f.name ?? 'Unknown',
      type: f.type ?? 'unknown',
      enabled: f.enabled ?? false,
      url: f.url ?? '',
      lastRun: f.last_run ?? f.lastRun ?? null,
      errorCount: f.error_count ?? f.errorCount ?? 0,
    }));

    const enabledCount = feeds.filter((f) => f.enabled).length;
    const errorFeeds = feeds.filter((f) => f.errorCount > 0);

    const summary = feeds
      .map(
        (f) =>
          `- ${f.name} (ID: ${f.id}, ${f.type}, ${f.enabled ? 'enabled' : 'disabled'}${f.lastRun ? `, last run: ${f.lastRun}` : ''}${f.errorCount > 0 ? `, errors: ${f.errorCount}` : ''})`,
      )
      .join('\n');

    return {
      success: true,
      message: `${feeds.length} feed(s) (${enabledCount} enabled${errorFeeds.length > 0 ? `, ${errorFeeds.length} with errors` : ''}):\n${summary}`,
      data: { feeds, enabledCount, errorCount: errorFeeds.length },
    };
  },
};
