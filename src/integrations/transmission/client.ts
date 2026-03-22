import type { IntegrationClient } from '../_base';

interface TransmissionCredentials {
  url: string;
  username?: string;
  password?: string;
}

export function createClient(creds: TransmissionCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const rpcUrl = `${baseUrl}/transmission/rpc`;

  let sessionId: string | null = null;

  function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (creds.username) {
      const encoded = btoa(`${creds.username}:${creds.password ?? ''}`);
      headers['Authorization'] = `Basic ${encoded}`;
    }

    if (sessionId) {
      headers['X-Transmission-Session-Id'] = sessionId;
    }

    return headers;
  }

  async function rpcCall(method: string, args?: Record<string, unknown>): Promise<any> {
    const body = JSON.stringify({
      method,
      arguments: args ?? {},
    });

    let response = await fetch(rpcUrl, {
      method: 'POST',
      headers: buildHeaders(),
      body,
    });

    // Handle CSRF 409: extract session ID and retry
    if (response.status === 409) {
      const newSessionId = response.headers.get('X-Transmission-Session-Id');
      if (newSessionId) {
        sessionId = newSessionId;
      }

      response = await fetch(rpcUrl, {
        method: 'POST',
        headers: buildHeaders(),
        body,
      });
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Transmission API error ${response.status}: ${text.slice(0, 300)}`);
    }

    const data = await response.json();

    if (data.result && data.result !== 'success') {
      throw new Error(`Transmission RPC error: ${data.result}`);
    }

    return data.arguments ?? data;
  }

  return {
    async get(path: string, params?: Record<string, string>) {
      // For Transmission, `path` is the RPC method name
      // and `params` are the RPC arguments
      const args: Record<string, unknown> = {};
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          // Try to parse JSON values (arrays, numbers, booleans)
          try {
            args[key] = JSON.parse(value);
          } catch {
            args[key] = value;
          }
        }
      }
      return rpcCall(path, Object.keys(args).length > 0 ? args : undefined);
    },
    async post(path: string, body?: unknown) {
      // For Transmission, `path` is the RPC method name
      // and `body` is the RPC arguments object
      return rpcCall(path, (body as Record<string, unknown>) ?? undefined);
    },
    async put(path: string, body?: unknown) {
      return rpcCall(path, (body as Record<string, unknown>) ?? undefined);
    },
    async delete(path: string) {
      return rpcCall(path);
    },
  };
}
