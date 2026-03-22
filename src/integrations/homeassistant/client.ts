import type { IntegrationClient } from '../_base';

interface HomeAssistantCredentials {
  url: string;
  token: string;
}

async function haFetch(
  baseUrl: string,
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const apiPath = path.startsWith('/api/') ? path : `/api/${path}`;
  const url = new URL(apiPath, baseUrl);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
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
      `Home Assistant API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createClient(creds: HomeAssistantCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const { token } = creds;

  return {
    async get(path: string, params?: Record<string, string>) {
      let fullPath = path;
      if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + searchParams.toString();
      }
      return haFetch(baseUrl, token, 'GET', fullPath);
    },
    async post(path: string, body?: unknown) {
      return haFetch(baseUrl, token, 'POST', path, body);
    },
    async put(path: string, body?: unknown) {
      return haFetch(baseUrl, token, 'PUT', path, body);
    },
    async delete(path: string) {
      return haFetch(baseUrl, token, 'DELETE', path);
    },
  };
}
