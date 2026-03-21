import type { ToolDefinition } from '../../_base';

interface PlexSession {
  user: string;
  title: string;
  type: string;
  year?: string;
  progress: number;
  duration: number;
  player: string;
  state: string;
  transcoding: boolean;
  transcodeDecision?: string;
}

export const tool: ToolDefinition = {
  name: 'plex_now_playing',
  integration: 'plex',
  description: 'Get currently playing media on Plex',
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
    const client = ctx.getClient('plex');
    ctx.log('Fetching active Plex sessions...');

    const response = await client.get('/status/sessions');
    const sessions: PlexSession[] = [];

    if (response.MediaContainer) {
      const container = response.MediaContainer;
      const metadata = container.Metadata ?? [];
      const items = Array.isArray(metadata) ? metadata : [metadata];

      for (const item of items) {
        if (!item) continue;

        const viewOffset = parseInt(item.viewOffset ?? '0', 10);
        const duration = parseInt(item.duration ?? '0', 10);

        let title = item.title ?? 'Unknown';
        if (item.grandparentTitle) {
          title = `${item.grandparentTitle} - ${item.parentTitle ?? ''} - ${title}`;
        } else if (item.parentTitle) {
          title = `${item.parentTitle} - ${title}`;
        }

        const media = item.Media?.[0];
        const session = item.Session;
        const user = item.User;
        const player = item.Player;
        const transcodeSess = item.TranscodeSession;

        sessions.push({
          user: user?.title ?? 'Unknown',
          title,
          type: item.type ?? 'unknown',
          year: item.year,
          progress: duration > 0 ? Math.round((viewOffset / duration) * 100) : 0,
          duration,
          player: player?.title ?? player?.product ?? 'Unknown',
          state: player?.state ?? session?.state ?? 'unknown',
          transcoding: !!transcodeSess,
          transcodeDecision: transcodeSess?.transcodeDecision,
        });
      }
    } else if (response._xml) {
      const xml = response._xml as string;
      const videoRegex = /<Video\s([^>]*)>/gi;
      let match: RegExpExecArray | null;

      while ((match = videoRegex.exec(xml)) !== null) {
        const attrs = match[1]!;
        const getAttr = (name: string) => {
          const r = new RegExp(`${name}="([^"]*)"`, 'i');
          return r.exec(attrs)?.[1];
        };

        const viewOffset = parseInt(getAttr('viewOffset') ?? '0', 10);
        const duration = parseInt(getAttr('duration') ?? '0', 10);

        let title = getAttr('title') ?? 'Unknown';
        const grandparent = getAttr('grandparentTitle');
        const parent = getAttr('parentTitle');
        if (grandparent) {
          title = `${grandparent} - ${parent ?? ''} - ${title}`;
        }

        sessions.push({
          user: getAttr('userTitle') ?? 'Unknown',
          title,
          type: getAttr('type') ?? 'unknown',
          year: getAttr('year'),
          progress: duration > 0 ? Math.round((viewOffset / duration) * 100) : 0,
          duration,
          player: getAttr('playerTitle') ?? 'Unknown',
          state: getAttr('state') ?? 'unknown',
          transcoding: xml.includes('TranscodeSession'),
        });
      }
    }

    if (sessions.length === 0) {
      return {
        success: true,
        message: 'Nothing is currently playing on Plex',
        data: { sessions: [] },
      };
    }

    const summary = sessions
      .map(
        (s) =>
          `${s.user} is watching "${s.title}" on ${s.player} (${s.progress}%${s.transcoding ? ', transcoding' : ', direct play'})`,
      )
      .join('\n');

    return {
      success: true,
      message: `${sessions.length} active session(s):\n${summary}`,
      data: { sessions },
    };
  },
};
