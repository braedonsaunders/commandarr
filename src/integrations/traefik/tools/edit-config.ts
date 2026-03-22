import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'traefik_edit_config',
  integration: 'traefik',
  description:
    'Write updated YAML content to the Traefik static config file (traefik.yml). Creates a backup before writing. Use traefik_read_config first to get the current content, then modify and pass the full updated YAML here.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The full updated YAML content to write to the Traefik config file.',
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

    const manager = await ctx.getConfigManager('traefik', 'config');
    ctx.log('Backing up and writing Traefik config...');

    const backupPath = await manager.backup();
    await manager.writeRaw(content);

    return {
      success: true,
      message:
        `Traefik config updated successfully.\n` +
        `Backup saved to: ${backupPath}\n\n` +
        `Traefik will automatically detect changes if file provider watching is enabled, ` +
        `otherwise restart Traefik to apply the new static configuration.`,
      data: { backupPath, filePath: manager.filePath },
    };
  },
};
