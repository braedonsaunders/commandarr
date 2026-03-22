import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'crossseed_edit_config',
  integration: 'crossseed',
  description:
    'Write updated content to the Cross-seed config file. Creates a backup before writing. Use crossseed_read_config first to get the current content, then modify and pass the full updated config here.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The full updated content to write to the Cross-seed config file.',
      },
    },
    required: ['content'],
  },
  ui: {
    category: 'Configuration',
    dangerLevel: 'high',
    testable: false,
  },
  async handler(params, ctx) {
    const { content } = params;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return {
        success: false,
        message: 'Content cannot be empty. Provide the full config content to write.',
      };
    }

    const manager = await ctx.getConfigManager('crossseed', 'config');
    ctx.log('Backing up and writing Cross-seed config...');

    const backupPath = await manager.backup();
    await manager.writeRaw(content);

    return {
      success: true,
      message:
        `Cross-seed config updated successfully.\n` +
        `Backup saved to: ${backupPath}\n\n` +
        `Restart Cross-seed to apply the configuration changes.`,
      data: { backupPath, filePath: manager.filePath },
    };
  },
};
