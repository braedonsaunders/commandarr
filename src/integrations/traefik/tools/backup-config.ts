import type { ToolDefinition } from '../../_base';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export const tool: ToolDefinition = {
  name: 'traefik_backup_config',
  integration: 'traefik',
  description:
    'Create a backup of the Traefik static config file and list all existing backups. Backups are stored alongside the config file.',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Configuration',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const manager = await ctx.getConfigManager('traefik', 'config');
    ctx.log('Backing up Traefik config...');

    const backupPath = await manager.backup();
    const backups = await manager.listBackups();

    const lines = [
      `Backup created: ${backupPath}`,
      '',
      `Total backups: ${backups.length}`,
    ];

    if (backups.length > 0) {
      lines.push('');
      lines.push('Recent backups:');
      for (const b of backups.slice(0, 10)) {
        const age = getTimeAgo(b.timestamp);
        lines.push(`  - ${b.path} (${formatBytes(b.size)}, ${age})`);
      }
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: { backupPath, totalBackups: backups.length, backups: backups.slice(0, 10) },
    };
  },
};

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
