import type { ToolDefinition } from '../../_base';
import * as YAML from 'yaml';

export const tool: ToolDefinition = {
  name: 'kometa_add_overlay',
  integration: 'kometa',
  description:
    'Add a new overlay to a Kometa library config. Overlays add visual badges/labels to Plex posters (resolution, audio codec, ratings, etc.). Auto-backs up before changes.',
  parameters: {
    type: 'object',
    properties: {
      library: {
        type: 'string',
        description: 'Plex library name (e.g., "Movies", "TV Shows")',
      },
      name: {
        type: 'string',
        description: 'Overlay name (e.g., "Resolution", "Audio Codec", "IMDb Rating")',
      },
      type: {
        type: 'string',
        description:
          'Overlay type: "resolution" (4K/1080p/720p badges), "audio_codec" (Atmos/DTS-X/etc), ' +
          '"edition" (Director\'s Cut, Extended, etc), "rating" (IMDb/TMDb/RT ratings), ' +
          '"ribbon" (new/trending/popular ribbons), "streaming" (streaming service logos), ' +
          '"custom" (custom text/image overlay)',
      },
      config: {
        type: 'object',
        description:
          'Overlay configuration. For custom type, can include: text, font, font_size, font_color, ' +
          'back_color, horizontal_offset, vertical_offset, horizontal_align, vertical_align. ' +
          'For preset types, typically no extra config needed.',
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
    ctx.log(`Adding overlay "${params.name}" to library "${params.library}"...`);

    const data = (await manager.read()) as Record<string, any> | null;
    if (!data || typeof data !== 'object') {
      return { success: false, message: 'Config file is empty or invalid.' };
    }

    const config = data;

    if (!config.libraries) config.libraries = {};
    if (!config.libraries[params.library]) config.libraries[params.library] = {};

    const library = config.libraries[params.library];
    if (!library.overlays) library.overlays = {};

    // Build overlay definition based on type
    const overlayDef: Record<string, unknown> = {};

    switch (params.type) {
      case 'resolution':
        overlayDef.overlay = {
          name: 'resolution',
          plex_search: {
            all: { resolution: '4K' },
          },
        };
        // Add common resolution variants
        if (!library.overlays['Resolution - 4K']) {
          library.overlays['Resolution - 4K'] = {
            overlay: { name: 'resolution-4k', group: params.name },
            plex_search: { all: { resolution: '4K' } },
          };
        }
        if (!library.overlays['Resolution - 1080p']) {
          library.overlays['Resolution - 1080p'] = {
            overlay: { name: 'resolution-1080p', group: params.name },
            plex_search: { all: { resolution: '1080' } },
          };
        }
        if (!library.overlays['Resolution - 720p']) {
          library.overlays['Resolution - 720p'] = {
            overlay: { name: 'resolution-720p', group: params.name },
            plex_search: { all: { resolution: '720' } },
          };
        }
        break;

      case 'audio_codec':
        overlayDef.overlay = {
          name: 'audio-codec',
          plex_search: { all: { audio_track_title: 'Atmos' } },
        };
        break;

      case 'edition':
        overlayDef.overlay = {
          name: 'edition',
          plex_search: { all: { 'edition_title.is': 'Extended Edition' } },
        };
        break;

      case 'rating': {
        const ratingSource = (params.config as Record<string, unknown>)?.source ?? 'imdb';
        overlayDef.overlay = {
          name: `${ratingSource}-rating`,
          plex_search: { all: { [`audience_rating.gte`]: 0 } },
        };
        break;
      }

      case 'ribbon':
        overlayDef.overlay = {
          name: 'ribbon-new',
          plex_search: { all: { added: 30 } },
        };
        break;

      case 'streaming':
        overlayDef.overlay = {
          name: 'streaming',
        };
        break;

      case 'custom': {
        const customConfig = (params.config as Record<string, unknown>) ?? {};
        overlayDef.overlay = {
          name: params.name.toLowerCase().replace(/\s+/g, '-'),
          ...customConfig,
        };
        break;
      }

      default:
        return {
          success: false,
          message: `Unknown overlay type: "${params.type}". Use: resolution, audio_codec, edition, rating, ribbon, streaming, custom`,
        };
    }

    // For non-resolution types (which create multiple entries), add as single entry
    if (params.type !== 'resolution') {
      if (library.overlays[params.name]) {
        return {
          success: false,
          message: `Overlay "${params.name}" already exists in library "${params.library}".`,
        };
      }
      library.overlays[params.name] = overlayDef;
    }

    await manager.write(config);

    const yamlSnippet = YAML.stringify(
      { overlays: library.overlays },
      { lineWidth: 0 },
    );

    return {
      success: true,
      message:
        `Overlay "${params.name}" (${params.type}) added to library "${params.library}". ` +
        `Config backed up and written.\n\nRun kometa_run or kometa_library_run to apply overlays to Plex posters.`,
      data: { library: params.library, overlay: params.name, type: params.type },
    };
  },
};
