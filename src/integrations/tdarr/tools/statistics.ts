import type { ToolDefinition } from '../../_base';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const negative = bytes < 0;
  const abs = Math.abs(bytes);
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(abs) / Math.log(1024));
  const value = (abs / Math.pow(1024, i)).toFixed(2);
  return `${negative ? '-' : ''}${value} ${units[i]}`;
}

function pct(count: number, total: number): string {
  if (total === 0) return '0%';
  return `${((count / total) * 100).toFixed(1)}%`;
}

export const tool: ToolDefinition = {
  name: 'tdarr_statistics',
  integration: 'tdarr',
  description:
    'Detailed Tdarr statistics: files by codec, resolution, container format, health check results, transcode rates, and total space saved',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Transcoding',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('tdarr');
    ctx.log('Fetching Tdarr statistics...');

    const statsRes = await client.post('/api/v2/cruddb', {
      data: { collection: 'StatisticsJSONDB', mode: 'getAll' },
    });

    if (!statsRes || typeof statsRes !== 'object') {
      return {
        success: true,
        message: 'No statistics available',
        data: {},
      };
    }

    const statsEntries = Object.values(statsRes) as any[];

    let totalFileCount = 0;
    let totalTranscodeCount = 0;
    let totalHealthCheckCount = 0;
    let totalHealthChecksFailed = 0;
    let sizeDiff = 0;

    const codecCounts: Record<string, number> = {};
    const containerCounts: Record<string, number> = {};
    const resolutionCounts: Record<string, number> = {};

    for (const stat of statsEntries) {
      totalFileCount += stat.totalFileCount ?? 0;
      totalTranscodeCount += stat.totalTranscodeCount ?? 0;
      totalHealthCheckCount += stat.totalHealthCheckCount ?? 0;
      totalHealthChecksFailed += stat.totalHealthCheckFailedCount ?? 0;
      sizeDiff += stat.sizeDiff ?? 0;

      // Aggregate codec pie data
      if (stat.ppieces && Array.isArray(stat.ppieces)) {
        for (const piece of stat.ppieces) {
          const name = piece.name ?? piece.label ?? 'Unknown';
          codecCounts[name] = (codecCounts[name] ?? 0) + (piece.value ?? piece.count ?? 0);
        }
      }

      // Aggregate container pie data
      if (stat.cpieces && Array.isArray(stat.cpieces)) {
        for (const piece of stat.cpieces) {
          const name = piece.name ?? piece.label ?? 'Unknown';
          containerCounts[name] = (containerCounts[name] ?? 0) + (piece.value ?? piece.count ?? 0);
        }
      }

      // Aggregate resolution pie data
      if (stat.rpieces && Array.isArray(stat.rpieces)) {
        for (const piece of stat.rpieces) {
          const name = piece.name ?? piece.label ?? 'Unknown';
          resolutionCounts[name] = (resolutionCounts[name] ?? 0) + (piece.value ?? piece.count ?? 0);
        }
      }
    }

    const spaceSaved = formatBytes(Math.abs(sizeDiff));
    const savedDirection = sizeDiff < 0 ? 'saved' : 'added';
    const healthChecksPassed = totalHealthCheckCount - totalHealthChecksFailed;

    const lines: string[] = [
      `=== Storage ===`,
      `${spaceSaved} ${savedDirection} across ${totalFileCount.toLocaleString()} files`,
      ``,
      `=== Processing ===`,
      `Transcodes completed: ${totalTranscodeCount.toLocaleString()}`,
      `Health checks: ${totalHealthCheckCount.toLocaleString()} total (${healthChecksPassed.toLocaleString()} passed, ${totalHealthChecksFailed.toLocaleString()} failed)`,
    ];

    // Top codecs
    const sortedCodecs = Object.entries(codecCounts).sort(
      ([, a], [, b]) => b - a,
    );
    if (sortedCodecs.length > 0) {
      lines.push('', '=== Video Codecs ===');
      for (const [codec, count] of sortedCodecs.slice(0, 10)) {
        lines.push(`- ${codec}: ${count.toLocaleString()} files (${pct(count, totalFileCount)})`);
      }
    }

    // Top containers
    const sortedContainers = Object.entries(containerCounts).sort(
      ([, a], [, b]) => b - a,
    );
    if (sortedContainers.length > 0) {
      lines.push('', '=== Container Formats ===');
      for (const [container, count] of sortedContainers.slice(0, 10)) {
        lines.push(`- ${container}: ${count.toLocaleString()} files (${pct(count, totalFileCount)})`);
      }
    }

    // Top resolutions
    const sortedResolutions = Object.entries(resolutionCounts).sort(
      ([, a], [, b]) => b - a,
    );
    if (sortedResolutions.length > 0) {
      lines.push('', '=== Resolutions ===');
      for (const [res, count] of sortedResolutions.slice(0, 10)) {
        lines.push(`- ${res}: ${count.toLocaleString()} files (${pct(count, totalFileCount)})`);
      }
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        totalFileCount,
        totalTranscodeCount,
        totalHealthCheckCount,
        totalHealthChecksFailed,
        sizeDiff,
        spaceSaved: `${spaceSaved} ${savedDirection}`,
        codecs: sortedCodecs.map(([name, count]) => ({ name, count })),
        containers: sortedContainers.map(([name, count]) => ({ name, count })),
        resolutions: sortedResolutions.map(([name, count]) => ({ name, count })),
      },
    };
  },
};
