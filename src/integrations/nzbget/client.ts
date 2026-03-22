import type { IntegrationClient } from '../_base';

interface NzbgetCredentials {
  url: string;
  username: string;
  password: string;
}

async function nzbgetFetch(
  baseUrl: string,
  authHeader: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const url = new URL(path, baseUrl);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: authHeader,
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
      `NZBGet API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createClient(creds: NzbgetCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const authHeader = `Basic ${btoa(`${creds.username}:${creds.password}`)}`;

  return {
    async get(path: string, _params?: Record<string, string>) {
      // For NZBGet, the path is treated as the JSON-RPC method name.
      // GET {baseUrl}/jsonrpc/{methodName} returns JSON-RPC response.
      const rpcPath = `/jsonrpc/${path.replace(/^\/+/, '')}`;
      return nzbgetFetch(baseUrl, authHeader, 'GET', rpcPath);
    },
    async post(path: string, body?: unknown) {
      // POST to {baseUrl}/jsonrpc with JSON-RPC body: { method, params }
      return nzbgetFetch(baseUrl, authHeader, 'POST', '/jsonrpc', body);
    },
    async put(path: string, body?: unknown) {
      return nzbgetFetch(baseUrl, authHeader, 'PUT', path, body);
    },
    async delete(path: string) {
      return nzbgetFetch(baseUrl, authHeader, 'DELETE', path);
    },
  };
}
