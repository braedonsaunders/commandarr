import type { ToolDefinition } from '../../_base';

interface EntityState {
  entity_id: string;
  state: string;
  friendly_name: string;
  last_changed: string;
}

const VALID_DOMAINS = [
  'light',
  'switch',
  'media_player',
  'climate',
  'sensor',
  'binary_sensor',
  'cover',
  'fan',
  'lock',
  'automation',
];

export const tool: ToolDefinition = {
  name: 'homeassistant_states',
  integration: 'homeassistant',
  description: 'List entity states from Home Assistant, optionally filtered by domain or name',
  parameters: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: `Filter by entity domain (${VALID_DOMAINS.join(', ')})`,
      },
      search: {
        type: 'string',
        description: 'Filter entities by name (case-insensitive search)',
      },
    },
  },
  ui: {
    category: 'Entities',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('homeassistant');
    ctx.log('Fetching Home Assistant entity states...');

    const allStates: any[] = await client.get('/api/states');

    let filtered = allStates;

    if (params.domain) {
      const domain = params.domain.toLowerCase();
      filtered = filtered.filter((s: any) =>
        s.entity_id.startsWith(`${domain}.`),
      );
    }

    if (params.search) {
      const search = params.search.toLowerCase();
      filtered = filtered.filter((s: any) => {
        const name = s.attributes?.friendly_name?.toLowerCase() ?? '';
        const id = s.entity_id.toLowerCase();
        return name.includes(search) || id.includes(search);
      });
    }

    const limited = filtered.slice(0, 50);

    const entities: EntityState[] = limited.map((s: any) => ({
      entity_id: s.entity_id,
      state: s.state,
      friendly_name: s.attributes?.friendly_name ?? s.entity_id,
      last_changed: s.last_changed
        ? new Date(s.last_changed).toLocaleString()
        : 'unknown',
    }));

    if (entities.length === 0) {
      return {
        success: true,
        message: 'No entities found matching the given filters.',
        data: { entities: [] },
      };
    }

    const summary = entities
      .map(
        (e) => `- ${e.friendly_name} (${e.entity_id}): ${e.state} (changed ${e.last_changed})`,
      )
      .join('\n');

    const truncatedNote =
      filtered.length > 50
        ? `\n(Showing 50 of ${filtered.length} results. Use domain or search filters to narrow down.)`
        : '';

    return {
      success: true,
      message: `${entities.length} entity/entities found:\n${summary}${truncatedNote}`,
      data: { entities, totalCount: filtered.length },
    };
  },
};
