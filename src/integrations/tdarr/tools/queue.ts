import type { ToolDefinition } from '../../_base';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const negative = bytes < 0;
  const abs = Math.abs(bytes);
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(abs) / Math.log(1024));
  const value = (abs / Math.pow(1024, i)).toFixed(1);
  return `${negative ? '-' : ''}${value} ${units[i]}`;
}

interface QueueFile {
  id: string;
  file: string;
  fileSize: string;
  container: string;
  codec: string;
  resolution: string;
  type: string;
}

export const tool: ToolDefinition = {
  name: 'tdarr_queue',
  integration: 'tdarr',
  description:
    'Get the current Tdarr processing queue: files waiting, files being processed, and queue counts',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Transcoding',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('tdarr');
    ctx.log('Fetching Tdarr queue...');

    // Get status for queue counts, and fetch queued files
    const [statusRes, transcodeQueueRes, healthCheckQueueRes] =
      await Promise.all([
        client.get('/api/v2/status'),
        client.post('/api/v2/cruddb', {
          data: {
            collection: 'FileJSONDB',
            mode: 'getAll',
            docID: 'table1',
          },
        }).catch(() => null),
        client.post('/api/v2/cruddb', {
          data: {
            collection: 'FileJSONDB',
            mode: 'getAll',
            docID: 'table4',
          },
        }).catch(() => null),
      ]);

    const transcodeQueueCount = statusRes?.table1Count ?? 0;
    const healthCheckQueueCount = statusRes?.table4Count ?? 0;
    const totalQueue = transcodeQueueCount + healthCheckQueueCount;

    const processTranscodeQueue = (data: any): QueueFile[] => {
      if (!data || typeof data !== 'object') return [];
      const entries = Array.isArray(data) ? data : Object.values(data);
      return entries.slice(0, 20).map((f: any) => ({
        id: f._id ?? 'unknown',
        file: f.file ?? f.FileName ?? 'Unknown',
        fileSize: formatBytes(f.file_size ?? 0),
        container: f.container ?? 'unknown',
        codec: f.video_codec_name ?? f.ffProbeData?.streams?.[0]?.codec_name ?? 'unknown',
        resolution: f.video_resolution ?? 'unknown',
        type: 'transcode',
      }));
    };

    const processHealthQueue = (data: any): QueueFile[] => {
      if (!data || typeof data !== 'object') return [];
      const entries = Array.isArray(data) ? data : Object.values(data);
      return entries.slice(0, 20).map((f: any) => ({
        id: f._id ?? 'unknown',
        file: f.file ?? f.FileName ?? 'Unknown',
        fileSize: formatBytes(f.file_size ?? 0),
        container: f.container ?? 'unknown',
        codec: f.video_codec_name ?? 'unknown',
        resolution: f.video_resolution ?? 'unknown',
        type: 'health_check',
      }));
    };

    const transcodeFiles = processTranscodeQueue(transcodeQueueRes);
    const healthCheckFiles = processHealthQueue(healthCheckQueueRes);

    if (totalQueue === 0) {
      return {
        success: true,
        message: 'Queue is empty - no files waiting for processing',
        data: { transcodeQueueCount: 0, healthCheckQueueCount: 0, files: [] },
      };
    }

    const lines: string[] = [
      `Queue: ${totalQueue.toLocaleString()} file(s) total`,
      `- Transcode queue: ${transcodeQueueCount.toLocaleString()} file(s)`,
      `- Health check queue: ${healthCheckQueueCount.toLocaleString()} file(s)`,
    ];

    if (transcodeFiles.length > 0) {
      lines.push('', 'Next in transcode queue:');
      for (const f of transcodeFiles.slice(0, 10)) {
        const filename = f.file.split('/').pop() ?? f.file;
        lines.push(`- ${filename} (${f.codec}, ${f.resolution}, ${f.fileSize})`);
      }
      if (transcodeQueueCount > 10) {
        lines.push(`  ...and ${transcodeQueueCount - 10} more`);
      }
    }

    if (healthCheckFiles.length > 0) {
      lines.push('', 'Next in health check queue:');
      for (const f of healthCheckFiles.slice(0, 10)) {
        const filename = f.file.split('/').pop() ?? f.file;
        lines.push(`- ${filename} (${f.codec}, ${f.fileSize})`);
      }
      if (healthCheckQueueCount > 10) {
        lines.push(`  ...and ${healthCheckQueueCount - 10} more`);
      }
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        transcodeQueueCount,
        healthCheckQueueCount,
        transcodeFiles,
        healthCheckFiles,
      },
    };
  },
};
