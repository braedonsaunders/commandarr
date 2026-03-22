import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'recyclarr',
  name: 'Recyclarr',
  description:
    'TRaSH Guides quality profile sync — keep Sonarr and Radarr profiles up to date with community-recommended settings',
  icon: 'refresh-cw',
  color: '#2196F3',
  version: '1.0.0',
  credentials: [
    {
      key: 'configPath',
      label: 'Config File Path',
      type: 'text',
      required: true,
      placeholder: '/config/recyclarr/recyclarr.yml',
      helpText:
        'Absolute path to your recyclarr.yml config file. In Docker, mount the Recyclarr config directory ' +
        'into Commandarr (e.g., -v /path/to/recyclarr/config:/config/recyclarr) and enter the path here.',
      docsUrl: 'https://recyclarr.dev/wiki/yaml/config-reference/',
    },
  ],
  healthCheck: {
    endpoint: '/health',
    interval: 300,
    timeout: 5,
  },
  wakeHooks: [
    {
      event: 'health_down',
      description: 'Triggered when the Recyclarr config file is missing or unreadable',
      defaultPrompt:
        'Recyclarr config file is not accessible. Check if the file exists and the path is correct.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when the Recyclarr config file becomes accessible again',
      defaultPrompt:
        'Recyclarr config file is accessible again. Verify the configuration is valid.',
      enabledByDefault: true,
    },
  ],
  configFiles: [
    {
      key: 'config',
      credentialKey: 'configPath',
      format: 'yaml',
      label: 'Recyclarr Configuration',
      maxBackups: 10,
    },
  ],
};
