import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'crossseed_read_config',
  integration: 'crossseed',
  description:
    'Read and display the raw Cross-seed configuration file (config.js or config.yml).',
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
    const manager = await ctx.getConfigManager('crossseed', 'config');
    ctx.log('Reading Cross-seed config...');

    const raw = await manager.readRaw();
    return {
      success: true,
      message: `Cross-seed config (${manager.filePath}):\n\`\`\`\n${raw}\`\`\``,
      data: { raw, filePath: manager.filePath },
    };
  },
};
