import type { ToolDefinition } from '../../_base';

interface QueueSlot {
  filename: string;
  status: string;
  percentage: number;
  mb: string;
  mbleft: string;
  size: string;
  eta: string;
  timeleft: string;
  category: string;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(1024));
  return `${(bytesPerSec / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export const tool: ToolDefinition = {
  name: 'sabnzbd_queue',
  integration: 'sabnzbd',
  description: 'List current downloads in the SABnzbd queue',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Downloads',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('sabnzbd');
    ctx.log('Fetching SABnzbd download queue...');

    const response = await client.get('/api?mode=queue');

    const queue = response.queue ?? {};
    const slots = queue.slots ?? [];
    const speed = queue.speed ?? '0';
    const speedBytes = parseFloat(speed) * 1024; // SABnzbd reports speed in KB/s

    const items: QueueSlot[] = [];

    if (Array.isArray(slots)) {
      for (const slot of slots) {
        items.push({
          filename: slot.filename ?? 'Unknown',
          status: slot.status ?? 'unknown',
          percentage: parseInt(slot.percentage ?? '0', 10),
          mb: slot.mb ?? '0',
          mbleft: slot.mbleft ?? '0',
          size: slot.size ?? 'Unknown',
          eta: slot.eta ?? 'unknown',
          timeleft: slot.timeleft ?? 'unknown',
          category: slot.cat ?? 'Default',
        });
      }
    }

    if (items.length === 0) {
      return {
        success: true,
        message: `Download queue is empty. Speed: ${formatSpeed(speedBytes)}`,
        data: { items: [], speed: formatSpeed(speedBytes) },
      };
    }

    const summary = items
      .map(
        (item) =>
          `- ${item.filename}: ${item.status} (${item.percentage}%, ${item.mbleft} MB remaining, ETA: ${item.eta}, time left: ${item.timeleft})`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} item(s) in queue (speed: ${formatSpeed(speedBytes)}):\n${summary}`,
      data: { items, speed: formatSpeed(speedBytes) },
    };
  },
};
