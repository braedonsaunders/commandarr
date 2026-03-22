import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'transmission',
  name: 'Transmission',
  description: 'Lightweight open-source torrent client',
  icon: 'arrow-down-circle',
  color: '#B50D0D',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Transmission URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:9091',
      helpText: 'The URL of your Transmission Web UI.',
    },
    {
      key: 'username',
      label: 'Username',
      type: 'text',
      required: false,
      placeholder: 'admin',
      helpText: 'Leave empty if no auth configured',
    },
    {
      key: 'password',
      label: 'Password',
      type: 'password',
      required: false,
      placeholder: 'Your Transmission password',
      helpText: 'Leave empty if no auth configured.',
    },
  ],
  healthCheck: {
    endpoint: '/transmission/rpc',
    interval: 30,
    timeout: 5,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Transmission becomes unreachable',
      defaultPrompt: 'Transmission is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Transmission comes back online',
      defaultPrompt: 'Transmission is back online. Check for any stalled or errored torrents.',
      enabledByDefault: true,
    },
  ],
};
