import type { ToolDefinition } from '../../_base';
import { parseXmlElements } from '../client';

export const tool: ToolDefinition = {
  name: 'plex_scheduled_tasks',
  integration: 'plex',
  description:
    'List or run Plex butler tasks (optimize database, clean bundles, refresh metadata, etc.)',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'run'],
        description: 'Action to perform: "list" to view all butler tasks, "run" to trigger a specific task',
      },
      taskName: {
        type: 'string',
        description:
          'Butler task name to run (e.g., "OptimizeDatabase", "CleanBundles", "RefreshLocalMedia"). Required when action is "run". Use action "list" to see available tasks.',
      },
    },
    required: ['action'],
  },
  ui: {
    category: 'System',
    dangerLevel: 'medium',
    testable: true,
    testDefaults: { action: 'list' },
  },
  async handler(params, ctx) {
    const client = ctx.getClient('plex');
    const { action, taskName } = params;

    if (action === 'run') {
      if (!taskName) {
        return { success: false, message: 'taskName is required when action is "run".' };
      }

      ctx.log(`Triggering butler task: ${taskName}...`);
      try {
        await client.post(`/butler/${taskName}`);
        return {
          success: true,
          message: `Butler task "${taskName}" has been triggered.`,
          data: { taskName },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, message: `Failed to run butler task: ${msg}` };
      }
    }

    // List butler tasks
    ctx.log('Fetching butler tasks...');
    const response = await client.get('/butler');

    interface TaskInfo {
      name: string;
      title: string;
      description: string;
      enabled: boolean;
      schedule?: string;
    }

    const tasks: TaskInfo[] = [];

    if (response.ButlerTasks) {
      const items = response.ButlerTasks.ButlerTask ?? [];
      const taskArray = Array.isArray(items) ? items : [items];

      for (const t of taskArray) {
        if (!t) continue;
        tasks.push({
          name: t.name ?? '',
          title: t.title ?? t.name ?? 'Unknown',
          description: t.description ?? '',
          enabled: t.enabled !== false && t.enabled !== '0',
          schedule: t.schedule?.randomized ? 'randomized' : t.schedule?.interval ? `every ${t.schedule.interval}` : undefined,
        });
      }
    } else if (response._xml) {
      const parsed = parseXmlElements(response._xml as string, 'ButlerTask');
      for (const attrs of parsed) {
        tasks.push({
          name: attrs.name ?? '',
          title: attrs.title ?? attrs.name ?? 'Unknown',
          description: attrs.description ?? '',
          enabled: attrs.enabled !== '0',
        });
      }
    }

    if (tasks.length === 0) {
      return { success: true, message: 'No butler tasks found.', data: { tasks: [] } };
    }

    const summary = tasks
      .map(
        (t) =>
          `- ${t.title} (${t.name})${t.enabled ? '' : ' [disabled]'}${t.schedule ? ` — ${t.schedule}` : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${tasks.length} butler task(s):\n${summary}`,
      data: { tasks },
    };
  },
};
