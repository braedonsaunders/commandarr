import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'lidarr_artist_detail',
  integration: 'lidarr',
  description:
    'Look up an artist already in your Lidarr library by name or ID. Returns album counts, download status, and disk usage. Use this to answer questions like "how many albums of X do I have?" or "is X fully downloaded?"',
  parameters: {
    type: 'object',
    properties: {
      term: {
        type: 'string',
        description:
          'Search term to match against artist names in your library (case-insensitive partial match)',
      },
      artistId: {
        type: 'number',
        description: 'Lidarr artist ID for exact lookup',
      },
    },
  },
  ui: {
    category: 'Music',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { term: 'radiohead' },
  },
  async handler(params, ctx) {
    const { term, artistId } = params;

    if (!term && !artistId) {
      return {
        success: false,
        message:
          'Provide either a search term or an artistId to look up an artist.',
      };
    }

    const client = ctx.getClient('lidarr');

    let artist: any;

    if (artistId) {
      ctx.log(`Looking up artist ID ${artistId}`);
      try {
        artist = await client.get(`/api/v1/artist/${artistId}`);
      } catch {
        return {
          success: false,
          message: `No artist found with ID ${artistId}`,
        };
      }
    } else {
      ctx.log(`Searching library for: ${term}`);
      const allArtists: any[] = await client.get('/api/v1/artist');
      const needle = term!.toLowerCase();
      const matches = allArtists.filter((a: any) =>
        a.artistName?.toLowerCase().includes(needle),
      );

      if (matches.length === 0) {
        return {
          success: true,
          message: `No artist matching "${term}" found in your Lidarr library. It may not be added yet — use lidarr_search to find it externally.`,
          data: { found: false },
        };
      }

      if (matches.length > 1) {
        const list = matches
          .slice(0, 10)
          .map(
            (a: any) =>
              `- ${a.artistName} [ID: ${a.id}] — ${a.statistics?.albumCount ?? 0} albums, ${a.statistics?.trackFileCount ?? 0} tracks`,
          )
          .join('\n');
        return {
          success: true,
          message: `Multiple matches for "${term}":\n${list}\n\nUse artistId for an exact lookup.`,
          data: {
            found: true,
            multiple: true,
            matches: matches.slice(0, 10).map((a: any) => ({
              id: a.id,
              artistName: a.artistName,
            })),
          },
        };
      }

      artist = matches[0];
    }

    // Fetch albums for this artist
    const albums: any[] = await client.get('/api/v1/album', {
      artistId: String(artist.id),
    });

    const albumLines = albums
      .sort((a: any, b: any) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''))
      .map((a: any) => {
        const year = a.releaseDate
          ? new Date(a.releaseDate).getFullYear()
          : 'Unknown';
        const downloaded =
          a.statistics?.trackFileCount > 0
            ? `${a.statistics.trackFileCount}/${a.statistics.totalTrackCount} tracks`
            : 'not downloaded';
        return `  - ${a.title} (${year}) — ${downloaded}`;
      })
      .join('\n');

    const albumCount = artist.statistics?.albumCount ?? albums.length;
    const trackCount = artist.statistics?.trackFileCount ?? 0;
    const totalTracks = artist.statistics?.totalTrackCount ?? 0;
    const sizeOnDisk = artist.statistics?.sizeOnDisk ?? 0;
    const sizeStr = formatBytes(sizeOnDisk);

    const percentComplete =
      totalTracks > 0
        ? Math.round((trackCount / totalTracks) * 100)
        : 100;

    const summary = [
      `${artist.artistName} — ${artist.status ?? 'unknown'}`,
      `${trackCount}/${totalTracks} tracks downloaded (${percentComplete}%) across ${albumCount} album(s)`,
      `Size on disk: ${sizeStr}`,
      `Monitored: ${artist.monitored ? 'Yes' : 'No'}`,
      '',
      'Albums:',
      albumLines,
    ].join('\n');

    return {
      success: true,
      message: summary,
      data: {
        found: true,
        id: artist.id,
        artistName: artist.artistName,
        status: artist.status,
        monitored: artist.monitored,
        albumCount,
        trackCount,
        totalTracks,
        percentComplete,
        sizeOnDisk: sizeStr,
        albums: albums.map((a: any) => ({
          id: a.id,
          title: a.title,
          releaseDate: a.releaseDate,
          hasFile: (a.statistics?.trackFileCount ?? 0) > 0,
          trackFileCount: a.statistics?.trackFileCount ?? 0,
          totalTrackCount: a.statistics?.totalTrackCount ?? 0,
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
