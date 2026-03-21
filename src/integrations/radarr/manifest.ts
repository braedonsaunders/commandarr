import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'radarr',
  name: 'Radarr',
  description: 'Movie collection management and automation',
  icon: 'film',
  color: '#FFC230',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Radarr URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:7878',
      helpText: 'The URL of your Radarr instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your Radarr API key',
      helpText: 'Found in Radarr under Settings -> General -> API Key.',
      docsUrl: 'https://wiki.servarr.com/radarr/settings#general',
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
      description: 'Triggered when Radarr becomes unreachable',
      defaultPrompt: 'Radarr is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Radarr comes back online',
      defaultPrompt: 'Radarr is back online. Check the download queue for any stalled items.',
      enabledByDefault: true,
    },
  ],
};
