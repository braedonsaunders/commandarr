import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'maintainerr',
  name: 'Maintainerr',
  description: 'Automated media library cleanup and maintenance for Plex',
  icon: 'trash-2',
  color: '#EF4444',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Maintainerr URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:6246',
      helpText: 'The URL of your Maintainerr instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: false,
      placeholder: 'Optional API key',
      helpText: 'Only required if Maintainerr API authentication is enabled.',
      docsUrl: 'https://github.com/jorenn92/Maintainerr',
    },
  ],
  healthCheck: {
    endpoint: '/api/v1/status',
    interval: 60,
    timeout: 10,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Maintainerr becomes unreachable',
      defaultPrompt: 'Maintainerr is not responding. Check if the container is running and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Maintainerr comes back online',
      defaultPrompt: 'Maintainerr is back online. Check the current rule status and any pending cleanup actions.',
      enabledByDefault: true,
    },
    {
      event: 'items_removed',
      description: 'Triggered when Maintainerr removes items from the library',
      defaultPrompt: 'Maintainerr has removed items from your library. Check recent logs and collections for details on what was cleaned up.',
      enabledByDefault: true,
    },
    {
      event: 'rule_completed',
      description: 'Triggered when a cleanup rule finishes processing',
      defaultPrompt: 'A Maintainerr rule has finished processing. Check the rule results and any items matched for removal.',
      enabledByDefault: false,
    },
  ],
};
