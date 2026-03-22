import type { IntegrationManifest } from '../_base';
import { registerConfigValidator } from '../_config-manager';
import { kometaConfigValidator } from './config-validator';

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
    {
      key: 'configPath',
      label: 'Config File Path',
      type: 'text',
      required: false,
      placeholder: '/kometa-config/config.yml',
      helpText:
        'Absolute path to your Kometa config.yml file. Required for config editing features. ' +
        'In Docker, mount the Kometa config directory into Commandarr (e.g., ' +
        '-v /path/to/kometa/config:/kometa-config) and enter the path here.',
      docsUrl: 'https://kometa.wiki/en/latest/config/overview/',
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
  configFiles: [
    {
      key: 'config',
      credentialKey: 'configPath',
      format: 'yaml',
      label: 'Kometa Config (config.yml)',
      maxBackups: 15,
    },
  ],
};

// Register the Kometa-specific config validator
registerConfigValidator('kometa', 'config', kometaConfigValidator);
