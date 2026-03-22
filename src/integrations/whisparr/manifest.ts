import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'whisparr',
  name: 'Whisparr',
  description: 'Adult content collection management',
  icon: 'eye-off',
  color: '#EC4899',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Whisparr URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:6969',
      helpText: 'The URL of your Whisparr instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your Whisparr API key',
      helpText: 'Found in Whisparr under Settings > General > API Key.',
    },
  ],
  healthCheck: {
    endpoint: '/api/v3/system/status',
    interval: 60,
    timeout: 5,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Whisparr becomes unreachable',
      defaultPrompt: 'Whisparr is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Whisparr comes back online',
      defaultPrompt: 'Whisparr is back online. Check the download queue for any stalled items.',
      enabledByDefault: true,
    },
  ],
};
