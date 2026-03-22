import type { ToolDefinition } from '../../_base';
import * as YAML from 'yaml';

export const tool: ToolDefinition = {
  name: 'kometa_read_config',
  integration: 'kometa',
  description:
    'Read and display the current Kometa config.yml. Optionally filter to a specific section (libraries, plex, tmdb, settings, etc.).',
  parameters: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        description:
          'Optional: top-level section to display (e.g., "libraries", "plex", "settings", "tmdb", "trakt"). Omit to show the full config summary.',
      },
    },
  },
  ui: {
    category: 'Config',
    dangerLevel: 'low',
    testable: false,
  },
  async handler(params, ctx) {
    const manager = await ctx.getConfigManager('kometa', 'config');
    ctx.log('Reading Kometa config...');

    const data = await manager.read();

    if (!data || typeof data !== 'object') {
      return {
        success: false,
        message: 'Config file is empty or not a valid YAML mapping.',
      };
    }

    const config = data as Record<string, unknown>;
    const { section } = params;

    if (section && typeof section === 'string') {
      const value = config[section];
      if (value === undefined) {
        const available = Object.keys(config).join(', ');
        return {
          success: false,
          message: `Section "${section}" not found in config. Available sections: ${available}`,
        };
      }

      const yaml = YAML.stringify({ [section]: value }, { lineWidth: 0 });
      return {
        success: true,
        message: `Kometa config — ${section}:\n\`\`\`yaml\n${yaml}\`\`\``,
        data: { [section]: value },
      };
    }

    // Full config summary
    const sections = Object.keys(config);
    const lines: string[] = [`Config file: ${manager.filePath}`, `Sections: ${sections.join(', ')}`, ''];

    // Summarize libraries
    if (config.libraries && typeof config.libraries === 'object') {
      const libs = config.libraries as Record<string, unknown>;
      const libNames = Object.keys(libs);
      lines.push(`Libraries (${libNames.length}):`);
      for (const name of libNames) {
        const lib = libs[name] as Record<string, unknown> | undefined;
        if (!lib) continue;
        const features: string[] = [];
        if (lib.collection_files || lib.collections) features.push('collections');
        if (lib.overlay_files || lib.overlays) features.push('overlays');
        if (lib.operations) features.push('operations');
        if (lib.metadata_files || lib.metadata) features.push('metadata');
        lines.push(`  - ${name}: ${features.length > 0 ? features.join(', ') : 'no actions configured'}`);
      }
      lines.push('');
    }

    // Summarize connected services
    const services: string[] = [];
    if (config.plex) services.push('Plex');
    if (config.tmdb) services.push('TMDb');
    if (config.trakt) services.push('Trakt');
    if (config.tautulli) services.push('Tautulli');
    if (config.omdb) services.push('OMDb');
    if (config.mdblist) services.push('MDBList');
    if (config.radarr) services.push('Radarr');
    if (config.sonarr) services.push('Sonarr');
    if (services.length > 0) {
      lines.push(`Connected services: ${services.join(', ')}`);
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: config,
    };
  },
};
