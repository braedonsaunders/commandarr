import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'bazarr',
  name: 'Bazarr',
  description: 'Automatic subtitle management and download',
  icon: 'subtitles',
  color: '#44B4E5',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Bazarr URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:6767',
      helpText: 'The URL of your Bazarr instance.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your Bazarr API key',
      helpText: 'Found in Bazarr under Settings -> General -> API Key.',
    },
  ],
  healthCheck: {
    endpoint: '/api/system/status',
    interval: 60,
    timeout: 5,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Bazarr becomes unreachable',
      defaultPrompt: 'Bazarr is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Bazarr comes back online',
      defaultPrompt: 'Bazarr is back online. Check for any missing subtitles that need attention.',
      enabledByDefault: true,
    },
  ],
};
