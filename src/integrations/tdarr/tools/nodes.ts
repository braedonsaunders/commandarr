import type { ToolDefinition } from '../../_base';

interface NodeInfo {
  id: string;
  name: string;
  online: boolean;
  paused: boolean;
  gpus: string[];
  workerCount: number;
  activeJobs: number;
  platform: string;
  version: string;
}

export const tool: ToolDefinition = {
  name: 'tdarr_nodes',
  integration: 'tdarr',
  description:
    'List all Tdarr nodes (server and workers) with their status, GPU info, worker count, and active jobs',
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
    ctx.log('Fetching Tdarr nodes...');

    const nodesRes = await client.post('/api/v2/cruddb', {
      data: { collection: 'NodeJSONDB', mode: 'getAll' },
    });

    if (!nodesRes || typeof nodesRes !== 'object') {
      return { success: true, message: 'No nodes found', data: { nodes: [] } };
    }

    const nodeEntries = Object.entries(nodesRes) as [string, any][];
    const nodes: NodeInfo[] = [];

    for (const [id, node] of nodeEntries) {
      const workers = node.workers ?? {};
      const workerList = Object.values(workers) as any[];
      const activeJobs = workerList.filter(
        (w: any) => w.idle === false || w.file,
      ).length;

      const gpus: string[] = [];
      if (Array.isArray(node.gpus)) {
        for (const gpu of node.gpus) {
          gpus.push(gpu.name ?? gpu.model ?? 'Unknown GPU');
        }
      }

      nodes.push({
        id,
        name: node.nodeName ?? id,
        online: node.nodePaused === false,
        paused: node.nodePaused === true,
        gpus,
        workerCount: workerList.length,
        activeJobs,
        platform: node.platform ?? 'unknown',
        version: node.version ?? 'unknown',
      });
    }

    if (nodes.length === 0) {
      return { success: true, message: 'No nodes found', data: { nodes: [] } };
    }

    const summary = nodes
      .map((n) => {
        const status = n.paused ? 'PAUSED' : 'ONLINE';
        const gpuStr = n.gpus.length > 0 ? ` | GPUs: ${n.gpus.join(', ')}` : '';
        return `- ${n.name} [${status}]: ${n.activeJobs}/${n.workerCount} workers active${gpuStr} (${n.platform}, v${n.version})`;
      })
      .join('\n');

    const onlineCount = nodes.filter((n) => !n.paused).length;

    return {
      success: true,
      message: `${nodes.length} node(s) found (${onlineCount} online):\n${summary}`,
      data: { nodes },
    };
  },
};
