import type { IntegrationClient } from '../_base';

interface RecyclarrCredentials {
  configPath: string;
}

export function createClient(creds: RecyclarrCredentials): IntegrationClient {
  return {
    async get(path: string) {
      if (path === '/health') {
        const { existsSync } = await import('node:fs');
        if (existsSync(creds.configPath)) {
          return { status: 'ok', configPath: creds.configPath };
        }
        throw new Error(`Config file not found: ${creds.configPath}`);
      }
      throw new Error(
        'Recyclarr does not have an HTTP API. Use config file tools instead.',
      );
    },
    async post() {
      throw new Error('Recyclarr does not have an HTTP API.');
    },
    async put() {
      throw new Error('Recyclarr does not have an HTTP API.');
    },
    async delete() {
      throw new Error('Recyclarr does not have an HTTP API.');
    },
  };
}
