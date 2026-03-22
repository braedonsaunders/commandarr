import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'kometa_validate_config',
  integration: 'kometa',
  description:
    'Validate the Kometa config.yml file. Checks YAML syntax, required sections, library structure, and warns on likely typos.',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Config',
    dangerLevel: 'low',
    testable: false,
  },
  async handler(_params, ctx) {
    const manager = await ctx.getConfigManager('kometa', 'config');
    ctx.log('Validating Kometa config...');

    let data: unknown;
    try {
      data = await manager.read();
    } catch (err) {
      return {
        success: false,
        message: `Failed to parse config file: ${err instanceof Error ? err.message : 'Unknown error'}. Check YAML syntax.`,
      };
    }

    const error = await manager.validate(data);

    if (error === null) {
      const config = data as Record<string, unknown>;
      const libCount = config.libraries
        ? Object.keys(config.libraries as Record<string, unknown>).length
        : 0;
      const sectionCount = Object.keys(config).length;

      return {
        success: true,
        message: `Config is valid. ${sectionCount} sections, ${libCount} libraries configured. No issues found.`,
        data: { valid: true, sections: sectionCount, libraries: libCount },
      };
    }

    // Distinguish errors from warnings
    const isWarningOnly = error.startsWith('Validation passed with warnings');

    return {
      success: isWarningOnly,
      message: isWarningOnly
        ? error
        : `Config validation failed:\n${error}`,
      data: { valid: isWarningOnly, issues: error },
    };
  },
};
