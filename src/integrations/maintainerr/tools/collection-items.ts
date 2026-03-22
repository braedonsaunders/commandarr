import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'maintainerr_collection_items',
  integration: 'maintainerr',
  description:
    'Get items in a specific Maintainerr-managed collection with title, added date, scheduled removal date, and watch status',
  parameters: {
    type: 'object',
    properties: {
      collectionId: {
        type: 'number',
        description: 'The ID of the collection to get items for',
      },
    },
    required: ['collectionId'],
  },
  ui: {
    category: 'Collections',
    dangerLevel: 'low',
    testable: false,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('maintainerr');
    const { collectionId } = params;
    ctx.log(`Fetching items for collection #${collectionId}...`);

    const [collection, media] = await Promise.all([
      client.get(`/collections/${collectionId}`),
      client.get(`/collections/${collectionId}/media`).catch(() => null),
    ]);

    if (!collection) {
      return {
        success: false,
        message: `Collection #${collectionId} not found`,
      };
    }

    const collectionName = collection.title ?? collection.name ?? `Collection #${collectionId}`;
    const items = media ?? collection.media ?? [];

    if (!Array.isArray(items) || items.length === 0) {
      return {
        success: true,
        message: `Collection "${collectionName}" has no items.`,
        data: { collection: collectionName, items: [] },
      };
    }

    const lines = [`Collection: ${collectionName}`, `Total items: ${items.length}`, ''];

    items.forEach((item: any) => {
      const title = item.title ?? item.name ?? 'Unknown';
      const year = item.year ? ` (${item.year})` : '';
      const addedDate = item.addDate ?? item.createdAt ?? item.addedAt ?? null;
      const removalDate = item.removalDate ?? item.scheduledRemoval ?? item.deleteAfter ?? null;
      const watched = item.watched ?? item.isWatched ?? null;

      const parts = [`- ${title}${year}`];

      if (addedDate) {
        parts.push(`  Added: ${new Date(addedDate).toLocaleDateString()}`);
      }
      if (removalDate) {
        parts.push(`  Scheduled removal: ${new Date(removalDate).toLocaleDateString()}`);
      }
      if (watched !== null) {
        parts.push(`  Watched: ${watched ? 'Yes' : 'No'}`);
      }

      lines.push(parts.join('\n'));
    });

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        collection: collectionName,
        itemCount: items.length,
        items: items.map((item: any) => ({
          title: item.title ?? item.name ?? 'Unknown',
          year: item.year ?? null,
          addedDate: item.addDate ?? item.createdAt ?? item.addedAt ?? null,
          removalDate: item.removalDate ?? item.scheduledRemoval ?? item.deleteAfter ?? null,
          watched: item.watched ?? item.isWatched ?? null,
        })),
      },
    };
  },
};
