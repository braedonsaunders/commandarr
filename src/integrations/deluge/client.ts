import type { IntegrationClient } from '../_base';

interface DelugeCredentials {
  url: string;
  password: string;
}

let requestId = 0;

function nextId(): number {
  return requestId++;
}

async function rpcCall(
  baseUrl: string,
  method: string,
  params: unknown[],
  cookie?: string,
): Promise<{ result: any; cookie?: string }> {
  const url = `${baseUrl}/json`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: nextId(), method, params }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Deluge API error ${response.status}: ${text.slice(0, 300)}`);
  }

  // Extract session cookie from Set-Cookie header
  let newCookie: string | undefined;
  const setCookie = response.headers.get('set-cookie') ?? '';
  const cookieMatch = setCookie.match(/(_session_id=[^;]+)/);
  if (cookieMatch) {
    newCookie = cookieMatch[1];
  }

  const json = await response.json();

  if (json.error) {
    throw new Error(`Deluge RPC error: ${json.error.message ?? JSON.stringify(json.error)}`);
  }

  return { result: json.result, cookie: newCookie };
}

async function authenticate(baseUrl: string, password: string): Promise<string> {
  const { result, cookie } = await rpcCall(baseUrl, 'auth.login', [password]);

  if (!result) {
    throw new Error('Deluge authentication failed: invalid password');
  }

  if (!cookie) {
    throw new Error('Deluge authentication failed: no session cookie returned');
  }

  return cookie;
}

export function createClient(creds: DelugeCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const { password } = creds;

  let sessionCookie: string | null = null;

  async function ensureAuth(): Promise<string> {
    if (!sessionCookie) {
      sessionCookie = await authenticate(baseUrl, password);
    }
    return sessionCookie;
  }

  async function call(method: string, params: unknown[]): Promise<any> {
    let cookie = await ensureAuth();

    try {
      const { result, cookie: newCookie } = await rpcCall(baseUrl, method, params, cookie);
      // Update cookie if a new one was returned
      if (newCookie) {
        sessionCookie = newCookie;
      }
      return result;
    } catch (error: any) {
      // Re-authenticate on auth errors
      if (
        error.message?.includes('403') ||
        error.message?.includes('Not authenticated') ||
        error.message?.includes('auth')
      ) {
        sessionCookie = null;
        cookie = await ensureAuth();
        const { result, cookie: newCookie } = await rpcCall(baseUrl, method, params, cookie);
        if (newCookie) {
          sessionCookie = newCookie;
        }
        return result;
      }
      throw error;
    }
  }

  return {
    async get(path: string, params?: Record<string, string>) {
      // For Deluge, path is the RPC method name
      // params is treated as an object; the caller should pass arguments via params
      const args = params ? Object.values(params) : [];
      return call(path, args);
    },
    async post(path: string, body?: unknown) {
      // For Deluge, path is the RPC method name, body is the params array
      const params = Array.isArray(body) ? body : body ? [body] : [];
      return call(path, params);
    },
    async put(path: string, body?: unknown) {
      const params = Array.isArray(body) ? body : body ? [body] : [];
      return call(path, params);
    },
    async delete(path: string) {
      return call(path, []);
    },
  };
}
