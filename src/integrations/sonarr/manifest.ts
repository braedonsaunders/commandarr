import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'sonarr',
  name: 'Sonarr',
  description: 'TV series collection management and automation',
  icon: 'monitor',
  color: '#35C5F4',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Sonarr URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:8989',
      helpText: 'The URL of your Sonarr instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your Sonarr API key',
      helpText: 'Found in Sonarr under Settings -> General -> API Key.',
      docsUrl: 'https://wiki.servarr.com/sonarr/settings#general',
    },
  ],
  healthCheck: {
    endpoint: '/api/v3/system/status',
    interval: 60,
    timeout: 5,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Sonarr becomes unreachable',
      defaultPrompt: 'Sonarr is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Sonarr comes back online',
      defaultPrompt: 'Sonarr is back online. Check the download queue for any stalled items.',
      enabledByDefault: true,
    },
  ],
};
