import type { ToolDefinition } from '../../_base';

interface SystemStatus {
  version: string;
  pythonVersion: string;
  os: string;
  startTime: string;
}

export const tool: ToolDefinition = {
  name: 'bazarr_system_status',
  integration: 'bazarr',
  description: 'Get Bazarr system status information',
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
    const client = ctx.getClient('bazarr');
    ctx.log('Fetching Bazarr system status...');

    const response = await client.get('/api/system/status');

    const data = response.data ?? response;

    const status: SystemStatus = {
      version: data.bazarr_version ?? data.version ?? 'Unknown',
      pythonVersion: data.python_version ?? data.pythonVersion ?? 'Unknown',
      os: data.operating_system ?? data.os ?? 'Unknown',
      startTime: data.start_time
        ? new Date(data.start_time).toLocaleString()
        : data.startTime
          ? new Date(data.startTime).toLocaleString()
          : 'Unknown',
    };

    const summary = [
      `Version: ${status.version}`,
      `Python: ${status.pythonVersion}`,
      `OS: ${status.os}`,
      `Start time: ${status.startTime}`,
    ].join('\n');

    return {
      success: true,
      message: `Bazarr system status:\n${summary}`,
      data: { status },
    };
  },
};
