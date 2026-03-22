import type { ToolDefinition } from '../../_base';

interface VirtualFolder {
  Name: string;
  CollectionType?: string;
  ItemId: string;
  Locations: string[];
  LibraryOptions?: {
    EnableRealtimeMonitor?: boolean;
  };
}

export const tool: ToolDefinition = {
  name: 'jellyfin_libraries',
  integration: 'jellyfin',
  description: 'List all Jellyfin media libraries',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Library',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('jellyfin');
    ctx.log('Fetching Jellyfin libraries...');

    const folders: VirtualFolder[] = await client.get('/Library/VirtualFolders');

    if (!Array.isArray(folders) || folders.length === 0) {
      return {
        success: true,
        message: 'No libraries found',
        data: { libraries: [] },
      };
    }

    const libraries = folders.map((f) => ({
      name: f.Name,
      type: f.CollectionType ?? 'unknown',
      itemId: f.ItemId,
      locations: f.Locations,
      realtimeMonitor: f.LibraryOptions?.EnableRealtimeMonitor ?? false,
    }));

    const summary = libraries
      .map(
        (lib) =>
          `- ${lib.name} (${lib.type}) — ${lib.locations.length} path(s)`,
      )
      .join('\n');

    return {
      success: true,
      message: `${libraries.length} library/libraries:\n${summary}`,
      data: { libraries },
    };
  },
};
