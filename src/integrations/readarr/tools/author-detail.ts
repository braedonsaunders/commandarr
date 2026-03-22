import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'readarr_author_detail',
  integration: 'readarr',
  description:
    'Look up an author already in your Readarr library by name or ID. Returns book counts, download status, and disk usage. Use this to answer questions like "how many books by X do I have?" or "is X fully downloaded?"',
  parameters: {
    type: 'object',
    properties: {
      term: {
        type: 'string',
        description:
          'Search term to match against author names in your library (case-insensitive partial match)',
      },
      authorId: {
        type: 'number',
        description: 'Readarr author ID for exact lookup',
      },
    },
  },
  ui: {
    category: 'Books',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { term: 'king' },
  },
  async handler(params, ctx) {
    const { term, authorId } = params;

    if (!term && !authorId) {
      return {
        success: false,
        message:
          'Provide either a search term or an authorId to look up an author.',
      };
    }

    const client = ctx.getClient('readarr');

    let author: any;

    if (authorId) {
      ctx.log(`Looking up author ID ${authorId}`);
      try {
        author = await client.get(`/api/v1/author/${authorId}`);
      } catch {
        return {
          success: false,
          message: `No author found with ID ${authorId}`,
        };
      }
    } else {
      ctx.log(`Searching library for: ${term}`);
      const allAuthors: any[] = await client.get('/api/v1/author');
      const needle = term!.toLowerCase();
      const matches = allAuthors.filter((a: any) =>
        a.authorName?.toLowerCase().includes(needle),
      );

      if (matches.length === 0) {
        return {
          success: true,
          message: `No author matching "${term}" found in your Readarr library. It may not be added yet — use readarr_search to find it externally.`,
          data: { found: false },
        };
      }

      if (matches.length > 1) {
        const list = matches
          .slice(0, 10)
          .map(
            (a: any) =>
              `- ${a.authorName} [ID: ${a.id}] — ${a.statistics?.bookFileCount ?? 0}/${a.statistics?.bookCount ?? 0} books`,
          )
          .join('\n');
        return {
          success: true,
          message: `Multiple matches for "${term}":\n${list}\n\nUse authorId for an exact lookup.`,
          data: {
            found: true,
            multiple: true,
            matches: matches.slice(0, 10).map((a: any) => ({
              id: a.id,
              authorName: a.authorName,
            })),
          },
        };
      }

      author = matches[0];
    }

    // Fetch books for this author
    const books: any[] = await client.get('/api/v1/book', {
      authorId: String(author.id),
    });

    const bookLines = books
      .sort((a: any, b: any) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''))
      .map((b: any) => {
        const releaseDate = b.releaseDate
          ? new Date(b.releaseDate).toLocaleDateString()
          : 'Unknown';
        const status = b.statistics?.bookFileCount > 0 ? 'downloaded' : 'missing';
        return `  - ${b.title} (${releaseDate}) — ${status}`;
      })
      .join('\n');

    const bookCount = author.statistics?.bookCount ?? books.length;
    const bookFileCount = author.statistics?.bookFileCount ?? 0;
    const sizeOnDisk = author.statistics?.sizeOnDisk ?? 0;
    const sizeStr = formatBytes(sizeOnDisk);

    const percentComplete =
      bookCount > 0
        ? Math.round((bookFileCount / bookCount) * 100)
        : 100;

    const summary = [
      `${author.authorName} — ${author.status ?? 'unknown'}`,
      `${bookFileCount}/${bookCount} books downloaded (${percentComplete}%)`,
      `Size on disk: ${sizeStr}`,
      `Monitored: ${author.monitored ? 'Yes' : 'No'}`,
      '',
      'Books:',
      bookLines,
    ].join('\n');

    return {
      success: true,
      message: summary,
      data: {
        found: true,
        id: author.id,
        authorName: author.authorName,
        status: author.status,
        monitored: author.monitored,
        bookCount,
        bookFileCount,
        percentComplete,
        sizeOnDisk: sizeStr,
        books: books.map((b: any) => ({
          id: b.id,
          title: b.title,
          releaseDate: b.releaseDate,
          hasFile: (b.statistics?.bookFileCount ?? 0) > 0,
        })),
      },
    };
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
