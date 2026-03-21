import type { ToolDefinition } from '../../_base';

interface PlexLibrary {
  key: string;
  title: string;
  type: string;
  agent: string;
  scanner: string;
  refreshing: boolean;
}

export const tool: ToolDefinition = {
  name: 'plex_libraries',
  integration: 'plex',
  description: 'List all Plex libraries with their types and metadata',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Libraries',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('plex');
    ctx.log('Fetching Plex libraries...');

    const response = await client.get('/library/sections');
    const libraries: PlexLibrary[] = [];

    if (response.MediaContainer) {
      const dirs = response.MediaContainer.Directory ?? [];
      const items = Array.isArray(dirs) ? dirs : [dirs];

      for (const dir of items) {
        if (!dir) continue;
        libraries.push({
          key: dir.key ?? '',
          title: dir.title ?? 'Unknown',
          type: dir.type ?? 'unknown',
          agent: dir.agent ?? '',
          scanner: dir.scanner ?? '',
          refreshing: dir.refreshing === true || dir.refreshing === '1',
        });
      }
    } else if (response._xml) {
      const xml = response._xml as string;
      const dirRegex = /<Directory\s([^>]*)\/?\s*>/gi;
      let match: RegExpExecArray | null;

      while ((match = dirRegex.exec(xml)) !== null) {
        const attrs = match[1]!;
        const getAttr = (name: string) => {
          const r = new RegExp(`${name}="([^"]*)"`, 'i');
          return r.exec(attrs)?.[1];
        };

        libraries.push({
          key: getAttr('key') ?? '',
          title: getAttr('title') ?? 'Unknown',
          type: getAttr('type') ?? 'unknown',
          agent: getAttr('agent') ?? '',
          scanner: getAttr('scanner') ?? '',
          refreshing: getAttr('refreshing') === '1',
        });
      }
    }

    if (libraries.length === 0) {
      return {
        success: true,
        message: 'No libraries found on Plex server',
        data: { libraries: [] },
      };
    }

    const summary = libraries
      .map((lib) => `- ${lib.title} (${lib.type}, key: ${lib.key})`)
      .join('\n');

    return {
      success: true,
      message: `${libraries.length} libraries:\n${summary}`,
      data: { libraries },
    };
  },
};
