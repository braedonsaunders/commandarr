import type { ToolDefinition } from '../../_base';
import * as YAML from 'yaml';

export const tool: ToolDefinition = {
  name: 'kometa_add_collection',
  integration: 'kometa',
  description:
    'Add a new collection to a Kometa library config. Generates the YAML structure, merges it into the existing config, validates, and writes. Auto-backs up before changes.',
  parameters: {
    type: 'object',
    properties: {
      library: {
        type: 'string',
        description: 'Plex library name to add the collection to (e.g., "Movies", "TV Shows")',
      },
      name: {
        type: 'string',
        description: 'Collection name (e.g., "90s Action Movies", "Oscar Winners")',
      },
      type: {
        type: 'string',
        description:
          'Collection type: "plex_search" (filter Plex metadata), "smart_filter" (dynamic smart collection), ' +
          '"trakt_list" (from Trakt list URL), "imdb_list" (from IMDb list URL), "tmdb_collection" (TMDb collection ID), ' +
          '"tmdb_list" (TMDb list ID), "mdblist_list" (MDBList URL)',
      },
      source: {
        type: 'string',
        description:
          'Source value depending on type: URL for trakt/imdb/mdblist lists, TMDb ID for tmdb types, or omit for plex_search/smart_filter',
      },
      filters: {
        type: 'object',
        description:
          'Filter criteria for plex_search/smart_filter types. Keys can include: genre, year, decade, rating, resolution, audio_language, subtitle_language, etc.',
      },
      sort_title: {
        type: 'string',
        description: 'Optional sort title to control collection ordering (e.g., "++++90s Action" to sort near top)',
      },
      sync_mode: {
        type: 'string',
        description: 'How to sync: "sync" (match exactly, removes items not matching) or "append" (only add, never remove). Default: "append"',
      },
      summary: {
        type: 'string',
        description: 'Optional collection description/summary text',
      },
      poster_url: {
        type: 'string',
        description: 'Optional URL to a poster image for the collection',
      },
    },
    required: ['library', 'name', 'type'],
  },
  ui: {
    category: 'Config',
    dangerLevel: 'high',
    testable: false,
  },
  async handler(params, ctx) {
    const manager = await ctx.getConfigManager('kometa', 'config');
    ctx.log(`Adding collection "${params.name}" to library "${params.library}"...`);

    const data = (await manager.read()) as Record<string, unknown> | null;
    if (!data || typeof data !== 'object') {
      return { success: false, message: 'Config file is empty or invalid.' };
    }

    const config = data as Record<string, any>;

    // Ensure libraries section exists
    if (!config.libraries) {
      config.libraries = {};
    }

    // Ensure the target library exists
    if (!config.libraries[params.library]) {
      config.libraries[params.library] = {};
    }

    const library = config.libraries[params.library];

    // Ensure collections section exists in the library
    if (!library.collections) {
      library.collections = {};
    }

    // Build the collection definition
    const collectionDef: Record<string, unknown> = {};

    // Set the source based on type
    switch (params.type) {
      case 'trakt_list':
        collectionDef.trakt_list = params.source;
        break;
      case 'imdb_list':
        collectionDef.imdb_list = params.source;
        break;
      case 'tmdb_collection':
        collectionDef.tmdb_collection = Number(params.source) || params.source;
        break;
      case 'tmdb_list':
        collectionDef.tmdb_list = Number(params.source) || params.source;
        break;
      case 'mdblist_list':
        collectionDef.mdblist_list = params.source;
        break;
      case 'plex_search': {
        const search: Record<string, unknown> = {};
        if (params.filters && typeof params.filters === 'object') {
          for (const [key, value] of Object.entries(params.filters)) {
            search[key] = value;
          }
        }
        collectionDef.plex_search = { all: search };
        break;
      }
      case 'smart_filter': {
        const filter: Record<string, unknown> = {};
        if (params.filters && typeof params.filters === 'object') {
          for (const [key, value] of Object.entries(params.filters)) {
            filter[key] = value;
          }
        }
        collectionDef.smart_filter = { all: filter, sort_by: 'random' };
        break;
      }
      default:
        return { success: false, message: `Unknown collection type: "${params.type}". Use one of: plex_search, smart_filter, trakt_list, imdb_list, tmdb_collection, tmdb_list, mdblist_list` };
    }

    // Add optional fields
    collectionDef.sync_mode = params.sync_mode || 'append';

    if (params.sort_title) {
      collectionDef.sort_title = params.sort_title;
    }
    if (params.summary) {
      collectionDef.summary = params.summary;
    }
    if (params.poster_url) {
      collectionDef.url_poster = params.poster_url;
    }

    // Check for existing collection with same name
    if (library.collections[params.name]) {
      return {
        success: false,
        message: `Collection "${params.name}" already exists in library "${params.library}". Use kometa_edit_config to modify it, or choose a different name.`,
        data: { existing: library.collections[params.name] },
      };
    }

    // Add the collection
    library.collections[params.name] = collectionDef;

    // Write (auto-backup + validate)
    await manager.write(config);

    const yamlSnippet = YAML.stringify(
      { [params.name]: collectionDef },
      { lineWidth: 0 },
    );

    return {
      success: true,
      message:
        `Collection "${params.name}" added to library "${params.library}". ` +
        `Config backed up and written.\n\nGenerated YAML:\n\`\`\`yaml\n${yamlSnippet}\`\`\`\n\n` +
        `Run kometa_run or kometa_library_run to apply changes to Plex.`,
      data: { library: params.library, collection: params.name, definition: collectionDef },
    };
  },
};
