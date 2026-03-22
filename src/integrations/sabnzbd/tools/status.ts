import type { ToolDefinition } from '../../_base';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export const tool: ToolDefinition = {
  name: 'sabnzbd_status',
  integration: 'sabnzbd',
  description: 'Get SABnzbd server status including speed, disk space, and queue info',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'System',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('sabnzbd');
    ctx.log('Fetching SABnzbd full status...');

    const response = await client.get('/api?mode=fullstatus');

    const status = response.status ?? {};

    const speed = status.speed ?? '0';
    const speedDisplay = `${speed} KB/s`;
    const paused = status.paused ?? false;
    const diskspaceTotal1 = status.diskspacetotal1 ?? '0';
    const diskspaceFree1 = status.diskspace1 ?? '0';
    const diskspaceTotal2 = status.diskspacetotal2 ?? '0';
    const diskspaceFree2 = status.diskspace2 ?? '0';
    const version = status.version ?? 'Unknown';
    const queueSize = status.noofslots_total ?? 0;
    const uptime = status.uptime ?? 'Unknown';

    const lines = [
      `Version: ${version}`,
      `Status: ${paused ? 'PAUSED' : 'DOWNLOADING'}`,
      `Speed: ${speedDisplay}`,
      `Queue size: ${queueSize} item(s)`,
      `Uptime: ${uptime}`,
      `Download disk: ${diskspaceFree1} GB free / ${diskspaceTotal1} GB total`,
      `Complete disk: ${diskspaceFree2} GB free / ${diskspaceTotal2} GB total`,
    ];

    return {
      success: true,
      message: `SABnzbd Status:\n${lines.join('\n')}`,
      data: {
        version,
        paused,
        speed: speedDisplay,
        queueSize,
        uptime,
        downloadDisk: { free: diskspaceFree1, total: diskspaceTotal1 },
        completeDisk: { free: diskspaceFree2, total: diskspaceTotal2 },
      },
    };
  },
};
