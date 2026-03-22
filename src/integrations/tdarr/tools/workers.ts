import type { ToolDefinition } from '../../_base';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const abs = Math.abs(bytes);
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(abs) / Math.log(1024));
  const value = (abs / Math.pow(1024, i)).toFixed(1);
  return `${value} ${units[i]}`;
}

interface WorkerInfo {
  id: string;
  nodeName: string;
  workerType: string;
  status: string;
  file: string | null;
  percentage: number;
  eta: string;
  speed: string;
  step: string;
  originalSize: string;
  estimatedNewSize: string;
  codec: string;
}

export const tool: ToolDefinition = {
  name: 'tdarr_workers',
  integration: 'tdarr',
  description:
    'Get active Tdarr worker details: what each worker is processing, progress percentage, ETA, speed, and codec',
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
    ctx.log('Fetching Tdarr workers...');

    const nodesRes = await client.post('/api/v2/cruddb', {
      data: { collection: 'NodeJSONDB', mode: 'getAll' },
    });

    if (!nodesRes || typeof nodesRes !== 'object') {
      return {
        success: true,
        message: 'No nodes or workers found',
        data: { workers: [] },
      };
    }

    const workers: WorkerInfo[] = [];

    for (const [, node] of Object.entries(nodesRes) as [string, any][]) {
      const nodeName = node.nodeName ?? 'Unknown Node';
      const nodeWorkers = node.workers ?? {};

      for (const [workerId, worker] of Object.entries(nodeWorkers) as [
        string,
        any,
      ][]) {
        const isActive = worker.idle === false || worker.file;
        const file = worker.file ?? worker.lastFile ?? null;
        const filename = file ? (file.split('/').pop() ?? file) : null;

        const percentage = worker.percentage ?? worker.progress ?? 0;
        const eta = worker.ETA ?? worker.eta ?? '';
        const speed = worker.speed ?? worker.fps ?? '';
        const step = worker.step ?? worker.currentStep ?? '';
        const originalSize = worker.originalfileSize ?? worker.origSize ?? 0;
        const estimatedNewSize = worker.newfileSize ?? worker.newSize ?? 0;
        const codec =
          worker.outputCodec ??
          worker.codec ??
          worker.preset?.split(' ').find((s: string) => s.includes('265') || s.includes('264') || s.includes('av1')) ??
          '';

        workers.push({
          id: workerId,
          nodeName,
          workerType: worker.workerType ?? (workerId.includes('gpu') ? 'GPU' : 'CPU'),
          status: isActive ? 'active' : 'idle',
          file: filename,
          percentage: Math.round(percentage * 100) / 100,
          eta: typeof eta === 'string' ? eta : `${eta}`,
          speed: typeof speed === 'string' ? speed : `${speed}`,
          step,
          originalSize: formatBytes(originalSize),
          estimatedNewSize: formatBytes(estimatedNewSize),
          codec,
        });
      }
    }

    if (workers.length === 0) {
      return {
        success: true,
        message: 'No workers found',
        data: { workers: [] },
      };
    }

    const activeWorkers = workers.filter((w) => w.status === 'active');
    const idleWorkers = workers.filter((w) => w.status === 'idle');

    const lines: string[] = [
      `${workers.length} worker(s): ${activeWorkers.length} active, ${idleWorkers.length} idle`,
    ];

    if (activeWorkers.length > 0) {
      lines.push('', 'Active workers:');
      for (const w of activeWorkers) {
        const progressBar = `${w.percentage.toFixed(1)}%`;
        lines.push(
          `- [${w.workerType}] ${w.nodeName}/${w.id}: ${w.file ?? 'unknown file'}`,
        );
        lines.push(
          `  Progress: ${progressBar}${w.eta ? ` | ETA: ${w.eta}` : ''}${w.speed ? ` | Speed: ${w.speed}` : ''}`,
        );
        if (w.codec || w.step) {
          lines.push(
            `  ${w.step ? `Step: ${w.step}` : ''}${w.codec ? ` | Codec: ${w.codec}` : ''}`,
          );
        }
        if (w.originalSize !== '0 B') {
          lines.push(
            `  Size: ${w.originalSize} -> ${w.estimatedNewSize}`,
          );
        }
      }
    }

    if (idleWorkers.length > 0) {
      lines.push('', 'Idle workers:');
      for (const w of idleWorkers) {
        lines.push(`- [${w.workerType}] ${w.nodeName}/${w.id}`);
      }
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: { workers },
    };
  },
};
