import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'homeassistant',
  name: 'Home Assistant',
  description: 'Smart home automation and control',
  icon: 'home',
  color: '#18BCF2',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Home Assistant URL',
      type: 'url',
      required: true,
      placeholder: 'http://homeassistant.local:8123',
      helpText: 'The URL of your Home Assistant instance.',
    },
    {
      key: 'token',
      label: 'Long-Lived Access Token',
      type: 'password',
      required: true,
      placeholder: 'Your Home Assistant access token',
      helpText: 'Long-lived access token from Profile > Security > Long-Lived Access Tokens',
      docsUrl: 'https://www.home-assistant.io/docs/authentication/',
    },
  ],
  healthCheck: {
    endpoint: '/api/',
    interval: 60,
    timeout: 5,
  },
  webhooks: {
    path: '/webhooks/homeassistant',
    description: 'Home Assistant automation events',
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Home Assistant becomes unreachable',
      defaultPrompt: 'Home Assistant is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Home Assistant comes back online',
      defaultPrompt: 'Home Assistant is back online. Check for any missed automations.',
      enabledByDefault: true,
    },
    {
      event: 'webhook_received',
      description: 'Triggered when Home Assistant sends a webhook event',
      defaultPrompt: 'Home Assistant triggered an event. Check what happened.',
      enabledByDefault: true,
    },
  ],
};
