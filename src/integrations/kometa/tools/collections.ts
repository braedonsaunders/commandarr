import type { ToolDefinition } from '../../_base';

interface Collection {
  name: string;
  library: string;
  type: string;
  itemCount: number;
  lastUpdated?: string;
  description?: string;
}

export const tool: ToolDefinition = {
  name: 'kometa_collections',
  integration: 'kometa',
  description: 'List all Kometa-managed collections across libraries, including item counts and collection types (smart/manual)',
  parameters: {
    type: 'object',
    properties: {
      library: {
        type: 'string',
        description: 'Optional: filter collections by library name',
      },
    },
  },
  ui: {
    category: 'Collections',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('kometa');
    ctx.log('Fetching Kometa collections...');

    const response = await client.get('/api/v1/collections');

    const rawCollections = Array.isArray(response)
      ? response
      : response.collections ?? response.data ?? [];

    let collections: Collection[] = rawCollections.map((c: any) => ({
      name: c.name ?? c.title ?? 'Unnamed',
      library: c.library ?? c.library_name ?? c.libraryName ?? 'Unknown',
      type: c.type ?? c.collection_type ?? c.collectionType ?? 'manual',
      itemCount: c.item_count ?? c.itemCount ?? c.count ?? 0,
      lastUpdated: c.last_updated ?? c.lastUpdated,
      description: c.description,
    }));

    // Filter by library if specified
    if (params.library && typeof params.library === 'string') {
      const filterLib = params.library.toLowerCase();
      collections = collections.filter(
        (c) => c.library.toLowerCase().includes(filterLib),
      );
    }

    if (collections.length === 0) {
      const filterNote = params.library ? ` matching library "${params.library}"` : '';
      return {
        success: true,
        message: `No managed collections found${filterNote}`,
        data: { collections: [] },
      };
    }

    // Group by library for readability
    const byLibrary: Record<string, Collection[]> = {};
    for (const col of collections) {
      if (!byLibrary[col.library]) {
        byLibrary[col.library] = [];
      }
      byLibrary[col.library].push(col);
    }

    const lines: string[] = [];
    for (const [library, cols] of Object.entries(byLibrary)) {
      lines.push(`${library} (${cols.length} collection${cols.length !== 1 ? 's' : ''}):`);
      for (const col of cols) {
        lines.push(
          `  - ${col.name} [${col.type}] (${col.itemCount} item${col.itemCount !== 1 ? 's' : ''})`,
        );
      }
    }

    return {
      success: true,
      message: `${collections.length} managed collection(s) across ${Object.keys(byLibrary).length} library/libraries:\n${lines.join('\n')}`,
      data: { collections, byLibrary: Object.keys(byLibrary) },
    };
  },
};
