import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'maintainerr_collections',
  integration: 'maintainerr',
  description:
    'List all Maintainerr-managed Plex collections including "Leaving Soon" collections with item counts and dates',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Collections',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('maintainerr');
    ctx.log('Fetching Maintainerr collections...');

    const collections = await client.get('/collections');

    if (!Array.isArray(collections) || collections.length === 0) {
      return {
        success: true,
        message: 'No Maintainerr-managed collections found.',
        data: { collections: [] },
      };
    }

    const formatted = collections.map((col: any) => {
      const name = col.title ?? col.name ?? `Collection #${col.id}`;
      const itemCount = col.media?.length ?? col.mediaCount ?? col.itemCount ?? 0;
      const createdAt = col.createdAt ?? col.addDate ?? null;
      const isLeavingSoon =
        name.toLowerCase().includes('leaving') ||
        col.type === 'leaving_soon' ||
        col.isLeavingSoon === true;
      const tag = isLeavingSoon ? ' [Leaving Soon]' : '';
      const dateStr = createdAt
        ? ` | Created: ${new Date(createdAt).toLocaleDateString()}`
        : '';
      const libraryName = col.libraryName ?? col.library ?? '';
      const libraryStr = libraryName ? ` | Library: ${libraryName}` : '';

      return `[${col.id}] ${name}${tag}\n  Items: ${itemCount}${libraryStr}${dateStr}`;
    });

    const summary = `Found ${collections.length} collection(s):\n\n${formatted.join('\n\n')}`;

    return {
      success: true,
      message: summary,
      data: {
        collections: collections.map((col: any) => ({
          id: col.id,
          name: col.title ?? col.name ?? `Collection #${col.id}`,
          itemCount: col.media?.length ?? col.mediaCount ?? col.itemCount ?? 0,
          createdAt: col.createdAt ?? col.addDate ?? null,
          libraryName: col.libraryName ?? col.library ?? null,
        })),
      },
    };
  },
};
