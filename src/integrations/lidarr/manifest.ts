import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'lidarr',
  name: 'Lidarr',
  description: 'Music collection management and automation',
  icon: 'music',
  color: '#00C853',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Lidarr URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:8686',
      helpText: 'The URL of your Lidarr instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your Lidarr API key',
      helpText: 'Found in Lidarr under Settings -> General -> API Key.',
      docsUrl: 'https://wiki.servarr.com/lidarr/settings#general',
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
      description: 'Triggered when Lidarr becomes unreachable',
      defaultPrompt: 'Lidarr is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Lidarr comes back online',
      defaultPrompt: 'Lidarr is back online. Check the download queue for any stalled items.',
      enabledByDefault: true,
    },
  ],
};
