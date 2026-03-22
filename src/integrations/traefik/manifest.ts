import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'traefik',
  name: 'Traefik',
  description:
    'Cloud-native reverse proxy — monitor routers, services, middlewares, and entrypoints with auto-discovery',
  icon: 'cloud',
  color: '#37ABC8',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Traefik API URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:8080',
      helpText:
        'The URL of the Traefik API/dashboard port (default 8080). This is separate from your web entrypoints.',
    },
    {
      key: 'configPath',
      label: 'Config File Path',
      type: 'text',
      required: false,
      placeholder: '/config/traefik/traefik.yml',
      helpText:
        'Absolute path to your traefik.yml static config file. In Docker, mount the Traefik config directory ' +
        'into Commandarr (e.g., -v /path/to/traefik:/config/traefik) and enter the path here.',
    },
  ],
  configFiles: [
    {
      key: 'config',
      credentialKey: 'configPath',
      format: 'yaml',
      label: 'Traefik Static Configuration',
      maxBackups: 10,
    },
  ],
  healthCheck: {
    endpoint: '/api/version',
    interval: 60,
    timeout: 10,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Traefik becomes unreachable',
      defaultPrompt:
        'Traefik is not responding. Check the status and report any issues.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Traefik comes back online',
      defaultPrompt:
        'Traefik is back online. Check for any routers or services that need attention.',
      enabledByDefault: true,
    },
  ],
};
