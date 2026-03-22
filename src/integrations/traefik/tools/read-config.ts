import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'traefik_read_config',
  integration: 'traefik',
  description:
    'Read and display the raw Traefik static configuration file (traefik.yml). Optionally filter to a specific top-level section (entryPoints, providers, api, etc.).',
  parameters: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        description:
          'Optional: top-level section to display (e.g., "entryPoints", "providers", "api", "certificatesResolvers"). Omit to show the full raw config.',
      },
    },
  },
  ui: {
    category: 'Configuration',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const manager = await ctx.getConfigManager('traefik', 'config');
    ctx.log('Reading Traefik config...');

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
        message: `Traefik config — ${section}:\n\`\`\`yaml\n${yaml}\`\`\``,
        data: { [section]: value },
      };
    }

    const raw = await manager.readRaw();
    return {
      success: true,
      message: `Traefik config (${manager.filePath}):\n\`\`\`yaml\n${raw}\`\`\``,
      data: { raw, filePath: manager.filePath },
    };
  },
};
