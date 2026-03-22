import type { IntegrationManifest } from '../_base';

/**
 * Template integration manifest.
 * Copy this directory and rename it to create a new integration.
 *
 * Steps:
 * 1. Copy _template/ to your-integration/
 * 2. Update this manifest with your integration's details
 * 3. Implement client.ts with your API's auth and base URL
 * 4. Add tools in the tools/ directory
 * 5. The registry will auto-discover your integration on startup
 */
export const manifest: IntegrationManifest = {
  id: 'template',
  name: 'Template Integration',
  description: 'A template for creating new integrations',
  icon: 'puzzle',
  color: '#6B7280',
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Server URL',
      type: 'url',
      required: true,
      placeholder: 'http://localhost:8080',
      helpText: 'The base URL of the service.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your API key',
      helpText: 'The API key for authentication.',
    },
  ],
  healthCheck: {
    endpoint: '/api/health',
    interval: 60,
    timeout: 5,
  },

  // ─── Config File Management (optional) ────────────────────────────
  // Uncomment to enable config file management for this integration.
  // Users will configure the file path as a credential, and your tools
  // can read/write/backup the file via ctx.getConfigManager().
  //
  // configFiles: [
  //   {
  //     key: 'config',            // unique key to reference this file
  //     credentialKey: 'configPath', // credential field that holds the file path
  //     format: 'yaml',           // 'yaml' | 'json' | 'toml' | 'text'
  //     label: 'Service Config',  // human-readable label
  //     maxBackups: 10,           // backup rotation limit (default: 10)
  //   },
  // ],
  //
  // Don't forget to add a matching credential field:
  //   { key: 'configPath', label: 'Config File Path', type: 'text', required: false,
  //     placeholder: '/config/config.yml',
  //     helpText: 'Mount the config directory into Commandarr via Docker.' }
};
