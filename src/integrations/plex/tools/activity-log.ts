import type { ToolDefinition } from '../../_base';
import { parseXmlElements } from '../client';

export const tool: ToolDefinition = {
  name: 'plex_activity_log',
  integration: 'plex',
  description:
    'Get current Plex server activities (transcoding, library scanning, media analysis, etc.)',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'System',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('plex');
    ctx.log('Fetching server activities...');

    const response = await client.get('/activities');

    interface Activity {
      uuid: string;
      type: string;
      title: string;
      subtitle: string;
      progress: number;
      cancellable: boolean;
    }

    const activities: Activity[] = [];

    if (response.MediaContainer) {
      const items = response.MediaContainer.Activity ?? [];
      const activityArray = Array.isArray(items) ? items : [items];

      for (const a of activityArray) {
        if (!a) continue;
        activities.push({
          uuid: a.uuid ?? '',
          type: a.type ?? 'unknown',
          title: a.title ?? 'Unknown',
          subtitle: a.subtitle ?? '',
          progress: parseInt(a.progress ?? '0', 10),
          cancellable: a.cancellable === true || a.cancellable === '1',
        });
      }
    } else if (response._xml) {
      const parsed = parseXmlElements(response._xml as string, 'Activity');
      for (const attrs of parsed) {
        activities.push({
          uuid: attrs.uuid ?? '',
          type: attrs.type ?? 'unknown',
          title: attrs.title ?? 'Unknown',
          subtitle: attrs.subtitle ?? '',
          progress: parseInt(attrs.progress ?? '0', 10),
          cancellable: attrs.cancellable === '1',
        });
      }
    }

    if (activities.length === 0) {
      return {
        success: true,
        message: 'No active server activities.',
        data: { activities: [] },
      };
    }

    const summary = activities
      .map(
        (a) =>
          `- ${a.title}${a.subtitle ? ` — ${a.subtitle}` : ''} [${a.progress}%]${a.cancellable ? ' (cancellable)' : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${activities.length} active activit${activities.length === 1 ? 'y' : 'ies'}:\n${summary}`,
      data: { activities },
    };
  },
};
