import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'kometa',
  name: 'Kometa',
  description: 'Plex metadata, collections, overlays, and playlist management (formerly Plex Meta Manager)',
  icon: 'palette',
  color: '#6366F1',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Kometa API URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:5000',
      helpText: 'The URL of your Kometa API. Requires Kometa to be running with the --api flag.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: false,
      placeholder: 'Optional API key',
      helpText: 'Only required if Kometa API authentication is enabled.',
      docsUrl: 'https://kometa.wiki/en/latest/',
    },
  ],
  healthCheck: {
    endpoint: '/api/v1/status',
    interval: 120,
    timeout: 10,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when Kometa becomes unreachable',
      defaultPrompt: 'Kometa is not responding. Check if the container is running and the API flag is enabled.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when Kometa comes back online',
      defaultPrompt: 'Kometa is back online. Check the last run status for any issues.',
      enabledByDefault: true,
    },
    {
      event: 'run_completed',
      description: 'Triggered when a Kometa run finishes successfully',
      defaultPrompt: 'Kometa run has completed. Check the results for any warnings or issues with collections and overlays.',
      enabledByDefault: false,
    },
    {
      event: 'run_failed',
      description: 'Triggered when a Kometa run encounters errors',
      defaultPrompt: 'Kometa run has failed. Check the logs to identify what went wrong and report the errors.',
      enabledByDefault: true,
    },
  ],
};
