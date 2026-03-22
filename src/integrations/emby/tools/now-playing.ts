import type { ToolDefinition } from '../../_base';

interface SessionInfo {
  UserName: string;
  DeviceName: string;
  Client: string;
  NowPlayingItem?: {
    Name: string;
    SeriesName?: string;
    Type: string;
    RunTimeTicks?: number;
  };
  PlayState?: {
    PositionTicks?: number;
    IsPaused: boolean;
    IsMuted: boolean;
  };
}

function ticksToMinutes(ticks: number): number {
  return Math.round(ticks / 600000000);
}

export const tool: ToolDefinition = {
  name: 'emby_now_playing',
  integration: 'emby',
  description: 'List active Emby sessions and what is currently playing',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Playback',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('emby');
    ctx.log('Fetching active Emby sessions...');

    const sessions: SessionInfo[] = await client.get('/Sessions', {
      ActiveWithinSeconds: '960',
    });

    if (!Array.isArray(sessions) || sessions.length === 0) {
      return {
        success: true,
        message: 'No active sessions',
        data: { sessions: [] },
      };
    }

    const activeSessions = sessions.map((s) => {
      const playing = s.NowPlayingItem;
      const state = s.PlayState;

      let nowPlaying = 'Nothing';
      let progress: string | undefined;

      if (playing) {
        nowPlaying =
          playing.SeriesName
            ? `${playing.SeriesName} — ${playing.Name}`
            : playing.Name;

        if (state?.PositionTicks && playing.RunTimeTicks) {
          const pos = ticksToMinutes(state.PositionTicks);
          const total = ticksToMinutes(playing.RunTimeTicks);
          const pct = Math.round((state.PositionTicks / playing.RunTimeTicks) * 100);
          progress = `${pos}/${total}min (${pct}%)`;
        }
      }

      return {
        user: s.UserName,
        device: s.DeviceName,
        client: s.Client,
        nowPlaying,
        progress,
        isPaused: state?.IsPaused ?? false,
      };
    });

    const summary = activeSessions
      .map(
        (s) =>
          `- ${s.user} on ${s.device} (${s.client}): ${s.nowPlaying}${s.progress ? ` [${s.progress}]` : ''}${s.isPaused ? ' (paused)' : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${activeSessions.length} active session(s):\n${summary}`,
      data: { sessions: activeSessions },
    };
  },
};
