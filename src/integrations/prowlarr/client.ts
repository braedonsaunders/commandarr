import type { IntegrationClient } from '../_base';

interface ProwlarrCredentials {
  url: string;
  apiKey: string;
}

async function prowlarrFetch(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  // Ensure the path starts with /api/v1
  const apiPath = path.startsWith('/api/v1') ? path : `/api/v1${path}`;
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
      `Prowlarr API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createClient(creds: ProwlarrCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const { apiKey } = creds;

  return {
    async get(path: string, params?: Record<string, string>) {
      let fullPath = path;
      if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + searchParams.toString();
      }
      return prowlarrFetch(baseUrl, apiKey, 'GET', fullPath);
    },
    async post(path: string, body?: unknown) {
      return prowlarrFetch(baseUrl, apiKey, 'POST', path, body);
    },
    async put(path: string, body?: unknown) {
      return prowlarrFetch(baseUrl, apiKey, 'PUT', path, body);
    },
    async delete(path: string) {
      return prowlarrFetch(baseUrl, apiKey, 'DELETE', path);
    },
  };
}
