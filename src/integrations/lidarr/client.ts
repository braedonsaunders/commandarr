import type { IntegrationClient } from '../_base';

interface LidarrCredentials {
  url: string;
  apiKey: string;
}

async function lidarrFetch(
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
      `Lidarr API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createClient(creds: LidarrCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const { apiKey } = creds;

  return {
    async get(path: string, params?: Record<string, string>) {
      let fullPath = path;
      if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + searchParams.toString();
      }
      return lidarrFetch(baseUrl, apiKey, 'GET', fullPath);
    },
    async post(path: string, body?: unknown) {
      return lidarrFetch(baseUrl, apiKey, 'POST', path, body);
    },
    async put(path: string, body?: unknown) {
      return lidarrFetch(baseUrl, apiKey, 'PUT', path, body);
    },
    async delete(path: string) {
      return lidarrFetch(baseUrl, apiKey, 'DELETE', path);
    },
  };
}
