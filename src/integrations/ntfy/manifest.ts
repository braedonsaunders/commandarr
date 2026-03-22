import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'ntfy',
  name: 'ntfy',
  description:
    'Self-hosted push notifications — send alerts to phones and desktops via simple HTTP pub-sub',
  icon: 'send',
  color: '#57A4FF',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'ntfy Server URL',
      type: 'url',
      required: true,
      placeholder: 'https://ntfy.sh or http://localhost:80',
      helpText: 'The URL of your ntfy server instance.',
    },
    {
      key: 'accessToken',
      label: 'Access Token',
      type: 'password',
      required: false,
      placeholder: 'tk_...',
      helpText:
        'Optional access token for authenticated ntfy servers. Leave blank for public instances.',
      docsUrl: 'https://docs.ntfy.sh/config/#access-tokens',
    },
    {
      key: 'defaultTopic',
      label: 'Default Topic',
      type: 'text',
      required: true,
      placeholder: 'commandarr',
      helpText:
        'The default topic to publish and subscribe to. This is used when no topic is explicitly specified.',
    },
  ],
  healthCheck: {
    endpoint: '/v1/health',
    interval: 60,
    timeout: 10,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when ntfy server becomes unreachable',
      defaultPrompt:
        'ntfy server is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when ntfy server comes back online',
      defaultPrompt:
        'ntfy server is back online. Verify notification services are functioning.',
      enabledByDefault: true,
    },
  ],
};
