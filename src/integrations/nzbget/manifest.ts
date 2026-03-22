import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'nzbget',
  name: 'NZBGet',
  description: 'Efficient Usenet download client',
  icon: 'download-cloud',
  color: '#48A23F',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'NZBGet URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:6789',
      helpText: 'The URL of your NZBGet instance.',
    },
    {
      key: 'username',
      label: 'Username',
      type: 'text',
      required: true,
      placeholder: 'nzbget',
      helpText: 'Default: nzbget',
    },
    {
      key: 'password',
      label: 'Password',
      type: 'password',
      required: true,
      placeholder: 'Your NZBGet password',
      helpText: 'Default: tegbzn6789',
    },
  ],
  healthCheck: {
    endpoint: '/jsonrpc/version',
    interval: 30,
    timeout: 5,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when NZBGet becomes unreachable',
      defaultPrompt: 'NZBGet is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when NZBGet comes back online',
      defaultPrompt: 'NZBGet is back online. Check the download queue for any stalled items.',
      enabledByDefault: true,
    },
  ],
};
