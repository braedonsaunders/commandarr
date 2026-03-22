import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'readarr',
  name: 'Readarr',
  description: 'Book and audiobook collection management',
  icon: 'book-open',
  color: '#8B5CF6',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Readarr URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:8787',
      helpText: 'The URL of your Readarr instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your Readarr API key',
      helpText: 'Found in Readarr under Settings -> General -> API Key.',
      docsUrl: 'https://wiki.servarr.com/readarr/settings#general',
    },
  ],
  healthCheck: {
    endpoint: '/api/v1/system/status',
    interval: 60,
    timeout: 5,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Readarr becomes unreachable',
      defaultPrompt: 'Readarr is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Readarr comes back online',
      defaultPrompt: 'Readarr is back online. Check the download queue for any stalled items.',
      enabledByDefault: true,
    },
  ],
};
