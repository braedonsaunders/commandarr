import type { IntegrationClient } from '../_base';

interface BazarrCredentials {
  url: string;
  apiKey: string;
}

async function bazarrFetch(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  // Bazarr API paths already start with /api/ — do not double-prefix
  const url = new URL(path, baseUrl);

  const headers: Record<string, string> = {
    'X-API-KEY': apiKey,
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
      `Bazarr API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createClient(creds: BazarrCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const { apiKey } = creds;

  return {
    async get(path: string, params?: Record<string, string>) {
      let fullPath = path;
      if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + searchParams.toString();
      }
      return bazarrFetch(baseUrl, apiKey, 'GET', fullPath);
    },
    async post(path: string, body?: unknown) {
      return bazarrFetch(baseUrl, apiKey, 'POST', path, body);
    },
    async put(path: string, body?: unknown) {
      return bazarrFetch(baseUrl, apiKey, 'PUT', path, body);
    },
    async delete(path: string) {
      return bazarrFetch(baseUrl, apiKey, 'DELETE', path);
    },
  };
}
