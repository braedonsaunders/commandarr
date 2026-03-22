import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'caddy',
  name: 'Caddy',
  description:
    'Modern reverse proxy with automatic HTTPS — monitor routes, upstream health, and TLS certificates',
  icon: 'lock',
  color: '#22D3EE',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Caddy Admin API URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:2019',
      helpText:
        'The URL of the Caddy admin API (default port 2019). This is localhost-only by default.',
    },
  ],
  healthCheck: {
    endpoint: '/config/',
    interval: 60,
    timeout: 10,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Caddy becomes unreachable',
      defaultPrompt:
        'Caddy is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Caddy comes back online',
      defaultPrompt:
        'Caddy is back online. Check for any routes or upstreams that need attention.',
      enabledByDefault: true,
    },
  ],
};
