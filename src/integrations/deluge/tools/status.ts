import type { ToolDefinition } from '../../_base';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

const SESSION_KEYS = [
  'download_rate',
  'upload_rate',
  'dht_nodes',
  'has_incoming_connections',
  'free_disk_space',
];

export const tool: ToolDefinition = {
  name: 'deluge_status',
  integration: 'deluge',
  description: 'Get Deluge session status (speeds, DHT nodes, disk space, version)',
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
    const client = ctx.getClient('deluge');
    ctx.log('Fetching Deluge session status...');

    const sessionStatus = await client.post('core.get_session_status', [SESSION_KEYS]);

    let version = 'Unknown';
    try {
      const daemonInfo = await client.post('daemon.info', []);
      if (daemonInfo) {
        version = daemonInfo;
      }
    } catch {
      // Version info is optional; ignore errors
    }

    const status = {
      dlSpeed: formatSpeed(sessionStatus?.download_rate ?? 0),
      ulSpeed: formatSpeed(sessionStatus?.upload_rate ?? 0),
      dhtNodes: sessionStatus?.dht_nodes ?? 0,
      hasIncoming: sessionStatus?.has_incoming_connections ?? false,
      freeDisk: formatBytes(sessionStatus?.free_disk_space ?? 0),
      version,
    };

    const summary = [
      `Version: ${status.version}`,
      `Download Speed: ${status.dlSpeed}`,
      `Upload Speed: ${status.ulSpeed}`,
      `DHT Nodes: ${status.dhtNodes}`,
      `Incoming Connections: ${status.hasIncoming ? 'Yes' : 'No'}`,
      `Free Disk Space: ${status.freeDisk}`,
    ].join('\n');

    return {
      success: true,
      message: `Deluge Status:\n${summary}`,
      data: { status },
    };
  },
};
