import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'recyclarr_read_config',
  integration: 'recyclarr',
  description:
    'Read and display the raw Recyclarr YAML configuration file. Optionally filter to a specific top-level section (sonarr, radarr, etc.).',
  parameters: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        description:
          'Optional: top-level section to display (e.g., "sonarr", "radarr"). Omit to show the full raw config.',
      },
    },
  },
  ui: {
    category: 'Profiles',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const manager = await ctx.getConfigManager('recyclarr', 'config');
    ctx.log('Reading Recyclarr config...');

    const { section } = params;

    if (section && typeof section === 'string') {
      const data = await manager.read();
      if (!data || typeof data !== 'object') {
        return {
          success: false,
          message: 'Config file is empty or not a valid YAML mapping.',
        };
      }
      const config = data as Record<string, unknown>;
      const value = config[section];
      if (value === undefined) {
        const available = Object.keys(config).join(', ');
        return {
          success: false,
          message: `Section "${section}" not found in config. Available sections: ${available}`,
        };
      }
      const YAML = await import('yaml');
      const yaml = YAML.stringify({ [section]: value }, { lineWidth: 0 });
      return {
        success: true,
        message: `Recyclarr config — ${section}:\n\`\`\`yaml\n${yaml}\`\`\``,
        data: { [section]: value },
      };
    }

    const raw = await manager.readRaw();
    return {
      success: true,
      message: `Recyclarr config (${manager.filePath}):\n\`\`\`yaml\n${raw}\`\`\``,
      data: { raw, filePath: manager.filePath },
    };
  },
};
