import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'jellyfin',
  name: 'Jellyfin',
  description: 'Free open-source media server',
  icon: 'play-circle',
  color: '#00A4DC',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Jellyfin URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:8096',
      helpText: 'The URL of your Jellyfin instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your Jellyfin API key',
      helpText: 'Found in Jellyfin Dashboard > API Keys.',
      docsUrl: 'https://jellyfin.org/docs/general/server/configuration/',
    },
  ],
  healthCheck: {
    endpoint: '/System/Info',
    interval: 60,
    timeout: 5,
  },
  webhooks: {
    path: '/webhooks/jellyfin',
    description: 'Jellyfin playback and library events',
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Jellyfin becomes unreachable',
      defaultPrompt: 'Jellyfin is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Jellyfin comes back online',
      defaultPrompt: 'Jellyfin is back online. Check for any playback or library issues.',
      enabledByDefault: true,
    },
    {
      event: 'webhook_received',
      description: 'Triggered when a Jellyfin webhook event is received',
      defaultPrompt: 'A Jellyfin event was received. Process the event and take appropriate action.',
      enabledByDefault: false,
    },
  ],
};
