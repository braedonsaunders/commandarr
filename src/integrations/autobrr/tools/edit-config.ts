import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'autobrr_edit_config',
  integration: 'autobrr',
  description:
    'Write updated TOML content to the Autobrr config file. Creates a backup before writing. Use autobrr_read_config first to get the current content, then modify and pass the full updated TOML here.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The full updated TOML content to write to the Autobrr config file.',
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
        message: 'Content cannot be empty. Provide the full TOML config to write.',
      };
    }

    const manager = await ctx.getConfigManager('autobrr', 'config');
    ctx.log('Backing up and writing Autobrr config...');

    const backupPath = await manager.backup();
    await manager.writeRaw(content);

    return {
      success: true,
      message:
        `Autobrr config updated successfully.\n` +
        `Backup saved to: ${backupPath}\n\n` +
        `Restart Autobrr to apply the configuration changes.`,
      data: { backupPath, filePath: manager.filePath },
    };
  },
};
