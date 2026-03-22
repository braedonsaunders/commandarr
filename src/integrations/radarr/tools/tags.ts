import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'radarr_tags',
  integration: 'radarr',
  description:
    'List, create, or delete tags in Radarr. Tags can be used to organize movies and apply settings to groups.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: '"list" to view all tags, "create" to add a new tag, "delete" to remove a tag',
        enum: ['list', 'create', 'delete'],
      },
      label: {
        type: 'string',
        description: 'Tag name/label (required for "create")',
      },
      tagId: {
        type: 'number',
        description: 'Tag ID to delete (required for "delete")',
      },
    },
    required: ['action'],
  },
  ui: {
    category: 'Configuration',
    dangerLevel: 'medium',
    testable: true,
    testDefaults: { action: 'list' },
  },
  async handler(params, ctx) {
    const { action, label, tagId } = params;
    const client = ctx.getClient('radarr');

    if (action === 'create') {
      if (!label) {
        return { success: false, message: 'label is required to create a tag' };
      }
      ctx.log(`Creating tag: ${label}`);
      const tag = await client.post('/api/v3/tag', { label });
      return {
        success: true,
        message: `Tag created: "${tag.label}" (ID: ${tag.id})`,
        data: { id: tag.id, label: tag.label },
      };
    }

    if (action === 'delete') {
      if (!tagId) {
        return { success: false, message: 'tagId is required to delete a tag' };
      }
      ctx.log(`Deleting tag ${tagId}...`);
      await client.delete(`/api/v3/tag/${tagId}`);
      return {
        success: true,
        message: `Tag ${tagId} deleted.`,
        data: { tagId },
      };
    }

    // List
    ctx.log('Fetching Radarr tags...');
    const tags: any[] = await client.get('/api/v3/tag');

    if (!Array.isArray(tags) || tags.length === 0) {
      return {
        success: true,
        message: 'No tags configured in Radarr.',
        data: { tags: [] },
      };
    }

    const lines = tags.map((t: any) => `- ${t.label} (ID: ${t.id})`);

    return {
      success: true,
      message: `${tags.length} tag(s):\n${lines.join('\n')}`,
      data: { tags: tags.map((t: any) => ({ id: t.id, label: t.label })) },
    };
  },
};
