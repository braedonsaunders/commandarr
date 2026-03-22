import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'docker',
  name: 'Docker',
  description: 'Container management, updates, and rollback via Docker Engine API',
  icon: 'container',
  color: '#2496ED',
  version: '1.0.0',
  credentials: [
    {
      key: 'socketPath',
      label: 'Docker Socket Path',
      type: 'text',
      required: false,
      placeholder: '/var/run/docker.sock',
      helpText:
        'Path to the Docker socket. Defaults to /var/run/docker.sock. Use this for local Docker access.',
    },
    {
      key: 'host',
      label: 'Docker Host URL',
      type: 'url',
      required: false,
      placeholder: 'http://localhost:2375',
      helpText:
        'Docker Engine API URL. Use this for remote Docker access or Docker over TCP. Leave blank if using socket.',
    },
  ],
  healthCheck: {
    endpoint: '/_ping',
    interval: 60,
    timeout: 5,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Docker Engine becomes unreachable',
      defaultPrompt:
        'Docker Engine is not responding. This may affect all containerized services. Check if Docker is running.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Docker Engine comes back online',
      defaultPrompt:
        'Docker Engine is back online. Check the status of all containers and report any that are not running.',
      enabledByDefault: true,
    },
    {
      event: 'container_unhealthy',
      description: 'Triggered when a container health check fails after an update',
      defaultPrompt:
        'A container became unhealthy after an update. Check if a rollback is needed and report the situation.',
      enabledByDefault: true,
    },
  ],
};
