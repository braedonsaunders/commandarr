import type { IntegrationClient } from '../_base';

interface TemplateCredentials {
  url: string;
  apiKey: string;
}

/**
 * Template client factory.
 * Adapt this to your integration's API authentication and base URL pattern.
 */
async function templateFetch(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const url = new URL(path, baseUrl);

  const headers: Record<string, string> = {
    // Adjust the auth header to match your API
    Authorization: `Bearer ${apiKey}`,
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
    throw new Error(`API error ${response.status}: ${text.slice(0, 300)}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createClient(creds: TemplateCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const { apiKey } = creds;

  return {
    async get(path: string, params?: Record<string, string>) {
      let fullPath = path;
      if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + searchParams.toString();
      }
      return templateFetch(baseUrl, apiKey, 'GET', fullPath);
    },
    async post(path: string, body?: unknown) {
      return templateFetch(baseUrl, apiKey, 'POST', path, body);
    },
    async put(path: string, body?: unknown) {
      return templateFetch(baseUrl, apiKey, 'PUT', path, body);
    },
    async delete(path: string) {
      return templateFetch(baseUrl, apiKey, 'DELETE', path);
    },
  };
}
