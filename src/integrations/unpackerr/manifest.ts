import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'unpackerr',
  name: 'Unpackerr',
  description: 'Automated archive extraction for downloads',
  icon: 'package',
  color: '#0EA5E9',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Unpackerr URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:5656',
      helpText: 'The URL of your Unpackerr instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: false,
      placeholder: 'Your Unpackerr API key',
      helpText: 'API key if configured in Unpackerr',
    },
  ],
  healthCheck: {
    endpoint: '/api/status',
    interval: 60,
    timeout: 5,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Unpackerr becomes unreachable',
      defaultPrompt: 'Unpackerr is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Unpackerr comes back online',
      defaultPrompt: 'Unpackerr is back online. Check for any pending extractions.',
      enabledByDefault: true,
    },
  ],
};
