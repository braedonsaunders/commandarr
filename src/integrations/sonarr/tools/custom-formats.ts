import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'sonarr_custom_formats',
  integration: 'sonarr',
  description:
    'List all custom formats configured in Sonarr. Shows format names, conditions, and whether they are included in renaming.',
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
    const client = ctx.getClient('sonarr');
    ctx.log('Fetching Sonarr custom formats...');

    const formats: any[] = await client.get('/api/v3/customformat');

    if (!Array.isArray(formats) || formats.length === 0) {
      return {
        success: true,
        message: 'No custom formats configured in Sonarr.',
        data: { customFormats: [] },
      };
    }

    const formatted = formats.map((cf: any) => ({
      id: cf.id,
      name: cf.name ?? 'Unknown',
      includeCustomFormatWhenRenaming: cf.includeCustomFormatWhenRenaming ?? false,
      conditionCount: (cf.specifications ?? []).length,
      conditions: (cf.specifications ?? []).map((s: any) => ({
        name: s.name,
        implementation: s.implementation,
        negate: s.negate ?? false,
        required: s.required ?? false,
      })),
    }));

    const lines = formatted.map(
      (cf) =>
        `- ${cf.name} (ID: ${cf.id}) — ${cf.conditionCount} condition(s)${cf.includeCustomFormatWhenRenaming ? ' [in rename]' : ''}`,
    );

    return {
      success: true,
      message: `${formatted.length} custom format(s):\n${lines.join('\n')}`,
      data: { customFormats: formatted },
    };
  },
};
