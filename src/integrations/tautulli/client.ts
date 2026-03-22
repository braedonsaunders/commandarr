import type { IntegrationClient } from '../_base';

interface TautulliCredentials {
  url: string;
  apiKey: string;
}

async function tautulliFetch(
  baseUrl: string,
  apiKey: string,
  method: string,
  cmd: string,
  params?: Record<string, string>,
): Promise<any> {
  const url = new URL('/api/v2', baseUrl);
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('cmd', cmd);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Tautulli API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const json = await response.json();
    // Tautulli wraps responses in { response: { result, data } }
    if (json?.response?.result === 'success') {
      return json.response.data;
    }
    if (json?.response?.result === 'error') {
      throw new Error(
        `Tautulli API error: ${json.response.message ?? 'Unknown error'}`,
      );
    }
    return json;
  }

  return response.text();
}

export function createClient(creds: TautulliCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const { apiKey } = creds;

  return {
    async get(path: string, params?: Record<string, string>) {
      return tautulliFetch(baseUrl, apiKey, 'GET', path, params);
    },
    async post(path: string, body?: unknown) {
      // Tautulli API is query-param based; post passes params as a record
      const params =
        body && typeof body === 'object' && !Array.isArray(body)
          ? (Object.fromEntries(
              Object.entries(body as Record<string, unknown>).map(([k, v]) => [
                k,
                String(v),
              ]),
            ) as Record<string, string>)
          : undefined;
      return tautulliFetch(baseUrl, apiKey, 'GET', path, params);
    },
    async put(path: string, body?: unknown) {
      const params =
        body && typeof body === 'object' && !Array.isArray(body)
          ? (Object.fromEntries(
              Object.entries(body as Record<string, unknown>).map(([k, v]) => [
                k,
                String(v),
              ]),
            ) as Record<string, string>)
          : undefined;
      return tautulliFetch(baseUrl, apiKey, 'GET', path, params);
    },
    async delete(path: string) {
      return tautulliFetch(baseUrl, apiKey, 'GET', path);
    },
  };
}
