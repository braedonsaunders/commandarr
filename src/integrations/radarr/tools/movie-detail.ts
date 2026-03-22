import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'radarr_movie_detail',
  integration: 'radarr',
  description:
    'Look up a movie in your Radarr library by name or ID. Returns download status, quality, file size, and availability info. Use this to check if you have a specific movie downloaded.',
  parameters: {
    type: 'object',
    properties: {
      term: {
        type: 'string',
        description:
          'Search term to match against movie titles in your library (case-insensitive partial match)',
      },
      movieId: {
        type: 'number',
        description: 'Radarr movie ID for exact lookup',
      },
    },
  },
  ui: {
    category: 'Movies',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { term: 'inception' },
  },
  async handler(params, ctx) {
    const { term, movieId } = params;

    if (!term && !movieId) {
      return {
        success: false,
        message:
          'Provide either a search term or a movieId to look up a movie.',
      };
    }

    const client = ctx.getClient('radarr');

    let movie: any;

    if (movieId) {
      ctx.log(`Looking up movie ID ${movieId}`);
      try {
        movie = await client.get(`/api/v3/movie/${movieId}`);
      } catch {
        return {
          success: false,
          message: `No movie found with ID ${movieId}`,
        };
      }
    } else {
      ctx.log(`Searching library for: ${term}`);
      const allMovies: any[] = await client.get('/api/v3/movie');
      const needle = term!.toLowerCase();
      const matches = allMovies.filter((m: any) =>
        m.title?.toLowerCase().includes(needle),
      );

      if (matches.length === 0) {
        return {
          success: true,
          message: `No movie matching "${term}" found in your Radarr library. It may not be added yet — use radarr_search to find it externally.`,
          data: { found: false },
        };
      }

      if (matches.length > 1) {
        const list = matches
          .slice(0, 10)
          .map(
            (m: any) =>
              `- ${m.title} (${m.year}) [ID: ${m.id}] — ${m.hasFile ? 'Downloaded' : 'Missing'}`,
          )
          .join('\n');
        return {
          success: true,
          message: `Multiple matches for "${term}":\n${list}\n\nUse movieId for an exact lookup.`,
          data: {
            found: true,
            multiple: true,
            matches: matches.slice(0, 10).map((m: any) => ({
              id: m.id,
              title: m.title,
              year: m.year,
              hasFile: m.hasFile,
            })),
          },
        };
      }

      movie = matches[0];
    }

    const hasFile = movie.hasFile ?? false;
    const movieFile = movie.movieFile;
    const sizeOnDisk = movie.sizeOnDisk ?? movieFile?.size ?? 0;

    const lines = [
      `${movie.title} (${movie.year}) — ${movie.status}`,
      `Downloaded: ${hasFile ? 'Yes' : 'No'}`,
    ];

    if (hasFile && movieFile) {
      lines.push(
        `Quality: ${movieFile.quality?.quality?.name ?? 'Unknown'}`,
        `Size: ${formatBytes(sizeOnDisk)}`,
        `File: ${movieFile.relativePath ?? 'Unknown'}`,
      );
    } else {
      lines.push(
        `Available: ${movie.isAvailable ? 'Yes — can be searched for download' : 'No — not yet released'}`,
      );
    }

    lines.push(
      `Monitored: ${movie.monitored ? 'Yes' : 'No'}`,
      `TMDB: ${movie.tmdbId}${movie.imdbId ? ` | IMDB: ${movie.imdbId}` : ''}`,
    );

    if (movie.overview) {
      lines.push('', movie.overview.slice(0, 200));
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        found: true,
        id: movie.id,
        title: movie.title,
        year: movie.year,
        status: movie.status,
        hasFile,
        monitored: movie.monitored,
        tmdbId: movie.tmdbId,
        imdbId: movie.imdbId,
        isAvailable: movie.isAvailable,
        sizeOnDisk: formatBytes(sizeOnDisk),
        quality: movieFile?.quality?.quality?.name,
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
