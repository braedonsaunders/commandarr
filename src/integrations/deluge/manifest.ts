import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'deluge',
  name: 'Deluge',
  description: 'Lightweight cross-platform torrent client',
  icon: 'flame',
  color: '#2E5EAA',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Deluge URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:8112',
      helpText: 'The URL of your Deluge WebUI.',
    },
    {
      key: 'password',
      label: 'Password',
      type: 'password',
      required: true,
      placeholder: 'Your Deluge password',
      helpText: 'WebUI password (default: deluge)',
    },
  ],
  healthCheck: {
    endpoint: '/json',
    interval: 30,
    timeout: 5,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Deluge becomes unreachable',
      defaultPrompt: 'Deluge is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Deluge comes back online',
      defaultPrompt: 'Deluge is back online. Check for any stalled or errored torrents.',
      enabledByDefault: true,
    },
  ],
};
