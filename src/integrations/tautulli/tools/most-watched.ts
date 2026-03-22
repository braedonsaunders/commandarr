import type { ToolDefinition } from '../../_base';

interface MostWatchedItem {
  title: string;
  totalPlays: number;
  totalDuration: string;
  usersWatching: number;
  lastPlay: string;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

const statIdMap: Record<string, string> = {
  movies: 'popular_movies',
  tv: 'popular_tv',
  music: 'popular_music',
};

export const tool: ToolDefinition = {
  name: 'tautulli_most_watched',
  integration: 'tautulli',
  description: 'View most watched/popular media on Plex',
  parameters: {
    type: 'object',
    properties: {
      timeRange: {
        type: 'number',
        description: 'Time range in days to look back (default: 30)',
      },
      stat: {
        type: 'string',
        description: 'Type of media stats: movies, tv, or music (default: movies)',
      },
    },
  },
  ui: {
    category: 'Analytics',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('tautulli');
    const timeRange = String(params.timeRange ?? 30);
    const statType = (params.stat as string) ?? 'movies';
    const statId = statIdMap[statType] ?? 'popular_movies';

    ctx.log(`Fetching most watched ${statType} (last ${timeRange} days)...`);

    const data = await client.get('get_home_stats', {
      stat_id: statId,
      time_range: timeRange,
      stats_count: '25',
    });

    const rows = data?.rows ?? [];
    const items: MostWatchedItem[] = [];

    if (Array.isArray(rows)) {
      for (const r of rows) {
        items.push({
          title: r.title ?? 'Unknown',
          totalPlays: Number(r.total_plays ?? 0),
          totalDuration: formatDuration(Number(r.total_duration ?? 0)),
          usersWatching: Number(r.users_watched ?? 0),
          lastPlay: r.last_play
            ? new Date(Number(r.last_play) * 1000).toLocaleString()
            : 'Unknown',
        });
      }
    }

    if (items.length === 0) {
      return {
        success: true,
        message: `No ${statType} watch stats found for the last ${timeRange} days`,
        data: { items: [] },
      };
    }

    const summary = items
      .map(
        (item) =>
          `- ${item.title}: ${item.totalPlays} plays, ${item.totalDuration} total, ${item.usersWatching} user(s)`,
      )
      .join('\n');

    return {
      success: true,
      message: `Most watched ${statType} (last ${timeRange} days):\n${summary}`,
      data: { items },
    };
  },
};
