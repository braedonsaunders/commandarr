import type { IntegrationClient } from '../_base';

interface TailscaleCredentials {
  apiKey: string;
  tailnet: string;
}

async function tailscaleFetch(
  apiKey: string,
  tailnet: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  // Replace {tailnet} placeholder in paths
  const resolvedPath = path.replace(/\{tailnet}/g, encodeURIComponent(tailnet));
  const url = new URL(resolvedPath, 'https://api.tailscale.com');

  const headers: Record<string, string> = {
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
    throw new Error(
      `Tailscale API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createClient(creds: TailscaleCredentials): IntegrationClient {
  const { apiKey, tailnet } = creds;

  return {
    async get(path: string, params?: Record<string, string>) {
      let fullPath = path;
      if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + searchParams.toString();
      }
      return tailscaleFetch(apiKey, tailnet, 'GET', fullPath);
    },
    async post(path: string, body?: unknown) {
      return tailscaleFetch(apiKey, tailnet, 'POST', path, body);
    },
    async put(path: string, body?: unknown) {
      return tailscaleFetch(apiKey, tailnet, 'PUT', path, body);
    },
    async delete(path: string) {
      return tailscaleFetch(apiKey, tailnet, 'DELETE', path);
    },
  };
}
