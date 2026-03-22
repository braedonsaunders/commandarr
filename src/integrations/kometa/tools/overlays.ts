import type { ToolDefinition } from '../../_base';

interface Overlay {
  name: string;
  library: string;
  type: string;
  appliedTo: number;
}

export const tool: ToolDefinition = {
  name: 'kometa_overlays',
  integration: 'kometa',
  description: 'List all configured Kometa overlays (resolution badges, audio codec labels, ratings, etc.) across libraries',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Overlays',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('kometa');
    ctx.log('Fetching Kometa overlays...');

    const response = await client.get('/api/v1/overlays');

    const rawOverlays = Array.isArray(response)
      ? response
      : response.overlays ?? response.data ?? [];

    const overlays: Overlay[] = rawOverlays.map((o: any) => ({
      name: o.name ?? o.title ?? 'Unnamed',
      library: o.library ?? o.library_name ?? o.libraryName ?? 'Unknown',
      type: o.type ?? o.overlay_type ?? o.overlayType ?? 'unknown',
      appliedTo: o.applied_to ?? o.appliedTo ?? o.count ?? 0,
    }));

    if (overlays.length === 0) {
      return {
        success: true,
        message: 'No overlays are currently configured in Kometa',
        data: { overlays: [] },
      };
    }

    // Group by library
    const byLibrary: Record<string, Overlay[]> = {};
    for (const overlay of overlays) {
      if (!byLibrary[overlay.library]) {
        byLibrary[overlay.library] = [];
      }
      byLibrary[overlay.library].push(overlay);
    }

    const lines: string[] = [];
    for (const [library, ovs] of Object.entries(byLibrary)) {
      lines.push(`${library} (${ovs.length} overlay${ovs.length !== 1 ? 's' : ''}):`);
      for (const ov of ovs) {
        lines.push(
          `  - ${ov.name} [${ov.type}] (applied to ${ov.appliedTo} item${ov.appliedTo !== 1 ? 's' : ''})`,
        );
      }
    }

    return {
      success: true,
      message: `${overlays.length} overlay(s) across ${Object.keys(byLibrary).length} library/libraries:\n${lines.join('\n')}`,
      data: { overlays, byLibrary: Object.keys(byLibrary) },
    };
  },
};
