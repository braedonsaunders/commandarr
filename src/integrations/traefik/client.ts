import type { IntegrationClient } from '../_base';

interface TraefikCredentials {
  url: string;
}

async function traefikFetch(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const url = new URL(path, baseUrl);

  const headers: Record<string, string> = {
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
      `Traefik API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createClient(creds: TraefikCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');

  return {
    async get(path: string, params?: Record<string, string>) {
      let fullPath = path;
      if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + searchParams.toString();
      }
      return traefikFetch(baseUrl, 'GET', fullPath);
    },
    async post(path: string, body?: unknown) {
      return traefikFetch(baseUrl, 'POST', path, body);
    },
    async put(path: string, body?: unknown) {
      return traefikFetch(baseUrl, 'PUT', path, body);
    },
    async delete(path: string) {
      return traefikFetch(baseUrl, 'DELETE', path);
    },
  };
}
