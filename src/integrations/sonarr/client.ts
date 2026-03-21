import type { IntegrationClient } from '../_base';

interface SonarrCredentials {
  url: string;
  apiKey: string;
}

async function sonarrFetch(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const apiPath = path.startsWith('/api/v3') ? path : `/api/v3${path}`;
  const url = new URL(apiPath, baseUrl);

  const headers: Record<string, string> = {
    'X-Api-Key': apiKey,
    Accept: 'application/json',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Sonarr API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createClient(creds: SonarrCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const { apiKey } = creds;

  return {
    async get(path: string, params?: Record<string, string>) {
      let fullPath = path;
      if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + searchParams.toString();
      }
      return sonarrFetch(baseUrl, apiKey, 'GET', fullPath);
    },
    async post(path: string, body?: unknown) {
      return sonarrFetch(baseUrl, apiKey, 'POST', path, body);
    },
    async put(path: string, body?: unknown) {
      return sonarrFetch(baseUrl, apiKey, 'PUT', path, body);
    },
    async delete(path: string) {
      return sonarrFetch(baseUrl, apiKey, 'DELETE', path);
    },
  };
}
