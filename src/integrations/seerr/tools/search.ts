import type { ToolDefinition } from '../../_base';

interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  originalTitle?: string;
  originalName?: string;
  overview?: string;
  releaseDate?: string;
  firstAirDate?: string;
  mediaType: string;
  mediaInfo?: {
    status: number;
    requests?: { status: number }[];
  };
}

function mediaRequestStatus(result: SearchResult): string {
  if (!result.mediaInfo) return 'Not Requested';
  switch (result.mediaInfo.status) {
    case 2:
      return 'Pending';
    case 3:
      return 'Processing';
    case 4:
      return 'Partially Available';
    case 5:
      return 'Available';
    default:
      return 'Requested';
  }
}

function getYear(result: SearchResult): string {
  const date = result.releaseDate ?? result.firstAirDate;
  if (!date) return 'N/A';
  return date.slice(0, 4);
}

export const tool: ToolDefinition = {
  name: 'seerr_search',
  integration: 'seerr',
  description:
    'Search for movies and TV shows in Seerr (Overseerr/Jellyseerr)',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search term (movie or TV show title)',
      },
    },
    required: ['query'],
  },
  ui: {
    category: 'Search',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { query: 'inception' },
  },
  async handler(params, ctx) {
    const { query } = params;
    if (!query || typeof query !== 'string') {
      return { success: false, message: 'Search query is required' };
    }

    const client = ctx.getClient('seerr');
    ctx.log(`Searching Seerr for: ${query}`);

    const response = await client.get('/api/v1/search', {
      query,
      page: '1',
    });

    const results: SearchResult[] = response.results ?? response ?? [];

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: `No results found for "${query}"`,
        data: { results: [] },
      };
    }

    const items = results.slice(0, 15).map((r) => ({
      id: r.id,
      title: r.title ?? r.name ?? r.originalTitle ?? r.originalName ?? 'Unknown',
      year: getYear(r),
      mediaType: r.mediaType,
      overview: r.overview?.slice(0, 150),
      requestStatus: mediaRequestStatus(r),
    }));

    const summary = items
      .map(
        (r) =>
          `- ${r.title} (${r.year}) [${r.mediaType}] - ${r.requestStatus}`,
      )
      .join('\n');

    return {
      success: true,
      message: `Found ${results.length} result(s) for "${query}":\n${summary}`,
      data: { results: items },
    };
  },
};
