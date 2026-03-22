import type { ToolDefinition } from '../../_base';

interface MissingAlbum {
  artistName: string;
  albumTitle: string;
  releaseDate: string;
  monitored: boolean;
}

export const tool: ToolDefinition = {
  name: 'lidarr_missing_albums',
  integration: 'lidarr',
  description:
    'Find missing albums in your Lidarr library. Shows gaps in your music collection — albums that have been released but are not downloaded.',
  parameters: {
    type: 'object',
    properties: {
      artistId: {
        type: 'number',
        description:
          'Filter to a specific artist ID. If not set, checks all monitored artists.',
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
    const { artistId, limit = 50 } = params;

    const client = ctx.getClient('lidarr');
    ctx.log('Scanning for missing albums...');

    const queryParams: Record<string, string> = {
      page: '1',
      pageSize: String(Math.min(limit, 100)),
      sortKey: 'albums.title',
      sortDirection: 'ascending',
      includeSeries: 'true',
      monitored: 'true',
    };

    if (artistId) {
      queryParams.artistId = String(artistId);
    }

    const response = await client.get('/api/v1/wanted/missing', queryParams);
    const records = response.records ?? [];
    const totalRecords = response.totalRecords ?? 0;

    if (!Array.isArray(records) || records.length === 0) {
      return {
        success: true,
        message: 'No missing albums found. Your music library is complete!',
        data: { missing: [], totalMissing: 0 },
      };
    }

    const missing: MissingAlbum[] = records.map((album: any) => ({
      artistName: album.artist?.artistName ?? 'Unknown',
      albumTitle: album.title ?? 'Unknown',
      releaseDate: album.releaseDate
        ? new Date(album.releaseDate).toLocaleDateString()
        : 'unknown',
      monitored: album.monitored ?? false,
    }));

    // Group by artist for a cleaner summary
    const byArtist: Record<string, MissingAlbum[]> = {};
    for (const album of missing) {
      if (!byArtist[album.artistName]) {
        byArtist[album.artistName] = [];
      }
      byArtist[album.artistName].push(album);
    }

    const summary = Object.entries(byArtist)
      .map(([artist, albums]) => {
        const albumList = albums
          .slice(0, 5)
          .map(
            (a) =>
              `  - ${a.albumTitle} (released ${a.releaseDate})`,
          )
          .join('\n');
        const extra =
          albums.length > 5
            ? `\n  ...and ${albums.length - 5} more`
            : '';
        return `- ${artist} (${albums.length} missing):\n${albumList}${extra}`;
      })
      .join('\n');

    return {
      success: true,
      message: `${totalRecords} missing album(s) across ${Object.keys(byArtist).length} artist(s):\n${summary}${totalRecords > missing.length ? `\n\n(Showing ${missing.length} of ${totalRecords} total)` : ''}`,
      data: {
        missing,
        totalMissing: totalRecords,
        artistCount: Object.keys(byArtist).length,
        byArtist: Object.fromEntries(
          Object.entries(byArtist).map(([k, v]) => [k, v.length]),
        ),
      },
    };
  },
};
