import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'tautulli',
  name: 'Tautulli',
  description: 'Plex media server monitoring and analytics',
  icon: 'bar-chart-2',
  color: '#E5A00D',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Tautulli URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:8181',
      helpText: 'The URL of your Tautulli instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your Tautulli API key',
      helpText: 'Found in Tautulli under Settings -> Web Interface -> API Key.',
      docsUrl: 'https://github.com/Tautulli/Tautulli/wiki/Tautulli-API-Reference',
    },
  ],
  healthCheck: {
    endpoint: 'arnold',
    interval: 60,
    timeout: 5,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Tautulli becomes unreachable',
      defaultPrompt: 'Tautulli is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Tautulli comes back online',
      defaultPrompt: 'Tautulli is back online. Check current Plex activity for any issues.',
      enabledByDefault: true,
    },
  ],
};
