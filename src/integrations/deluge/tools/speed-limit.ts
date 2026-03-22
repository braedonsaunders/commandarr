import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'deluge_speed_limit',
  integration: 'deluge',
  description: 'Set global download and upload speed limits in Deluge',
  parameters: {
    type: 'object',
    properties: {
      download: {
        type: 'number',
        description: 'Download speed limit in KB/s (-1 or 0 for unlimited)',
      },
      upload: {
        type: 'number',
        description: 'Upload speed limit in KB/s (-1 or 0 for unlimited)',
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

    const client = ctx.getClient('deluge');
    const config: Record<string, number> = {};
    const changes: string[] = [];

    if (download !== undefined) {
      // Deluge uses -1 for unlimited; treat 0 as unlimited too
      const value = download === 0 ? -1 : download;
      config.max_download_speed = value;
      changes.push(`Download: ${value === -1 ? 'unlimited' : `${value} KB/s`}`);
    }

    if (upload !== undefined) {
      const value = upload === 0 ? -1 : upload;
      config.max_upload_speed = value;
      changes.push(`Upload: ${value === -1 ? 'unlimited' : `${value} KB/s`}`);
    }

    ctx.log(`Setting speed limits: ${JSON.stringify(config)}`);
    await client.post('core.set_config', [config]);

    return {
      success: true,
      message: `Speed limits updated:\n${changes.join('\n')}`,
    };
  },
};
