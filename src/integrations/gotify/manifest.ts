import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'gotify',
  name: 'Gotify',
  description:
    'Simple self-hosted notification server — push notifications with priority levels and application separation',
  icon: 'message-square',
  color: '#1E88E5',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Gotify Server URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:80',
      helpText: 'The URL of your Gotify server instance.',
    },
    {
      key: 'clientToken',
      label: 'Client Token',
      type: 'password',
      required: true,
      placeholder: 'C...',
      helpText:
        'Gotify client token used for reading messages. Create one under Clients in the Gotify UI.',
      docsUrl: 'https://gotify.net/docs/pushmsg',
    },
    {
      key: 'appToken',
      label: 'Application Token',
      type: 'password',
      required: true,
      placeholder: 'A...',
      helpText:
        'Gotify application token used for sending messages. Create one under Apps in the Gotify UI.',
      docsUrl: 'https://gotify.net/docs/pushmsg',
    },
  ],
  healthCheck: {
    endpoint: '/health',
    interval: 60,
    timeout: 10,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Gotify server becomes unreachable',
      defaultPrompt:
        'Gotify server is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Gotify server comes back online',
      defaultPrompt:
        'Gotify server is back online. Verify notification services are functioning.',
      enabledByDefault: true,
    },
  ],
};
