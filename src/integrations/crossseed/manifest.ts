import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'crossseed',
  name: 'Cross-seed',
  description:
    'Automatic cross-seeding — match existing torrents across trackers to build ratio without downloading new data',
  icon: 'git-merge',
  color: '#FF6B35',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Cross-seed URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:2468',
      helpText: 'The URL of your cross-seed instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: false,
      placeholder: 'Your cross-seed API key (optional)',
      helpText:
        'API key configured in your cross-seed config. Required if authentication is enabled.',
      docsUrl: 'https://www.cross-seed.org/docs/basics/options#apikey',
    },
  ],
  healthCheck: {
    endpoint: '/api/stats',
    interval: 120,
    timeout: 10,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Cross-seed becomes unreachable',
      defaultPrompt:
        'Cross-seed is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Cross-seed comes back online',
      defaultPrompt:
        'Cross-seed is back online. Check recent cross-seed activity for any missed matches.',
      enabledByDefault: true,
    },
  ],
};
