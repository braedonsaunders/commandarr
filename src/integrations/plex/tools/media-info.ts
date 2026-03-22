import type { ToolDefinition } from '../../_base';
import { parseXmlElements } from '../client';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const tool: ToolDefinition = {
  name: 'plex_media_info',
  integration: 'plex',
  description:
    'Get detailed metadata for a specific Plex media item including codec, resolution, file size, audio/subtitle streams, and file path. Use plex_search to find rating keys.',
  parameters: {
    type: 'object',
    properties: {
      ratingKey: {
        type: 'string',
        description: 'The rating key (item ID) to look up. Use plex_search to find rating keys.',
      },
    },
    required: ['ratingKey'],
  },
  ui: {
    category: 'Libraries',
    dangerLevel: 'low',
    testable: false,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('plex');
    const { ratingKey } = params;

    ctx.log(`Fetching media info for item ${ratingKey}...`);

    let response: any;
    try {
      response = await client.get(`/library/metadata/${ratingKey}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to fetch item: ${msg}` };
    }

    interface StreamInfo {
      type: string;
      codec: string;
      displayTitle: string;
      language: string;
      resolution?: string;
      bitrate?: number;
      channels?: number;
    }

    let title = '';
    let year = '';
    let contentRating = '';
    let rating = '';
    let duration = 0;
    let summary = '';
    let genres: string[] = [];
    let filePath = '';
    let container = '';
    let fileSize = 0;
    let bitrate = 0;
    const streams: StreamInfo[] = [];

    if (response.MediaContainer) {
      const items = response.MediaContainer.Metadata ?? [];
      const item = Array.isArray(items) ? items[0] : items;

      if (!item) {
        return { success: false, message: `Item ${ratingKey} not found.` };
      }

      title = item.title ?? 'Unknown';
      if (item.grandparentTitle) {
        title = `${item.grandparentTitle} — ${item.parentTitle ?? ''} — ${title}`;
      }
      year = item.year ?? '';
      contentRating = item.contentRating ?? '';
      rating = item.rating ?? '';
      duration = parseInt(item.duration ?? '0', 10);
      summary = (item.summary ?? '').slice(0, 200);

      const genreList = item.Genre ?? [];
      genres = (Array.isArray(genreList) ? genreList : [genreList])
        .map((g: any) => g.tag)
        .filter(Boolean);

      const media = item.Media?.[0] ?? item.Media;
      if (media) {
        container = media.container ?? '';
        bitrate = parseInt(media.bitrate ?? '0', 10);

        const parts = media.Part ?? [];
        const part = Array.isArray(parts) ? parts[0] : parts;
        if (part) {
          filePath = part.file ?? '';
          fileSize = parseInt(part.size ?? '0', 10);

          const streamList = part.Stream ?? [];
          const streamArray = Array.isArray(streamList) ? streamList : [streamList];
          for (const s of streamArray) {
            if (!s) continue;
            const streamType =
              s.streamType === '1' || s.streamType === 1
                ? 'Video'
                : s.streamType === '2' || s.streamType === 2
                  ? 'Audio'
                  : s.streamType === '3' || s.streamType === 3
                    ? 'Subtitle'
                    : `Type ${s.streamType}`;
            streams.push({
              type: streamType,
              codec: s.codec ?? '',
              displayTitle: s.displayTitle ?? '',
              language: s.language ?? '',
              resolution:
                s.width && s.height ? `${s.width}x${s.height}` : undefined,
              bitrate: s.bitrate ? parseInt(s.bitrate, 10) : undefined,
              channels: s.channels ? parseInt(s.channels, 10) : undefined,
            });
          }
        }
      }
    } else if (response._xml) {
      const xml = response._xml as string;
      const videoAttrs = parseXmlElements(xml, 'Video')[0] ?? parseXmlElements(xml, 'Directory')[0];
      if (!videoAttrs) {
        return { success: false, message: `Item ${ratingKey} not found.` };
      }

      title = videoAttrs.title ?? 'Unknown';
      if (videoAttrs.grandparentTitle) {
        title = `${videoAttrs.grandparentTitle} — ${videoAttrs.parentTitle ?? ''} — ${title}`;
      }
      year = videoAttrs.year ?? '';
      contentRating = videoAttrs.contentRating ?? '';
      rating = videoAttrs.rating ?? '';
      duration = parseInt(videoAttrs.duration ?? '0', 10);
      summary = (videoAttrs.summary ?? '').slice(0, 200);

      const mediaAttrs = parseXmlElements(xml, 'Media')[0];
      if (mediaAttrs) {
        container = mediaAttrs.container ?? '';
        bitrate = parseInt(mediaAttrs.bitrate ?? '0', 10);
      }

      const partAttrs = parseXmlElements(xml, 'Part')[0];
      if (partAttrs) {
        filePath = partAttrs.file ?? '';
        fileSize = parseInt(partAttrs.size ?? '0', 10);
      }

      const xmlStreams = parseXmlElements(xml, 'Stream');
      for (const s of xmlStreams) {
        const streamType =
          s.streamType === '1' ? 'Video' : s.streamType === '2' ? 'Audio' : s.streamType === '3' ? 'Subtitle' : `Type ${s.streamType}`;
        streams.push({
          type: streamType,
          codec: s.codec ?? '',
          displayTitle: s.displayTitle ?? '',
          language: s.language ?? '',
          resolution: s.width && s.height ? `${s.width}x${s.height}` : undefined,
          bitrate: s.bitrate ? parseInt(s.bitrate, 10) : undefined,
          channels: s.channels ? parseInt(s.channels, 10) : undefined,
        });
      }
    }

    const videoStream = streams.find((s) => s.type === 'Video');
    const audioStreams = streams.filter((s) => s.type === 'Audio');
    const subtitleStreams = streams.filter((s) => s.type === 'Subtitle');

    const data = {
      ratingKey,
      title,
      year,
      contentRating,
      communityRating: rating,
      runtime: duration > 0 ? `${Math.round(duration / 60000)} min` : undefined,
      genres,
      overview: summary,
      path: filePath,
      container,
      fileSize: fileSize > 0 ? formatBytes(fileSize) : undefined,
      bitrate: bitrate > 0 ? `${bitrate} kbps` : undefined,
      video: videoStream
        ? `${videoStream.codec.toUpperCase()} ${videoStream.resolution ?? ''} ${videoStream.displayTitle}`.trim()
        : undefined,
      audioTracks: audioStreams.map(
        (a) => `${a.codec.toUpperCase()} ${a.language} ${a.channels ? `${a.channels}ch` : ''} ${a.displayTitle}`.trim(),
      ),
      subtitleTracks: subtitleStreams.map(
        (s) => `${s.language || 'unknown'} (${s.codec}) ${s.displayTitle}`.trim(),
      ),
    };

    const lines = [
      `Title: ${data.title}`,
      data.year ? `Year: ${data.year}` : null,
      data.contentRating ? `Rating: ${data.contentRating}` : null,
      data.communityRating ? `Score: ${data.communityRating}` : null,
      data.runtime ? `Runtime: ${data.runtime}` : null,
      data.genres.length ? `Genres: ${data.genres.join(', ')}` : null,
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
