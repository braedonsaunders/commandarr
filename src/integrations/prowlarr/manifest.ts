import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'prowlarr',
  name: 'Prowlarr',
  description: 'Centralized indexer manager for the *arr stack',
  icon: 'search',
  color: '#D48827',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Prowlarr URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:9696',
      helpText: 'The URL of your Prowlarr instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your Prowlarr API key',
      helpText: 'Found in Prowlarr under Settings -> General -> API Key.',
      docsUrl: 'https://wiki.servarr.com/prowlarr/settings#general',
    },
  ],
  healthCheck: {
    endpoint: '/api/v1/system/status',
    interval: 60,
    timeout: 5,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Prowlarr becomes unreachable',
      defaultPrompt: 'Prowlarr is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Prowlarr comes back online',
      defaultPrompt: 'Prowlarr is back online. Check indexer health for any issues.',
      enabledByDefault: true,
    },
  ],
};
