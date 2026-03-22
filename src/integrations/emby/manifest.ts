import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'emby',
  name: 'Emby',
  description: 'Personal media server with live TV and DVR',
  icon: 'tv',
  color: '#4CAF50',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Emby URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:8096',
      helpText: 'The URL of your Emby instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your Emby API key',
      helpText: 'Found in Emby Dashboard > Advanced > API Keys',
    },
  ],
  healthCheck: {
    endpoint: '/System/Info',
    interval: 60,
    timeout: 5,
  },
  webhooks: {
    path: '/webhooks/emby',
    description: 'Emby playback and library events',
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Emby becomes unreachable',
      defaultPrompt: 'Emby is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Emby comes back online',
      defaultPrompt: 'Emby is back online. Check for any playback or library issues.',
      enabledByDefault: true,
    },
    {
      event: 'webhook_received',
      description: 'Triggered when an Emby webhook event is received',
      defaultPrompt: 'An Emby event was received. Process the event and take appropriate action.',
      enabledByDefault: false,
    },
  ],
};
