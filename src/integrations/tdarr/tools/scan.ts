import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'tdarr_scan',
  integration: 'tdarr',
  description:
    'Trigger a library scan in Tdarr. Can target a specific library by ID or scan all libraries.',
  parameters: {
    type: 'object',
    properties: {
      libraryId: {
        type: 'string',
        description:
          'Specific library ID to scan. If omitted, triggers a scan of all libraries. Use tdarr_libraries to find library IDs.',
      },
      mode: {
        type: 'string',
        enum: ['scanFindNew', 'scanFreshAll'],
        description:
          'Scan mode: "scanFindNew" to find new files only (default), "scanFreshAll" to re-scan all files in the library.',
      },
    },
  },
  ui: {
    category: 'Transcoding',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('tdarr');
    const libraryId = params.libraryId as string | undefined;
    const mode = (params.mode as string) ?? 'scanFindNew';

    if (libraryId) {
      ctx.log(`Triggering Tdarr scan for library: ${libraryId} (mode: ${mode})...`);
    } else {
      ctx.log(`Triggering Tdarr scan for all libraries (mode: ${mode})...`);
    }

    try {
      const body: Record<string, any> = {
        data: {
          scanConfig: {
            dbID: libraryId ?? undefined,
            arrayOrPath: libraryId ? undefined : [],
            mode,
          },
        },
      };

      await client.post('/api/v2/scan-files', body);

      const target = libraryId ? `library "${libraryId}"` : 'all libraries';
      const modeLabel = mode === 'scanFreshAll' ? 'full re-scan' : 'new files scan';

      return {
        success: true,
        message: `Scan triggered for ${target} (${modeLabel}). Files will be added to the processing queue as they are discovered.`,
        data: {
          libraryId: libraryId ?? 'all',
          mode,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to trigger scan: ${err.message ?? String(err)}`,
      };
    }
  },
};
