import type { ToolDefinition } from '../../_base';

interface Session {
  user: string;
  title: string;
  fullTitle: string;
  player: string;
  qualityProfile: string;
  progressPercent: number;
  bandwidth: string;
  state: string;
  mediaType: string;
}

function formatBandwidth(kbps: number): string {
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`;
  }
  return `${kbps} kbps`;
}

export const tool: ToolDefinition = {
  name: 'tautulli_activity',
  integration: 'tautulli',
  description: 'Check current Plex activity - who is watching what right now',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Monitoring',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('tautulli');
    ctx.log('Fetching current Plex activity...');

    const data = await client.get('get_activity');

    const streamCount = data?.stream_count ?? 0;
    const sessions: Session[] = [];

    if (Array.isArray(data?.sessions)) {
      for (const s of data.sessions) {
        sessions.push({
          user: s.friendly_name ?? s.username ?? 'Unknown',
          title: s.title ?? 'Unknown',
          fullTitle: s.full_title ?? s.title ?? 'Unknown',
          player: s.player ?? 'Unknown',
          qualityProfile: s.quality_profile ?? s.stream_video_resolution ?? 'Unknown',
          progressPercent: Math.round(Number(s.progress_percent ?? 0)),
          bandwidth: formatBandwidth(Number(s.bandwidth ?? 0)),
          state: s.state ?? 'unknown',
          mediaType: s.media_type ?? 'unknown',
        });
      }
    }

    if (sessions.length === 0) {
      return {
        success: true,
        message: 'No active streams on Plex',
        data: { streamCount: 0, sessions: [] },
      };
    }

    const summary = sessions
      .map(
        (s) =>
          `- ${s.user}: ${s.fullTitle} (${s.player}, ${s.qualityProfile}, ${s.progressPercent}% complete, ${s.bandwidth}, ${s.state})`,
      )
      .join('\n');

    return {
      success: true,
      message: `${streamCount} active stream(s):\n${summary}`,
      data: { streamCount, sessions },
    };
  },
};
