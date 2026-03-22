import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'recyclarr_config_summary',
  integration: 'recyclarr',
  description:
    'Get a human-readable summary of the Recyclarr configuration: configured Sonarr/Radarr instances, quality profiles being synced, and custom formats',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Profiles',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const manager = await ctx.getConfigManager('recyclarr', 'config');
    ctx.log('Reading Recyclarr configuration summary...');

    const data = await manager.read();

    if (!data || typeof data !== 'object') {
      return {
        success: false,
        message: 'Config file is empty or not a valid YAML mapping.',
      };
    }

    const config = data as Record<string, unknown>;
    const lines: string[] = [`Config file: ${manager.filePath}`, ''];

    // Sonarr instances
    const sonarr = config.sonarr;
    if (sonarr && typeof sonarr === 'object') {
      const instances = sonarr as Record<string, unknown>;
      const instanceNames = Object.keys(instances);
      lines.push(`Sonarr instances (${instanceNames.length}):`);
      for (const name of instanceNames) {
        const instance = instances[name] as Record<string, unknown> | undefined;
        if (!instance) continue;
        const details = summarizeInstance(instance);
        lines.push(`  - ${name}: ${details}`);
      }
      lines.push('');
    } else {
      lines.push('Sonarr: No instances configured');
      lines.push('');
    }

    // Radarr instances
    const radarr = config.radarr;
    if (radarr && typeof radarr === 'object') {
      const instances = radarr as Record<string, unknown>;
      const instanceNames = Object.keys(instances);
      lines.push(`Radarr instances (${instanceNames.length}):`);
      for (const name of instanceNames) {
        const instance = instances[name] as Record<string, unknown> | undefined;
        if (!instance) continue;
        const details = summarizeInstance(instance);
        lines.push(`  - ${name}: ${details}`);
      }
      lines.push('');
    } else {
      lines.push('Radarr: No instances configured');
      lines.push('');
    }

    // Top-level sections
    const sections = Object.keys(config).filter(
      (k) => k !== 'sonarr' && k !== 'radarr',
    );
    if (sections.length > 0) {
      lines.push(`Other sections: ${sections.join(', ')}`);
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: config,
    };
  },
};

function summarizeInstance(instance: Record<string, unknown>): string {
  const features: string[] = [];

  const baseUrl = instance.base_url ?? instance.baseUrl;
  if (baseUrl) features.push(`url=${baseUrl}`);

  const qualityDef = instance.quality_definition ?? instance.qualityDefinition;
  if (qualityDef) features.push(`quality_definition=${qualityDef}`);

  const qualityProfiles = instance.quality_profiles ?? instance.qualityProfiles;
  if (Array.isArray(qualityProfiles)) {
    features.push(`${qualityProfiles.length} quality profile(s)`);
  }

  const customFormats = instance.custom_formats ?? instance.customFormats;
  if (Array.isArray(customFormats)) {
    let cfCount = 0;
    for (const cf of customFormats) {
      if (cf && typeof cf === 'object' && 'trash_ids' in (cf as Record<string, unknown>)) {
        const ids = (cf as Record<string, unknown>).trash_ids;
        cfCount += Array.isArray(ids) ? ids.length : 0;
      }
    }
    features.push(
      `${customFormats.length} custom format group(s)${cfCount > 0 ? ` (${cfCount} TRaSH IDs)` : ''}`,
    );
  }

  const deleteOld =
    instance.delete_old_custom_formats ?? instance.deleteOldCustomFormats;
  if (deleteOld) features.push('delete_old_custom_formats=true');

  const replaceExisting =
    instance.replace_existing_custom_formats ?? instance.replaceExistingCustomFormats;
  if (replaceExisting) features.push('replace_existing=true');

  return features.length > 0 ? features.join(', ') : 'configured (no details parsed)';
}
