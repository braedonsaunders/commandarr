import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'seerr',
  name: 'Seerr',
  description: 'Media request management (Overseerr/Jellyseerr/Seerr)',
  icon: 'inbox',
  color: '#6366F1',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Seerr URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:5055',
      helpText: 'The URL of your Overseerr/Jellyseerr/Seerr instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your Seerr API key',
      helpText:
        'Found in Overseerr/Jellyseerr under Settings > General > API Key.',
    },
  ],
  healthCheck: {
    endpoint: '/api/v1/status',
    interval: 60,
    timeout: 5,
  },
  webhooks: {
    path: '/webhooks/seerr',
    description: 'Seerr media request events',
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Seerr becomes unreachable',
      defaultPrompt:
        'Seerr is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Seerr comes back online',
      defaultPrompt:
        'Seerr is back online. Check for any pending media requests.',
      enabledByDefault: true,
    },
    {
      event: 'webhook_received',
      description: 'Triggered when a Seerr webhook event is received',
      defaultPrompt:
        'A new media request was submitted. Review pending requests.',
      enabledByDefault: true,
    },
  ],
};
