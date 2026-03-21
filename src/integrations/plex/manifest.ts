import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'plex',
  name: 'Plex Media Server',
  description: 'Monitor and control your Plex Media Server',
  icon: 'tv',
  color: '#E5A00D',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Plex Server URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:32400',
      helpText: 'The URL of your Plex Media Server, including the port.',
    },
    {
      key: 'token',
      label: 'Plex Token',
      type: 'password',
      required: true,
      placeholder: 'Your Plex authentication token',
      helpText:
        'Find your token at app.plex.tv/desktop -> Settings -> Troubleshooting -> View XML -> look for X-Plex-Token in the URL.',
      docsUrl:
        'https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/',
    },
  ],
  healthCheck: {
    endpoint: '/identity',
    interval: 60,
    timeout: 5,
  },
  webhooks: {
    path: '/webhooks/plex',
    description: 'Receives Plex webhook events for playback, library updates, and server notifications.',
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Plex becomes unreachable',
      defaultPrompt: 'Plex Media Server is not responding. Check if it needs to be restarted and report the status.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Plex comes back online',
      defaultPrompt: 'Plex Media Server is back online. Confirm everything is working normally.',
      enabledByDefault: true,
    },
    {
      event: 'webhook_received',
      description: 'Triggered when a Plex webhook event is received',
      defaultPrompt: 'A Plex webhook event was received. Process it and take any necessary action.',
      enabledByDefault: false,
    },
  ],
};
