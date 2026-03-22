import type { ToolDefinition } from '../../_base';

interface MissingBook {
  authorName: string;
  bookTitle: string;
  releaseDate: string;
  monitored: boolean;
}

export const tool: ToolDefinition = {
  name: 'readarr_missing_books',
  integration: 'readarr',
  description:
    'Find missing books in your Readarr library. Shows gaps in your book collection — books that have been released but are not downloaded.',
  parameters: {
    type: 'object',
    properties: {
      authorId: {
        type: 'number',
        description:
          'Filter to a specific author ID. If not set, checks all monitored authors.',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default: 50)',
      },
    },
  },
  ui: {
    category: 'Content Gaps',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const { authorId, limit = 50 } = params;

    const client = ctx.getClient('readarr');
    ctx.log('Scanning for missing books...');

    const queryParams: Record<string, string> = {
      page: '1',
      pageSize: String(Math.min(limit, 100)),
      sortKey: 'title',
      sortDirection: 'ascending',
      includeAuthor: 'true',
      monitored: 'true',
    };

    if (authorId) {
      queryParams.authorId = String(authorId);
    }

    const response = await client.get('/api/v1/wanted/missing', queryParams);
    const records = response.records ?? [];
    const totalRecords = response.totalRecords ?? 0;

    if (!Array.isArray(records) || records.length === 0) {
      return {
        success: true,
        message: 'No missing books found. Your book library is complete!',
        data: { missing: [], totalMissing: 0 },
      };
    }

    const missing: MissingBook[] = records.map((book: any) => ({
      authorName: book.author?.authorName ?? 'Unknown',
      bookTitle: book.title ?? 'Unknown',
      releaseDate: book.releaseDate
        ? new Date(book.releaseDate).toLocaleDateString()
        : 'unknown',
      monitored: book.monitored ?? false,
    }));

    // Group by author for a cleaner summary
    const byAuthor: Record<string, MissingBook[]> = {};
    for (const book of missing) {
      if (!byAuthor[book.authorName]) {
        byAuthor[book.authorName] = [];
      }
      byAuthor[book.authorName].push(book);
    }

    const summary = Object.entries(byAuthor)
      .map(([author, books]) => {
        const bookList = books
          .slice(0, 5)
          .map(
            (b) =>
              `  - ${b.bookTitle} (released ${b.releaseDate})`,
          )
          .join('\n');
        const extra =
          books.length > 5
            ? `\n  ...and ${books.length - 5} more`
            : '';
        return `- ${author} (${books.length} missing):\n${bookList}${extra}`;
      })
      .join('\n');

    return {
      success: true,
      message: `${totalRecords} missing book(s) across ${Object.keys(byAuthor).length} author(s):\n${summary}${totalRecords > missing.length ? `\n\n(Showing ${missing.length} of ${totalRecords} total)` : ''}`,
      data: {
        missing,
        totalMissing: totalRecords,
        authorCount: Object.keys(byAuthor).length,
        byAuthor: Object.fromEntries(
          Object.entries(byAuthor).map(([k, v]) => [k, v.length]),
        ),
      },
    };
  },
};
