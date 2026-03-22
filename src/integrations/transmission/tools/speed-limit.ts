import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'transmission_speed_limit',
  integration: 'transmission',
  description: 'Set global download and upload speed limits in Transmission',
  parameters: {
    type: 'object',
    properties: {
      download: {
        type: 'number',
        description: 'Download speed limit in KB/s (0 to disable limit)',
      },
      upload: {
        type: 'number',
        description: 'Upload speed limit in KB/s (0 to disable limit)',
      },
    },
  },
  ui: {
    category: 'Configuration',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { download, upload } = params;
    if (download === undefined && upload === undefined) {
      return { success: false, message: 'At least one of download or upload limit is required' };
    }

    const client = ctx.getClient('transmission');
    const args: Record<string, unknown> = {};
    const changes: string[] = [];

    if (download !== undefined) {
      if (download === 0) {
        args['speed-limit-down-enabled'] = false;
        changes.push('Download: unlimited');
      } else {
        args['speed-limit-down-enabled'] = true;
        args['speed-limit-down'] = download;
        changes.push(`Download: ${download} KB/s`);
      }
    }

    if (upload !== undefined) {
      if (upload === 0) {
        args['speed-limit-up-enabled'] = false;
        changes.push('Upload: unlimited');
      } else {
        args['speed-limit-up-enabled'] = true;
        args['speed-limit-up'] = upload;
        changes.push(`Upload: ${upload} KB/s`);
      }
    }

    ctx.log(`Setting speed limits: ${changes.join(', ')}`);
    await client.post('session-set', args);

    return {
      success: true,
      message: `Speed limits updated:\n${changes.join('\n')}`,
    };
  },
};
