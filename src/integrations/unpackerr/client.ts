import type { IntegrationClient } from '../_base';

interface UnpackerrCredentials {
  url: string;
  apiKey?: string;
}

async function unpackerrFetch(
  baseUrl: string,
  apiKey: string | undefined,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const url = new URL(path, baseUrl);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (apiKey) {
    headers['X-API-Key'] = apiKey;
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
      `Unpackerr API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createClient(creds: UnpackerrCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const apiKey = creds.apiKey || undefined;

  return {
    async get(path: string, params?: Record<string, string>) {
      let fullPath = path;
      if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + searchParams.toString();
      }
      return unpackerrFetch(baseUrl, apiKey, 'GET', fullPath);
    },
    async post(path: string, body?: unknown) {
      return unpackerrFetch(baseUrl, apiKey, 'POST', path, body);
    },
    async put(path: string, body?: unknown) {
      return unpackerrFetch(baseUrl, apiKey, 'PUT', path, body);
    },
    async delete(path: string) {
      return unpackerrFetch(baseUrl, apiKey, 'DELETE', path);
    },
  };
}
