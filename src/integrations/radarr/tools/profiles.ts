import type { ToolDefinition } from '../../_base';

interface QualityProfile {
  id: number;
  name: string;
  upgradeAllowed: boolean;
  cutoff: string;
  items: string[];
}

export const tool: ToolDefinition = {
  name: 'radarr_profiles',
  integration: 'radarr',
  description: 'List quality profiles configured in Radarr',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Configuration',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('radarr');
    ctx.log('Fetching Radarr quality profiles...');

    const results = await client.get('/api/v3/qualityprofile');

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: 'No quality profiles found',
        data: { profiles: [] },
      };
    }

    const profiles: QualityProfile[] = results.map((p: any) => {
      const cutoffItem = p.items?.find(
        (i: any) => i.quality?.id === p.cutoff || i.id === p.cutoff,
      );

      return {
        id: p.id,
        name: p.name ?? 'Unknown',
        upgradeAllowed: p.upgradeAllowed ?? false,
        cutoff: cutoffItem?.quality?.name ?? cutoffItem?.name ?? 'Unknown',
        items: (p.items ?? [])
          .filter((i: any) => i.allowed)
          .map(
            (i: any) =>
              i.quality?.name ?? i.name ?? 'Unknown',
          ),
      };
    });

    const summary = profiles
      .map(
        (p) =>
          `- ${p.name} (ID: ${p.id}, cutoff: ${p.cutoff}, upgrade: ${p.upgradeAllowed ? 'yes' : 'no'})`,
      )
      .join('\n');

    return {
      success: true,
      message: `${profiles.length} quality profile(s):\n${summary}`,
      data: { profiles },
    };
  },
};
