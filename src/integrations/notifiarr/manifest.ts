import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'notifiarr',
  name: 'Notifiarr',
  description:
    'Unified notification hub for the *arr ecosystem — Discord alerts for downloads, playback, health checks, and more',
  icon: 'bell',
  color: '#5865F2',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Notifiarr Client URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:5454',
      helpText: 'The URL of your Notifiarr client instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your Notifiarr API key',
      helpText: 'Found in your Notifiarr client configuration file.',
      docsUrl: 'https://notifiarr.wiki/en/Client/Configuration',
    },
  ],
  healthCheck: {
    endpoint: '/api/version',
    interval: 60,
    timeout: 10,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Notifiarr client becomes unreachable',
      defaultPrompt:
        'Notifiarr client is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Notifiarr client comes back online',
      defaultPrompt:
        'Notifiarr client is back online. Verify notification services are functioning.',
      enabledByDefault: true,
    },
    {
      event: 'notification_failure',
      description:
        'Triggered when a notification fails to deliver',
      defaultPrompt:
        'A Notifiarr notification failed to deliver. Check recent notifications and service status.',
      enabledByDefault: true,
    },
  ],
};
