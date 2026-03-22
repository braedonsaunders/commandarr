import type { IntegrationClient } from '../_base';

interface NtfyCredentials {
  url: string;
  accessToken?: string;
  defaultTopic: string;
}

async function ntfyFetch(
  baseUrl: string,
  accessToken: string | undefined,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const url = new URL(path, baseUrl);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
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
      `ntfy API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createClient(creds: NtfyCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const accessToken = creds.accessToken || undefined;

  return {
    async get(path: string, params?: Record<string, string>) {
      let fullPath = path;
      if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + searchParams.toString();
      }
      return ntfyFetch(baseUrl, accessToken, 'GET', fullPath);
    },
    async post(path: string, body?: unknown) {
      return ntfyFetch(baseUrl, accessToken, 'POST', path, body);
    },
    async put(path: string, body?: unknown) {
      return ntfyFetch(baseUrl, accessToken, 'PUT', path, body);
    },
    async delete(path: string) {
      return ntfyFetch(baseUrl, accessToken, 'DELETE', path);
    },
  };
}
