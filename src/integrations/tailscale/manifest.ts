import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'tailscale',
  name: 'Tailscale',
  description: 'Monitor your Tailscale network, devices, routes, and DNS configuration',
  icon: 'globe',
  color: '#4A5568',
  version: '1.0.0',
  credentials: [
    {
      key: 'apiKey',
      label: 'Tailscale API Key',
      type: 'password',
      required: true,
      placeholder: 'tskey-api-...',
      helpText:
        'Generate an API key from the Tailscale admin console under Settings > Keys.',
      docsUrl: 'https://tailscale.com/kb/1101/api',
    },
    {
      key: 'tailnet',
      label: 'Tailnet Name',
      type: 'text',
      required: true,
      placeholder: 'example.com',
      helpText:
        'Your tailnet name, found at the top of the Tailscale admin console. Use "-" to refer to the default tailnet for the API key owner.',
    },
  ],
  healthCheck: {
    endpoint: '/api/v2/tailnet/{tailnet}/devices',
    interval: 120,
    timeout: 10,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when the Tailscale API becomes unreachable',
      defaultPrompt:
        'Tailscale API is not responding. Check connectivity and report status.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when the Tailscale API comes back online',
      defaultPrompt:
        'Tailscale API is back online. Confirm all devices are reachable.',
      enabledByDefault: true,
    },
    {
      event: 'key_expiring',
      description: 'Triggered when a device key is close to expiry',
      defaultPrompt:
        'A Tailscale device key is expiring soon. Check which devices need key renewal and alert the user.',
      enabledByDefault: true,
    },
  ],
};
