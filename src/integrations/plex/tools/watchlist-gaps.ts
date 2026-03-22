import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'plex_watchlist_gaps',
  integration: 'plex',
  description:
    'Compare Plex watchlist items against your library to find content on your watchlist that is not yet in your Plex library. Requires Plex token with watchlist access.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description:
          'Filter by type: "movie", "show", or "all" (default: "all")',
      },
    },
  },
  ui: {
    category: 'Content Gaps',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const { type: filterType = 'all' } = params;

    const client = ctx.getClient('plex');
    ctx.log('Fetching watchlist and comparing against library...');

    // Step 1: Get all library sections to know what we have
    let libraryResponse: any;
    try {
      libraryResponse = await client.get('/library/sections');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Failed to fetch Plex libraries: ${msg}`,
      };
    }

    // Parse library sections
    const sections: any[] = [];
    if (libraryResponse?.MediaContainer?.Directory) {
      const dirs = Array.isArray(libraryResponse.MediaContainer.Directory)
        ? libraryResponse.MediaContainer.Directory
        : [libraryResponse.MediaContainer.Directory];
      for (const d of dirs) {
        sections.push({
          key: d.key,
          title: d.title,
          type: d.type,
        });
      }
    } else if (libraryResponse?._xml) {
      // XML fallback
      const dirMatches = libraryResponse._xml.matchAll(
        /<Directory[^>]*\skey="([^"]*)"[^>]*\stitle="([^"]*)"[^>]*\stype="([^"]*)"/g,
      );
      for (const match of dirMatches) {
        sections.push({ key: match[1], title: match[2], type: match[3] });
      }
    }

    // Step 2: Build a set of titles in the library for matching
    const libraryTitles = new Set<string>();
    const libraryTitlesWithYear = new Set<string>();

    for (const section of sections) {
      if (
        filterType !== 'all' &&
        ((filterType === 'movie' && section.type !== 'movie') ||
          (filterType === 'show' && section.type !== 'show'))
      ) {
        continue;
      }

      try {
        const contents = await client.get(
          `/library/sections/${section.key}/all`,
        );
        const items =
          contents?.MediaContainer?.Metadata ??
          contents?.MediaContainer?.Video ??
          contents?.MediaContainer?.Directory ??
          [];
        const itemArray = Array.isArray(items) ? items : [items];

        for (const item of itemArray) {
          const title = (item.title ?? '').toLowerCase().trim();
          const year = item.year;
          if (title) {
            libraryTitles.add(title);
            if (year) {
              libraryTitlesWithYear.add(`${title}::${year}`);
            }
          }
        }
      } catch {
        ctx.log(`Failed to read library section: ${section.title}`);
      }
    }

    // Step 3: Fetch watchlist from Plex discover API
    let watchlistItems: any[] = [];
    try {
      // The watchlist endpoint uses the Plex metadata API
      const watchlistResponse = await client.get(
        '/library/sections/watchlist/all',
      );
      const items =
        watchlistResponse?.MediaContainer?.Metadata ??
        watchlistResponse?.MediaContainer?.Video ??
        [];
      watchlistItems = Array.isArray(items) ? items : [items];
    } catch {
      // Try alternative watchlist endpoint
      try {
        const watchlistResponse = await client.get(
          '/playlists/all?type=15&playlistType=video&smart=0',
        );
        const playlists =
          watchlistResponse?.MediaContainer?.Metadata ?? [];
        const playlistArray = Array.isArray(playlists)
          ? playlists
          : [playlists];
        const watchlistPlaylist = playlistArray.find(
          (p: any) =>
            p.title?.toLowerCase() === 'watchlist' ||
            p.smart === false,
        );
        if (watchlistPlaylist) {
          const playlistContent = await client.get(
            `/playlists/${watchlistPlaylist.ratingKey}/items`,
          );
          watchlistItems =
            playlistContent?.MediaContainer?.Metadata ?? [];
          if (!Array.isArray(watchlistItems))
            watchlistItems = [watchlistItems];
        }
      } catch {
        return {
          success: false,
          message:
            'Unable to access Plex watchlist. This feature requires a Plex account with watchlist enabled. Make sure your Plex token has access to the watchlist API.',
        };
      }
    }

    if (watchlistItems.length === 0) {
      return {
        success: true,
        message: 'Watchlist is empty or could not be accessed.',
        data: { gaps: [], inLibrary: [], totalWatchlist: 0 },
      };
    }

    // Step 4: Compare watchlist against library
    const gaps: any[] = [];
    const inLibrary: any[] = [];

    for (const item of watchlistItems) {
      const title = (item.title ?? '').toLowerCase().trim();
      const year = item.year;
      const mediaType = item.type ?? 'unknown';

      if (
        filterType !== 'all' &&
        ((filterType === 'movie' && mediaType !== 'movie') ||
          (filterType === 'show' && mediaType !== 'show'))
      ) {
        continue;
      }

      // Check by title+year first (more accurate), then title alone
      const inLib =
        (year && libraryTitlesWithYear.has(`${title}::${year}`)) ||
        libraryTitles.has(title);

      const entry = {
        title: item.title ?? 'Unknown',
        year: year ?? 'unknown',
        type: mediaType,
        summary: (item.summary ?? '').slice(0, 100),
      };

      if (inLib) {
        inLibrary.push(entry);
      } else {
        gaps.push(entry);
      }
    }

    if (gaps.length === 0) {
      return {
        success: true,
        message: `All ${watchlistItems.length} watchlist items are already in your library!`,
        data: { gaps: [], inLibrary, totalWatchlist: watchlistItems.length },
      };
    }

    const summary = gaps
      .map(
        (g) =>
          `- ${g.title} (${g.year}) [${g.type}]${g.summary ? ` — ${g.summary}` : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${gaps.length} watchlist item(s) NOT in your library:\n${summary}\n\n${inLibrary.length} watchlist item(s) already in library.`,
      data: {
        gaps,
        inLibrary,
        totalWatchlist: watchlistItems.length,
        missingCount: gaps.length,
        presentCount: inLibrary.length,
      },
    };
  },
};
