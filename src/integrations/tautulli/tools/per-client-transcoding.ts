import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'tautulli_per_client_transcoding',
  integration: 'tautulli',
  description:
    'Analyze transcoding patterns per user and player/device. Identifies which users and devices cause the most transcoding, helping optimize your server. Shows recommendations like "User X on Fire TV always transcodes 4K — consider adding a 1080p copy."',
  parameters: {
    type: 'object',
    properties: {
      days: {
        type: 'number',
        description: 'Number of days to look back (default: 30)',
      },
    },
  },
  ui: {
    category: 'Transcoding',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const { days = 30 } = params;

    const client = ctx.getClient('tautulli');
    ctx.log(`Analyzing per-client transcoding for the last ${days} days...`);

    const history = await client.get('get_history', {
      length: '1000',
      after: new Date(Date.now() - days * 86400000)
        .toISOString()
        .split('T')[0],
    });

    const records = history?.data ?? [];

    if (!Array.isArray(records) || records.length === 0) {
      return {
        success: true,
        message: `No playback history found in the last ${days} days.`,
        data: { byUser: {}, byPlayer: {}, recommendations: [] },
      };
    }

    // Aggregate by user
    const byUser: Record<
      string,
      { total: number; transcoded: number; players: Set<string>; titles: string[] }
    > = {};

    // Aggregate by player/platform
    const byPlayer: Record<
      string,
      { total: number; transcoded: number; users: Set<string>; resolutions: Record<string, number> }
    > = {};

    // Track specific problematic patterns
    const patterns: Array<{
      user: string;
      player: string;
      resolution: string;
      title: string;
      decision: string;
    }> = [];

    for (const entry of records) {
      const user = entry.friendly_name ?? entry.user ?? 'Unknown';
      const player = entry.player ?? entry.platform ?? 'Unknown';
      const decision = (
        entry.transcode_decision ?? entry.stream_video_decision ?? 'unknown'
      ).toLowerCase();
      const resolution = entry.stream_video_resolution ?? entry.video_resolution ?? 'unknown';
      const title = entry.full_title ?? entry.title ?? 'Unknown';
      const isTranscode = decision === 'transcode';

      // By user
      if (!byUser[user]) {
        byUser[user] = { total: 0, transcoded: 0, players: new Set(), titles: [] };
      }
      byUser[user].total++;
      if (isTranscode) byUser[user].transcoded++;
      byUser[user].players.add(player);

      // By player
      const playerKey = `${player}`;
      if (!byPlayer[playerKey]) {
        byPlayer[playerKey] = {
          total: 0,
          transcoded: 0,
          users: new Set(),
          resolutions: {},
        };
      }
      byPlayer[playerKey].total++;
      if (isTranscode) {
        byPlayer[playerKey].transcoded++;
        byPlayer[playerKey].resolutions[resolution] =
          (byPlayer[playerKey].resolutions[resolution] ?? 0) + 1;
      }
      byPlayer[playerKey].users.add(user);

      // Track transcode patterns for recommendations
      if (isTranscode) {
        patterns.push({ user, player, resolution, title, decision });
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];

    // Find users with high transcode rates
    for (const [user, stats] of Object.entries(byUser)) {
      const pct =
        stats.total > 0
          ? Math.round((stats.transcoded / stats.total) * 100)
          : 0;
      if (pct > 50 && stats.transcoded >= 5) {
        recommendations.push(
          `${user} transcodes ${pct}% of streams (${stats.transcoded}/${stats.total}). Check their player compatibility.`,
        );
      }
    }

    // Find players with high transcode rates at specific resolutions
    for (const [player, stats] of Object.entries(byPlayer)) {
      const pct =
        stats.total > 0
          ? Math.round((stats.transcoded / stats.total) * 100)
          : 0;
      if (pct > 60 && stats.transcoded >= 3) {
        const topRes = Object.entries(stats.resolutions)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 1);
        if (topRes.length > 0) {
          const [res, count] = topRes[0];
          const users = [...stats.users].join(', ');
          recommendations.push(
            `${player} (used by ${users}) transcodes ${res} content ${count} times — consider adding a compatible format for this device.`,
          );
        }
      }
    }

    // Format output
    const userSummary = Object.entries(byUser)
      .sort((a, b) => b[1].transcoded - a[1].transcoded)
      .map(([user, s]) => {
        const pct =
          s.total > 0
            ? Math.round((s.transcoded / s.total) * 100)
            : 0;
        return `- ${user}: ${s.transcoded}/${s.total} transcoded (${pct}%) — Players: ${[...s.players].join(', ')}`;
      })
      .join('\n');

    const playerSummary = Object.entries(byPlayer)
      .sort((a, b) => b[1].transcoded - a[1].transcoded)
      .map(([player, s]) => {
        const pct =
          s.total > 0
            ? Math.round((s.transcoded / s.total) * 100)
            : 0;
        return `- ${player}: ${s.transcoded}/${s.total} transcoded (${pct}%)`;
      })
      .join('\n');

    const recsText =
      recommendations.length > 0
        ? `\n\nRecommendations:\n${recommendations.map((r) => `- ${r}`).join('\n')}`
        : '';

    return {
      success: true,
      message: `Transcoding by user (last ${days} days):\n${userSummary}\n\nTranscoding by player:\n${playerSummary}${recsText}`,
      data: {
        byUser: Object.fromEntries(
          Object.entries(byUser).map(([k, v]) => [
            k,
            {
              total: v.total,
              transcoded: v.transcoded,
              transcodePercent:
                v.total > 0
                  ? Math.round((v.transcoded / v.total) * 100)
                  : 0,
              players: [...v.players],
            },
          ]),
        ),
        byPlayer: Object.fromEntries(
          Object.entries(byPlayer).map(([k, v]) => [
            k,
            {
              total: v.total,
              transcoded: v.transcoded,
              transcodePercent:
                v.total > 0
                  ? Math.round((v.transcoded / v.total) * 100)
                  : 0,
              users: [...v.users],
              resolutions: v.resolutions,
            },
          ]),
        ),
        recommendations,
        days,
      },
    };
  },
};
