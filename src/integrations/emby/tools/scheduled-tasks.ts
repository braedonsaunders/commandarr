import type { ToolDefinition } from '../../_base';

interface ScheduledTask {
  Id: string;
  Name: string;
  Description: string;
  State: string;
  CurrentProgressPercentage?: number;
  LastExecutionResult?: {
    Status: string;
    StartTimeUtc: string;
    EndTimeUtc: string;
  };
  Triggers?: Array<{
    Type: string;
    TimeOfDayTicks?: number;
    IntervalTicks?: number;
    DayOfWeek?: string;
  }>;
  Category: string;
}

function ticksToTime(ticks: number): string {
  const totalMinutes = Math.floor(ticks / 600000000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export const tool: ToolDefinition = {
  name: 'emby_scheduled_tasks',
  integration: 'emby',
  description:
    'List or run Emby scheduled tasks (library scans, image extraction, log cleanup, etc.)',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'run'],
        description: 'Action to perform: "list" to view all tasks, "run" to trigger a specific task',
      },
      taskId: {
        type: 'string',
        description: 'Task ID to run. Required when action is "run". Use action "list" first to find task IDs.',
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
    const client = ctx.getClient('emby');
    const { action, taskId } = params;

    if (action === 'run') {
      if (!taskId) {
        return { success: false, message: 'taskId is required when action is "run".' };
      }

      ctx.log(`Triggering scheduled task ${taskId}...`);
      try {
        await client.post(`/ScheduledTasks/Running/${taskId}`);
        return {
          success: true,
          message: `Task ${taskId} has been triggered to run.`,
          data: { taskId },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, message: `Failed to run task: ${msg}` };
      }
    }

    // List tasks
    ctx.log('Fetching scheduled tasks...');
    const tasks: ScheduledTask[] = await client.get('/ScheduledTasks');

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return { success: true, message: 'No scheduled tasks found.', data: { tasks: [] } };
    }

    const formatted = tasks.map((t) => {
      const lastRun = t.LastExecutionResult;
      const triggers = (t.Triggers ?? []).map((tr) => {
        if (tr.Type === 'DailyTrigger' && tr.TimeOfDayTicks != null) {
          return `Daily at ${ticksToTime(tr.TimeOfDayTicks)}`;
        }
        if (tr.Type === 'IntervalTrigger' && tr.IntervalTicks != null) {
          const hours = Math.round(tr.IntervalTicks / 36000000000);
          return `Every ${hours}h`;
        }
        if (tr.Type === 'WeeklyTrigger') {
          const day = tr.DayOfWeek ?? '?';
          const time = tr.TimeOfDayTicks != null ? ` at ${ticksToTime(tr.TimeOfDayTicks)}` : '';
          return `${day}${time}`;
        }
        if (tr.Type === 'StartupTrigger') return 'On startup';
        return tr.Type;
      });

      return {
        id: t.Id,
        name: t.Name,
        category: t.Category,
        state: t.State,
        progress: t.CurrentProgressPercentage,
        lastStatus: lastRun?.Status,
        triggers,
      };
    });

    const summary = formatted
      .map(
        (t) =>
          `- [${t.state}] ${t.name} (${t.category}) — ${t.triggers.join(', ') || 'no triggers'}${t.lastStatus ? ` — last: ${t.lastStatus}` : ''}${t.progress != null ? ` [${Math.round(t.progress)}%]` : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${formatted.length} scheduled task(s):\n${summary}`,
      data: { tasks: formatted },
    };
  },
};
