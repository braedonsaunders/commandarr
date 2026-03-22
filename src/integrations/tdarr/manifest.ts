import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'tdarr',
  name: 'Tdarr',
  description: 'Distributed transcoding automation for media libraries',
  icon: 'cpu',
  color: '#22C55E',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Tdarr URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:8265',
      helpText: 'The URL of your Tdarr server.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: false,
      placeholder: 'Your Tdarr API key (if authentication enabled)',
      helpText: 'Only required if you have authentication enabled on your Tdarr instance.',
    },
  ],
  healthCheck: {
    endpoint: '/api/v2/status',
    interval: 60,
    timeout: 5,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Tdarr becomes unreachable',
      defaultPrompt: 'Tdarr is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Tdarr comes back online',
      defaultPrompt: 'Tdarr is back online. Check the worker status and any queued jobs.',
      enabledByDefault: true,
    },
    {
      event: 'transcode_error',
      description: 'Triggered when transcoding jobs fail repeatedly',
      defaultPrompt: 'Tdarr transcode errors detected. Check the failing files and worker health.',
      enabledByDefault: false,
    },
  ],
};
