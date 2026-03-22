import type { ToolDefinition } from '../../_base';

interface ArtistResult {
  artistName: string;
  overview: string;
  foreignArtistId: string;
  genres: string[];
  status: string;
  statistics?: { albumCount: number };
  images?: { coverType: string; remoteUrl: string }[];
}

export const tool: ToolDefinition = {
  name: 'lidarr_search',
  integration: 'lidarr',
  description: 'Search for artists to add to Lidarr',
  parameters: {
    type: 'object',
    properties: {
      term: {
        type: 'string',
        description: 'Search term (artist name)',
      },
    },
    required: ['term'],
  },
  ui: {
    category: 'Music',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { term: 'radiohead' },
  },
  async handler(params, ctx) {
    const { term } = params;
    if (!term || typeof term !== 'string') {
      return { success: false, message: 'Search term is required' };
    }

    const client = ctx.getClient('lidarr');
    ctx.log(`Searching Lidarr for: ${term}`);

    const results: ArtistResult[] = await client.get(
      `/api/v1/artist/lookup`,
      { term },
    );

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: `No artists found for "${term}"`,
        data: { results: [] },
      };
    }

    const artists = results.slice(0, 15).map((a) => ({
      artistName: a.artistName,
      overview: a.overview?.slice(0, 150),
      foreignArtistId: a.foreignArtistId,
      genres: a.genres ?? [],
      status: a.status,
      albumCount: a.statistics?.albumCount ?? 0,
    }));

    const summary = artists
      .map(
        (a) =>
          `- ${a.artistName} [MusicBrainz: ${a.foreignArtistId}] (${a.status}, ${a.albumCount} albums${a.genres.length > 0 ? `, ${a.genres.slice(0, 3).join('/')}` : ''})`,
      )
      .join('\n');

    return {
      success: true,
      message: `Found ${results.length} artist(s) for "${term}":\n${summary}`,
      data: { results: artists },
    };
  },
};
