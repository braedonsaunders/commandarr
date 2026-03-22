import type { IntegrationClient } from '../_base';

interface QBittorrentCredentials {
  url: string;
  username: string;
  password: string;
}

async function authenticate(baseUrl: string, username: string, password: string): Promise<string> {
  const loginUrl = `${baseUrl}/api/v2/auth/login`;
  const body = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`qBittorrent auth failed with status ${response.status}`);
  }

  const text = await response.text();
  if (text.trim() === 'Fails.') {
    throw new Error('qBittorrent authentication failed: invalid credentials');
  }

  // Extract SID cookie from Set-Cookie header
  const setCookie = response.headers.get('set-cookie') ?? '';
  const sidMatch = setCookie.match(/SID=([^;]+)/);
  if (!sidMatch) {
    throw new Error('qBittorrent authentication failed: no SID cookie returned');
  }

  return sidMatch[1];
}

async function qbFetch(
  baseUrl: string,
  sid: string,
  method: string,
  path: string,
  body?: string,
  contentType?: string,
): Promise<any> {
  const url = new URL(path, baseUrl);

  const headers: Record<string, string> = {
    Cookie: `SID=${sid}`,
  };

  if (body && contentType) {
    headers['Content-Type'] = contentType;
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ?? undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`qBittorrent API error ${response.status}: ${text.slice(0, 300)}`);
  }

  const responseContentType = response.headers.get('content-type') ?? '';
  if (responseContentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createClient(creds: QBittorrentCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const { username, password } = creds;

  let sid: string | null = null;

  async function ensureAuth(): Promise<string> {
    if (!sid) {
      sid = await authenticate(baseUrl, username, password);
    }
    return sid;
  }

  async function request(
    method: string,
    path: string,
    body?: string,
    contentType?: string,
  ): Promise<any> {
    let currentSid = await ensureAuth();

    try {
      return await qbFetch(baseUrl, currentSid, method, path, body, contentType);
    } catch (error: any) {
      // Re-authenticate on 403
      if (error.message?.includes('403')) {
        sid = null;
        currentSid = await ensureAuth();
        return qbFetch(baseUrl, currentSid, method, path, body, contentType);
      }
      throw error;
    }
  }

  return {
    async get(path: string, params?: Record<string, string>) {
      let fullPath = path;
      if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + searchParams.toString();
      }
      return request('GET', fullPath);
    },
    async post(path: string, body?: unknown) {
      if (typeof body === 'string') {
        return request('POST', path, body, 'application/x-www-form-urlencoded');
      }
      if (body) {
        return request('POST', path, JSON.stringify(body), 'application/json');
      }
      return request('POST', path);
    },
    async put(path: string, body?: unknown) {
      if (typeof body === 'string') {
        return request('PUT', path, body, 'application/x-www-form-urlencoded');
      }
      if (body) {
        return request('PUT', path, JSON.stringify(body), 'application/json');
      }
      return request('PUT', path);
    },
    async delete(path: string) {
      return request('DELETE', path);
    },
  };
}
