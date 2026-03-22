import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'uptimekuma',
  name: 'Uptime Kuma',
  description:
    'Self-hosted uptime monitoring — track service health, response times, and get alerted when services go down',
  icon: 'activity',
  color: '#5CDD8B',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Uptime Kuma URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:3001',
      helpText: 'The URL of your Uptime Kuma instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your Uptime Kuma API key',
      helpText:
        'Created in Uptime Kuma under Settings -> API Keys. Requires v1.23+.',
      docsUrl: 'https://github.com/louislam/uptime-kuma/wiki/API-Keys',
    },
  ],
  healthCheck: {
    endpoint: '/api/entry-page',
    interval: 60,
    timeout: 10,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Uptime Kuma becomes unreachable',
      defaultPrompt:
        'Uptime Kuma is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Uptime Kuma comes back online',
      defaultPrompt:
        'Uptime Kuma is back online. Check for any monitors that are currently down.',
      enabledByDefault: true,
    },
    {
      event: 'monitor_down',
      description: 'Triggered when a monitored service goes down',
      defaultPrompt:
        'A monitored service has gone down. Check the Uptime Kuma dashboard for details.',
      enabledByDefault: true,
    },
  ],
};
