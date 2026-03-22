import type { ToolDefinition } from '../../_base';

interface AuthorResult {
  authorName: string;
  overview: string;
  foreignAuthorId: string;
  genres: string[];
  status: string;
  statistics?: { bookCount: number };
  images?: { coverType: string; remoteUrl: string }[];
}

export const tool: ToolDefinition = {
  name: 'readarr_search',
  integration: 'readarr',
  description: 'Search for authors to add to Readarr',
  parameters: {
    type: 'object',
    properties: {
      term: {
        type: 'string',
        description: 'Search term (author name)',
      },
    },
    required: ['term'],
  },
  ui: {
    category: 'Books',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { term: 'stephen king' },
  },
  async handler(params, ctx) {
    const { term } = params;
    if (!term || typeof term !== 'string') {
      return { success: false, message: 'Search term is required' };
    }

    const client = ctx.getClient('readarr');
    ctx.log(`Searching Readarr for: ${term}`);

    const results: AuthorResult[] = await client.get(
      `/api/v1/author/lookup`,
      { term },
    );

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: `No authors found for "${term}"`,
        data: { results: [] },
      };
    }

    const authors = results.slice(0, 15).map((a) => ({
      authorName: a.authorName,
      overview: a.overview?.slice(0, 150),
      foreignAuthorId: a.foreignAuthorId,
      genres: a.genres ?? [],
      status: a.status,
      bookCount: a.statistics?.bookCount ?? 0,
    }));

    const summary = authors
      .map(
        (a) =>
          `- ${a.authorName} [GoodReads: ${a.foreignAuthorId}] (${a.status}, ${a.bookCount} books${a.genres.length > 0 ? `, ${a.genres.slice(0, 3).join('/')}` : ''})`,
      )
      .join('\n');

    return {
      success: true,
      message: `Found ${results.length} author(s) for "${term}":\n${summary}`,
      data: { results: authors },
    };
  },
};
