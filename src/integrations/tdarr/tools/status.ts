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

export const tool: ToolDefinition = {
  name: 'tdarr_status',
  integration: 'tdarr',
  description:
    'Get overall Tdarr status including server version, total files processed, space saved, active workers, and queue length',
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
    ctx.log('Fetching Tdarr status...');

    const [statusRes, statsRes, nodesRes] = await Promise.all([
      client.get('/api/v2/status'),
      client.post('/api/v2/cruddb', {
        data: { collection: 'StatisticsJSONDB', mode: 'getAll' },
      }),
      client.post('/api/v2/cruddb', {
        data: { collection: 'NodeJSONDB', mode: 'getAll' },
      }),
    ]);

    // Aggregate statistics
    let totalFileCount = 0;
    let totalTranscodeCount = 0;
    let totalHealthCheckCount = 0;
    let sizeDiff = 0;

    if (statsRes && typeof statsRes === 'object') {
      const statsEntries = Object.values(statsRes) as any[];
      for (const stat of statsEntries) {
        totalFileCount += stat.totalFileCount ?? 0;
        totalTranscodeCount += stat.totalTranscodeCount ?? 0;
        totalHealthCheckCount += stat.totalHealthCheckCount ?? 0;
        sizeDiff += stat.sizeDiff ?? 0;
      }
    }

    // Count nodes and active workers
    let totalNodes = 0;
    let onlineNodes = 0;
    let totalWorkers = 0;
    let activeWorkers = 0;

    if (nodesRes && typeof nodesRes === 'object') {
      const nodes = Object.values(nodesRes) as any[];
      totalNodes = nodes.length;
      for (const node of nodes) {
        if (node.nodePaused === false) {
          onlineNodes++;
        }
        const workers = node.workers ?? {};
        const workerList = Object.values(workers) as any[];
        totalWorkers += workerList.length;
        for (const worker of workerList) {
          if (worker.idle === false || worker.file) {
            activeWorkers++;
          }
        }
      }
    }

    // Queue info from status
    const queueLength =
      (statusRes?.table1Count ?? 0) + (statusRes?.table4Count ?? 0);

    const spaceSaved = formatBytes(Math.abs(sizeDiff));
    const savedDirection = sizeDiff < 0 ? 'saved' : 'added';

    const lines = [
      `Server version: ${statusRes?.version ?? 'Unknown'}`,
      ``,
      `Storage: ${spaceSaved} ${savedDirection} across ${totalFileCount.toLocaleString()} files`,
      `Transcodes completed: ${totalTranscodeCount.toLocaleString()}`,
      `Health checks completed: ${totalHealthCheckCount.toLocaleString()}`,
      ``,
      `Nodes: ${onlineNodes}/${totalNodes} online`,
      `Workers: ${activeWorkers}/${totalWorkers} active`,
      `Queue: ${queueLength.toLocaleString()} file(s) waiting`,
    ];

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        version: statusRes?.version,
        totalFileCount,
        totalTranscodeCount,
        totalHealthCheckCount,
        sizeDiff,
        spaceSaved: `${spaceSaved} ${savedDirection}`,
        totalNodes,
        onlineNodes,
        totalWorkers,
        activeWorkers,
        queueLength,
      },
    };
  },
};
