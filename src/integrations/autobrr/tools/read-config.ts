import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'autobrr_read_config',
  integration: 'autobrr',
  description:
    'Read and display the raw Autobrr configuration file (config.toml).',
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
    const manager = await ctx.getConfigManager('autobrr', 'config');
    ctx.log('Reading Autobrr config...');

    const raw = await manager.readRaw();
    return {
      success: true,
      message: `Autobrr config (${manager.filePath}):\n\`\`\`toml\n${raw}\`\`\``,
      data: { raw, filePath: manager.filePath },
    };
  },
};
