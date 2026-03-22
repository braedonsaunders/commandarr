import type { ToolDefinition } from '../../_base';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export const tool: ToolDefinition = {
  name: 'tautulli_transcoding_history',
  integration: 'tautulli',
  description:
    'Get transcoding history and statistics. Shows how often content is transcoded vs direct played, which codecs trigger transcoding, and overall transcoding load.',
  parameters: {
    type: 'object',
    properties: {
      days: {
        type: 'number',
        description: 'Number of days to look back (default: 30)',
      },
      limit: {
        type: 'number',
        description: 'Max history entries to analyze (default: 500)',
      },
    },
  },
  ui: {
    category: 'Transcoding',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const { days = 30, limit = 500 } = params;

    const client = ctx.getClient('tautulli');
    ctx.log(`Fetching transcoding history for the last ${days} days...`);

    const history = await client.get('get_history', {
      length: String(limit),
      after: new Date(Date.now() - days * 86400000)
        .toISOString()
        .split('T')[0],
    });

    const records = history?.data ?? [];

    if (!Array.isArray(records) || records.length === 0) {
      return {
        success: true,
        message: `No playback history found in the last ${days} days.`,
        data: { stats: {}, entries: [] },
      };
    }

    let directPlay = 0;
    let directStream = 0;
    let transcode = 0;
    let totalDuration = 0;
    let transcodeDuration = 0;

    const codecTranscodes: Record<string, number> = {};
    const resolutionTranscodes: Record<string, number> = {};
    const decisionBreakdown: Record<string, number> = {};

    for (const entry of records) {
      const decision = (
        entry.transcode_decision ?? entry.stream_video_decision ?? 'unknown'
      ).toLowerCase();
      const duration = Number(entry.duration ?? entry.stopped ?? 0) - Number(entry.started ?? 0);
      const watchDuration = Number(entry.paused_counter)
        ? duration - Number(entry.paused_counter)
        : duration;

      totalDuration += Math.max(watchDuration, 0);
      decisionBreakdown[decision] = (decisionBreakdown[decision] ?? 0) + 1;

      if (decision === 'direct play') {
        directPlay++;
      } else if (decision === 'copy' || decision === 'direct stream') {
        directStream++;
      } else if (decision === 'transcode') {
        transcode++;
        transcodeDuration += Math.max(watchDuration, 0);

        const videoCodec = entry.video_codec ?? entry.stream_video_codec ?? 'unknown';
        const resolution = entry.stream_video_resolution ?? entry.video_resolution ?? 'unknown';

        codecTranscodes[videoCodec] =
          (codecTranscodes[videoCodec] ?? 0) + 1;
        resolutionTranscodes[resolution] =
          (resolutionTranscodes[resolution] ?? 0) + 1;
      }
    }

    const total = records.length;
    const directPlayPct = total > 0 ? Math.round((directPlay / total) * 100) : 0;
    const directStreamPct = total > 0 ? Math.round((directStream / total) * 100) : 0;
    const transcodePct = total > 0 ? Math.round((transcode / total) * 100) : 0;

    const topCodecs = Object.entries(codecTranscodes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([codec, count]) => `${codec}: ${count} transcodes`)
      .join(', ');

    const topResolutions = Object.entries(resolutionTranscodes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([res, count]) => `${res}: ${count} transcodes`)
      .join(', ');

    const summary = [
      `Playback stats (last ${days} days, ${total} streams):`,
      `- Direct Play: ${directPlay} (${directPlayPct}%)`,
      `- Direct Stream: ${directStream} (${directStreamPct}%)`,
      `- Transcode: ${transcode} (${transcodePct}%)`,
      `- Total watch time: ${formatDuration(totalDuration)}`,
      `- Transcode time: ${formatDuration(transcodeDuration)}`,
      '',
      transcode > 0 ? `Top codecs causing transcoding: ${topCodecs}` : '',
      transcode > 0
        ? `Top resolutions being transcoded: ${topResolutions}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      success: true,
      message: summary,
      data: {
        stats: {
          totalStreams: total,
          directPlay,
          directStream,
          transcode,
          directPlayPercent: directPlayPct,
          directStreamPercent: directStreamPct,
          transcodePercent: transcodePct,
          totalDurationSeconds: totalDuration,
          transcodeDurationSeconds: transcodeDuration,
        },
        codecTranscodes,
        resolutionTranscodes,
        decisionBreakdown,
        days,
      },
    };
  },
};
