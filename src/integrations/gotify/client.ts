import type { IntegrationClient } from '../_base';

interface GotifyCredentials {
  url: string;
  clientToken: string;
  appToken: string;
}

async function gotifyFetch(
  baseUrl: string,
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const url = new URL(path, baseUrl);

  const headers: Record<string, string> = {
    'X-Gotify-Key': token,
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
      `Gotify API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createClient(creds: GotifyCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const { clientToken, appToken } = creds;

  function tokenForMethod(method: string): string {
    // GET and DELETE use the client token (reading); POST and PUT use the app token (sending)
    return method === 'GET' || method === 'DELETE' ? clientToken : appToken;
  }

  return {
    async get(path: string, params?: Record<string, string>) {
      let fullPath = path;
      if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + searchParams.toString();
      }
      return gotifyFetch(baseUrl, tokenForMethod('GET'), 'GET', fullPath);
    },
    async post(path: string, body?: unknown) {
      return gotifyFetch(baseUrl, tokenForMethod('POST'), 'POST', path, body);
    },
    async put(path: string, body?: unknown) {
      return gotifyFetch(baseUrl, tokenForMethod('PUT'), 'PUT', path, body);
    },
    async delete(path: string) {
      return gotifyFetch(baseUrl, tokenForMethod('DELETE'), 'DELETE', path);
    },
  };
}
