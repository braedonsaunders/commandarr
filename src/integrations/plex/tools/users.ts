import type { ToolDefinition } from '../../_base';
import { parseXmlElements } from '../client';

export const tool: ToolDefinition = {
  name: 'plex_users',
  integration: 'plex',
  description: 'List all Plex user accounts including shared/managed users',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'System',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('plex');
    ctx.log('Fetching Plex accounts...');

    const response = await client.get('/accounts');

    interface UserInfo {
      id: string;
      name: string;
      defaultAudioLanguage: string;
      defaultSubtitleLanguage: string;
      autoSelectAudio: boolean;
      autoSelectSubtitle: boolean;
    }

    const users: UserInfo[] = [];

    if (response.MediaContainer) {
      const items = response.MediaContainer.Account ?? [];
      const accountArray = Array.isArray(items) ? items : [items];

      for (const a of accountArray) {
        if (!a) continue;
        users.push({
          id: a.id ?? '',
          name: a.name ?? 'Unknown',
          defaultAudioLanguage: a.defaultAudioLanguage ?? '',
          defaultSubtitleLanguage: a.defaultSubtitleLanguage ?? '',
          autoSelectAudio: a.autoSelectAudio === true || a.autoSelectAudio === '1',
          autoSelectSubtitle: a.autoSelectSubtitle === true || a.autoSelectSubtitle === '1',
        });
      }
    } else if (response._xml) {
      const parsed = parseXmlElements(response._xml as string, 'Account');
      for (const attrs of parsed) {
        users.push({
          id: attrs.id ?? '',
          name: attrs.name ?? 'Unknown',
          defaultAudioLanguage: attrs.defaultAudioLanguage ?? '',
          defaultSubtitleLanguage: attrs.defaultSubtitleLanguage ?? '',
          autoSelectAudio: attrs.autoSelectAudio === '1',
          autoSelectSubtitle: attrs.autoSelectSubtitle === '1',
        });
      }
    }

    if (users.length === 0) {
      return { success: true, message: 'No user accounts found.', data: { users: [] } };
    }

    const summary = users
      .map(
        (u) =>
          `- ${u.name} (id: ${u.id})${u.defaultAudioLanguage ? ` — audio: ${u.defaultAudioLanguage}` : ''}${u.defaultSubtitleLanguage ? `, subs: ${u.defaultSubtitleLanguage}` : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${users.length} user account(s):\n${summary}`,
      data: { users },
    };
  },
};
