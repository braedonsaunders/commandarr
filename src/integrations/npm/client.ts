import type { IntegrationClient } from '../_base';

interface NpmCredentials {
  url: string;
  email: string;
  password: string;
}

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(
  baseUrl: string,
  email: string,
  password: string,
): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(new URL('/api/tokens', baseUrl).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, secret: password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NPM login failed: ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  cachedToken = data.token;
  tokenExpiry = data.expires
    ? new Date(data.expires).getTime() - 60_000
    : Date.now() + 3_600_000;
  return cachedToken!;
}

async function npmFetch(
  baseUrl: string,
  email: string,
  password: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const token = await getToken(baseUrl, email, password);
  const url = new URL(path, baseUrl);

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
      `NPM API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createClient(creds: NpmCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const { email, password } = creds;

  return {
    async get(path: string, params?: Record<string, string>) {
      let fullPath = path;
      if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + searchParams.toString();
      }
      return npmFetch(baseUrl, email, password, 'GET', fullPath);
    },
    async post(path: string, body?: unknown) {
      return npmFetch(baseUrl, email, password, 'POST', path, body);
    },
    async put(path: string, body?: unknown) {
      return npmFetch(baseUrl, email, password, 'PUT', path, body);
    },
    async delete(path: string) {
      return npmFetch(baseUrl, email, password, 'DELETE', path);
    },
  };
}
