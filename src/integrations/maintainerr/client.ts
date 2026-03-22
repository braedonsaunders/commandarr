import type { IntegrationClient } from '../_base';

interface MaintainerrCredentials {
  url: string;
  apiKey?: string;
}

async function maintainerrFetch(
  baseUrl: string,
  apiKey: string | undefined,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const apiPath = path.startsWith('/api/v1') ? path : `/api/v1${path}`;
  const url = new URL(apiPath, baseUrl);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (apiKey) {
    headers['X-Api-Key'] = apiKey;
  }

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
      `Maintainerr API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createClient(creds: MaintainerrCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const apiKey = creds.apiKey || undefined;

  return {
    async get(path: string, params?: Record<string, string>) {
      let fullPath = path;
      if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + searchParams.toString();
      }
      return maintainerrFetch(baseUrl, apiKey, 'GET', fullPath);
    },
    async post(path: string, body?: unknown) {
      return maintainerrFetch(baseUrl, apiKey, 'POST', path, body);
    },
    async put(path: string, body?: unknown) {
      return maintainerrFetch(baseUrl, apiKey, 'PUT', path, body);
    },
    async delete(path: string) {
      return maintainerrFetch(baseUrl, apiKey, 'DELETE', path);
    },
  };
}
