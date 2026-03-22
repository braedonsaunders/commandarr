import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'recyclarr_edit_config',
  integration: 'recyclarr',
  description:
    'Write updated YAML content to the Recyclarr config file. Creates a backup before writing. Use recyclarr_read_config first to get the current content, then modify and pass the full updated YAML here.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The full updated YAML content to write to the Recyclarr config file.',
      },
    },
    required: ['content'],
  },
  ui: {
    category: 'Profiles',
    dangerLevel: 'high',
    testable: false,
  },
  async handler(params, ctx) {
    const { content } = params;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return {
        success: false,
        message: 'Content cannot be empty. Provide the full YAML config to write.',
      };
    }

    // Validate the YAML parses correctly before writing
    const YAML = await import('yaml');
    try {
      YAML.parse(content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Invalid YAML content: ${msg}`,
      };
    }

    const manager = await ctx.getConfigManager('recyclarr', 'config');
    ctx.log('Backing up and writing Recyclarr config...');

    const backupPath = await manager.backup();
    await manager.writeRaw(content);

    return {
      success: true,
      message:
        `Recyclarr config updated successfully.\n` +
        `Backup saved to: ${backupPath}\n\n` +
        `Run Recyclarr (via Docker or CLI) to apply the changes to Sonarr/Radarr.`,
      data: { backupPath, filePath: manager.filePath },
    };
  },
};
