import type { ToolDefinition } from '../../_base';

function formatBandwidth(kbps: number): string {
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`;
  }
  return `${kbps} kbps`;
}

export const tool: ToolDefinition = {
  name: 'tautulli_hw_transcoding_status',
  integration: 'tautulli',
  description:
    'Check if hardware transcoding is active and working. Shows current transcode sessions, whether they use HW acceleration (GPU), and identifies sessions falling back to software transcoding.',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Transcoding',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('tautulli');
    ctx.log('Checking hardware transcoding status...');

    // Get current activity for live transcode sessions
    const activity = await client.get('get_activity');

    // Get server info for Plex version and platform
    let serverInfo: any = {};
    try {
      serverInfo = await client.get('get_server_info');
    } catch {
      // Non-critical
    }

    const sessions = activity?.sessions ?? [];
    const sessionArray = Array.isArray(sessions) ? sessions : [];

    // Also get recent transcode history to analyze HW vs SW patterns
    const history = await client.get('get_history', {
      length: '100',
    });
    const historyRecords = history?.data ?? [];

    // Analyze recent history for HW transcoding patterns
    let recentHwTranscode = 0;
    let recentSwTranscode = 0;
    let recentDirectPlay = 0;

    if (Array.isArray(historyRecords)) {
      for (const entry of historyRecords) {
        const decision = (
          entry.transcode_decision ?? entry.stream_video_decision ?? ''
        ).toLowerCase();
        const hwDecoding = entry.transcode_hw_decoding === '1' || entry.transcode_hw_decoding === 1;
        const hwEncoding = entry.transcode_hw_encoding === '1' || entry.transcode_hw_encoding === 1;

        if (decision === 'transcode') {
          if (hwDecoding || hwEncoding) {
            recentHwTranscode++;
          } else {
            recentSwTranscode++;
          }
        } else if (decision === 'direct play') {
          recentDirectPlay++;
        }
      }
    }

    // Analyze current sessions
    const transcodeSessions: any[] = [];
    const directSessions: any[] = [];

    for (const s of sessionArray) {
      const decision = (
        s.transcode_decision ?? s.stream_video_decision ?? 'unknown'
      ).toLowerCase();

      const sessionInfo = {
        user: s.friendly_name ?? s.username ?? 'Unknown',
        title: s.full_title ?? s.title ?? 'Unknown',
        player: s.player ?? 'Unknown',
        platform: s.platform ?? 'Unknown',
        quality: s.quality_profile ?? s.stream_video_resolution ?? 'Unknown',
        bandwidth: formatBandwidth(Number(s.bandwidth ?? 0)),
        decision,
        videoCodec: s.video_codec ?? 'unknown',
        streamVideoCodec: s.stream_video_codec ?? 'unknown',
        videoResolution: s.video_resolution ?? 'unknown',
        streamVideoResolution: s.stream_video_resolution ?? 'unknown',
        hwDecoding: s.transcode_hw_decoding === '1' || s.transcode_hw_decoding === 1,
        hwEncoding: s.transcode_hw_encoding === '1' || s.transcode_hw_encoding === 1,
        transcodeSpeed: s.transcode_speed ?? null,
        transcodeProgress: s.transcode_progress ? `${s.transcode_progress}%` : null,
        throttled: s.transcode_throttled === '1' || s.transcode_throttled === 1,
      };

      if (decision === 'transcode') {
        transcodeSessions.push(sessionInfo);
      } else {
        directSessions.push(sessionInfo);
      }
    }

    // Build summary
    const lines: string[] = [];

    // Server info
    if (serverInfo.pms_name) {
      lines.push(
        `Server: ${serverInfo.pms_name} (Plex ${serverInfo.pms_version ?? 'unknown'} on ${serverInfo.pms_platform ?? 'unknown'})`,
      );
    }

    lines.push('');

    // Current sessions
    if (sessionArray.length === 0) {
      lines.push('No active streams right now.');
    } else {
      lines.push(`Active streams: ${sessionArray.length}`);

      if (transcodeSessions.length > 0) {
        lines.push(`\nTranscoding sessions (${transcodeSessions.length}):`);
        for (const s of transcodeSessions) {
          const hwStatus =
            s.hwDecoding && s.hwEncoding
              ? 'HW decode + encode'
              : s.hwDecoding
                ? 'HW decode, SW encode'
                : s.hwEncoding
                  ? 'SW decode, HW encode'
                  : 'SOFTWARE ONLY (no HW acceleration)';
          lines.push(
            `- ${s.user}: ${s.title} — ${s.videoCodec} ${s.videoResolution} → ${s.streamVideoCodec} ${s.streamVideoResolution} [${hwStatus}]${s.transcodeSpeed ? ` Speed: ${s.transcodeSpeed}x` : ''}${s.throttled ? ' (throttled)' : ''}`,
          );
        }
      }

      if (directSessions.length > 0) {
        lines.push(`\nDirect play/stream sessions (${directSessions.length}):`);
        for (const s of directSessions) {
          lines.push(
            `- ${s.user}: ${s.title} — ${s.decision} (${s.quality}, ${s.bandwidth})`,
          );
        }
      }
    }

    // Recent history analysis
    const recentTotal = recentHwTranscode + recentSwTranscode + recentDirectPlay;
    if (recentTotal > 0) {
      lines.push('\n--- Recent history analysis (last 100 streams) ---');
      lines.push(
        `- Direct play: ${recentDirectPlay} (${Math.round((recentDirectPlay / recentTotal) * 100)}%)`,
      );
      lines.push(
        `- HW transcode: ${recentHwTranscode} (${Math.round((recentHwTranscode / recentTotal) * 100)}%)`,
      );
      lines.push(
        `- SW transcode: ${recentSwTranscode} (${Math.round((recentSwTranscode / recentTotal) * 100)}%)`,
      );

      if (recentSwTranscode > 0 && recentHwTranscode === 0) {
        lines.push(
          '\n⚠ WARNING: No hardware transcoding detected in recent history. GPU acceleration may not be configured correctly.',
        );
      } else if (recentSwTranscode > recentHwTranscode && recentHwTranscode > 0) {
        lines.push(
          '\n⚠ NOTE: More software transcodes than hardware. Some content may not support HW acceleration, or GPU may be reaching capacity.',
        );
      }
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        currentSessions: {
          total: sessionArray.length,
          transcoding: transcodeSessions.length,
          direct: directSessions.length,
          transcodeSessions,
          directSessions,
        },
        recentHistory: {
          total: recentTotal,
          hwTranscode: recentHwTranscode,
          swTranscode: recentSwTranscode,
          directPlay: recentDirectPlay,
        },
        serverInfo: {
          name: serverInfo.pms_name,
          version: serverInfo.pms_version,
          platform: serverInfo.pms_platform,
        },
      },
    };
  },
};
