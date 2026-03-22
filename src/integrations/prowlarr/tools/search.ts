import type { ToolDefinition } from '../../_base';

interface SearchResult {
  title: string;
  indexer: string;
  size: string;
  seeders?: number;
  leechers?: number;
  age?: string;
  protocol: string;
  categories: string[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

const categoryMap: Record<string, string> = {
  movie: '2000',
  tv: '5000',
  audio: '3000',
  book: '7000',
};

export const tool: ToolDefinition = {
  name: 'prowlarr_search',
  integration: 'prowlarr',
  description: 'Search across all Prowlarr indexers',
  parameters: {
    type: 'object',
    properties: {
      term: {
        type: 'string',
        description: 'Search term',
      },
      type: {
        type: 'string',
        description: 'Content type filter',
        enum: ['movie', 'tv', 'audio', 'book'],
      },
    },
    required: ['term'],
  },
  ui: {
    category: 'Search',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { term: 'inception' },
  },
  async handler(params, ctx) {
    const { term, type } = params;
    if (!term || typeof term !== 'string') {
      return { success: false, message: 'Search term is required' };
    }

    const client = ctx.getClient('prowlarr');
    ctx.log(`Searching Prowlarr for: ${term}`);

    const queryParams: Record<string, string> = {
      query: term,
      type: 'search',
    };

    if (type && categoryMap[type]) {
      queryParams.categories = categoryMap[type];
    }

    const results = await client.get('/api/v1/search', queryParams);

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: `No results found for "${term}"`,
        data: { results: [] },
      };
    }

    const items: SearchResult[] = results.slice(0, 25).map((r: any) => {
      const item: SearchResult = {
        title: r.title ?? 'Unknown',
        indexer: r.indexer ?? 'Unknown',
        size: formatBytes(r.size ?? 0),
        protocol: r.protocol ?? 'unknown',
        categories: (r.categories ?? []).map((c: any) => c.name ?? 'Unknown'),
      };

      if (r.protocol === 'torrent') {
        item.seeders = r.seeders ?? 0;
        item.leechers = r.leechers ?? 0;
      } else {
        item.age = r.age != null ? `${r.age}d` : undefined;
      }

      return item;
    });

    const summary = items
      .map((r) => {
        let detail = `${r.size}`;
        if (r.seeders != null) {
          detail += `, S:${r.seeders}/L:${r.leechers}`;
        } else if (r.age) {
          detail += `, age: ${r.age}`;
        }
        return `- ${r.title} [${r.indexer}] (${detail})`;
      })
      .join('\n');

    return {
      success: true,
      message: `Found ${results.length} result(s) for "${term}":\n${summary}`,
      data: { results: items },
    };
  },
};
