import type { ToolDefinition } from '../../_base';

interface MediaStream {
  Type: string;
  Codec: string;
  DisplayTitle?: string;
  Language?: string;
  BitRate?: number;
  Width?: number;
  Height?: number;
  Channels?: number;
  SampleRate?: number;
  IsDefault?: boolean;
  IsExternal?: boolean;
}

interface MediaSource {
  Name: string;
  Path: string;
  Container: string;
  Size: number;
  Bitrate?: number;
  MediaStreams: MediaStream[];
}

interface ItemDetail {
  Id: string;
  Name: string;
  Type: string;
  SeriesName?: string;
  SeasonName?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  ProductionYear?: number;
  OfficialRating?: string;
  CommunityRating?: number;
  RunTimeTicks?: number;
  Overview?: string;
  Genres?: string[];
  Studios?: Array<{ Name: string }>;
  MediaSources?: MediaSource[];
  Path?: string;
  DateCreated?: string;
  PremiereDate?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function ticksToMinutes(ticks: number): number {
  return Math.round(ticks / 600000000);
}

export const tool: ToolDefinition = {
  name: 'emby_media_info',
  integration: 'emby',
  description:
    'Get detailed metadata for a specific Emby media item including codec, resolution, file size, streams, and file path. Use emby_search to find item IDs.',
  parameters: {
    type: 'object',
    properties: {
      itemId: {
        type: 'string',
        description: 'The item ID to look up. Use emby_search to find IDs.',
      },
    },
    required: ['itemId'],
  },
  ui: {
    category: 'Library',
    dangerLevel: 'low',
    testable: false,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('emby');
    const { itemId } = params;

    ctx.log(`Fetching media info for item ${itemId}...`);

    let item: ItemDetail;
    try {
      item = await client.get(`/Items/${itemId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to fetch item: ${msg}` };
    }

    let title = item.Name;
    if (item.SeriesName) {
      title = `${item.SeriesName} — ${item.SeasonName ?? ''} E${item.IndexNumber ?? '?'} — ${item.Name}`;
    }

    const mediaSource = item.MediaSources?.[0];
    const streams = (mediaSource?.MediaStreams ?? []).map((s) => ({
      type: s.Type,
      codec: s.Codec,
      displayTitle: s.DisplayTitle,
      language: s.Language,
      resolution: s.Width && s.Height ? `${s.Width}x${s.Height}` : undefined,
      bitrate: s.BitRate,
      channels: s.Channels,
      isDefault: s.IsDefault,
      isExternal: s.IsExternal,
    }));

    const videoStream = streams.find((s) => s.type === 'Video');
    const audioStreams = streams.filter((s) => s.type === 'Audio');
    const subtitleStreams = streams.filter((s) => s.type === 'Subtitle');

    const data = {
      id: item.Id,
      title,
      type: item.Type,
      year: item.ProductionYear,
      rating: item.OfficialRating,
      communityRating: item.CommunityRating,
      runtime: item.RunTimeTicks ? `${ticksToMinutes(item.RunTimeTicks)} min` : undefined,
      genres: item.Genres,
      overview: item.Overview?.slice(0, 200),
      path: mediaSource?.Path ?? item.Path,
      container: mediaSource?.Container,
      fileSize: mediaSource?.Size ? formatBytes(mediaSource.Size) : undefined,
      bitrate: mediaSource?.Bitrate ? `${Math.round(mediaSource.Bitrate / 1000)} kbps` : undefined,
      video: videoStream
        ? `${videoStream.codec?.toUpperCase()} ${videoStream.resolution ?? ''} ${videoStream.displayTitle ?? ''}`.trim()
        : undefined,
      audioTracks: audioStreams.map(
        (a) => `${a.codec?.toUpperCase()} ${a.language ?? ''} ${a.channels ? `${a.channels}ch` : ''} ${a.displayTitle ?? ''}`.trim(),
      ),
      subtitleTracks: subtitleStreams.map(
        (s) => `${s.language ?? 'unknown'} (${s.codec})${s.isExternal ? ' [external]' : ''}`,
      ),
      dateAdded: item.DateCreated,
      premiereDate: item.PremiereDate,
    };

    const lines = [
      `Title: ${data.title}`,
      data.year ? `Year: ${data.year}` : null,
      data.rating ? `Rating: ${data.rating}` : null,
      data.communityRating ? `Score: ${data.communityRating}/10` : null,
      data.runtime ? `Runtime: ${data.runtime}` : null,
      data.genres?.length ? `Genres: ${data.genres.join(', ')}` : null,
      data.path ? `File: ${data.path}` : null,
      data.container ? `Container: ${data.container}` : null,
      data.fileSize ? `Size: ${data.fileSize}` : null,
      data.bitrate ? `Bitrate: ${data.bitrate}` : null,
      data.video ? `Video: ${data.video}` : null,
      data.audioTracks.length ? `Audio: ${data.audioTracks.join(' | ')}` : null,
      data.subtitleTracks.length ? `Subtitles: ${data.subtitleTracks.join(' | ')}` : null,
    ].filter(Boolean);

    return {
      success: true,
      message: lines.join('\n'),
      data,
    };
  },
};
