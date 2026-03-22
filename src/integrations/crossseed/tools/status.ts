import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'crossseed_status',
  integration: 'crossseed',
  description: 'Get Cross-seed statistics including matches, cross-seeds, and data saved',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Seeding',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('crossseed');
    ctx.log('Fetching Cross-seed statistics...');

    const stats = await client.get('/api/stats');

    const lines: string[] = [];

    if (stats.totalSearches !== undefined) {
      lines.push(`Total searches: ${stats.totalSearches}`);
    }
    if (stats.totalMatches !== undefined) {
      lines.push(`Total matches found: ${stats.totalMatches}`);
    }
    if (stats.totalCrossSeeds !== undefined) {
      lines.push(`Successful cross-seeds: ${stats.totalCrossSeeds}`);
    }
    if (stats.dataSaved !== undefined) {
      lines.push(`Data saved (not re-downloaded): ${formatBytes(stats.dataSaved)}`);
    }
    if (stats.activeSearches !== undefined) {
      lines.push(`Active searches: ${stats.activeSearches}`);
    }

    if (lines.length === 0) {
      return {
        success: true,
        message: 'Cross-seed is running. No detailed statistics available.',
        data: stats,
      };
    }

    return {
      success: true,
      message: `Cross-seed statistics:\n${lines.join('\n')}`,
      data: stats,
    };
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
