import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'npm',
  name: 'Nginx Proxy Manager',
  description:
    'Reverse proxy management — monitor proxy hosts, SSL certificates, and access control',
  icon: 'globe',
  color: '#F15833',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Nginx Proxy Manager URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:81',
      helpText: 'The URL of your Nginx Proxy Manager instance (default port 81).',
    },
    {
      key: 'email',
      label: 'Email',
      type: 'text',
      required: true,
      placeholder: 'admin@example.com',
      helpText: 'The email address used to log in to Nginx Proxy Manager.',
    },
    {
      key: 'password',
      label: 'Password',
      type: 'password',
      required: true,
      placeholder: 'Your NPM password',
      helpText: 'The password for your Nginx Proxy Manager account.',
    },
  ],
  healthCheck: {
    endpoint: '/api/',
    interval: 60,
    timeout: 10,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Nginx Proxy Manager becomes unreachable',
      defaultPrompt:
        'Nginx Proxy Manager is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Nginx Proxy Manager comes back online',
      defaultPrompt:
        'Nginx Proxy Manager is back online. Check for any proxy hosts or certificates that need attention.',
      enabledByDefault: true,
    },
    {
      event: 'certificate_expiring',
      description: 'Triggered when an SSL certificate is expiring soon',
      defaultPrompt:
        'An SSL certificate is expiring soon. Check the certificates list and renew any that are close to expiration.',
      enabledByDefault: true,
    },
  ],
};
