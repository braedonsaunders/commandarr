import type { IntegrationClient } from '../_base';

interface DockerCredentials {
  socketPath?: string;
  host?: string;
}

async function dockerFetch(
  socketPath: string | undefined,
  host: string | undefined,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const apiPath = path.startsWith('/v') ? path : `/v1.43${path}`;

  let url: string;
  let fetchOptions: RequestInit & { unix?: string } = {
    method,
    headers: {
      Accept: 'application/json',
    } as Record<string, string>,
  };

  if (body) {
    (fetchOptions.headers as Record<string, string>)['Content-Type'] =
      'application/json';
    fetchOptions.body = JSON.stringify(body);
  }

  if (socketPath) {
    // Use unix socket via Bun's native support
    url = `http://localhost${apiPath}`;
    fetchOptions.unix = socketPath;
  } else if (host) {
    const baseUrl = host.replace(/\/+$/, '');
    url = `${baseUrl}${apiPath}`;
  } else {
    // Default to socket
    url = `http://localhost${apiPath}`;
    fetchOptions.unix = '/var/run/docker.sock';
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Docker API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createClient(creds: DockerCredentials): IntegrationClient {
  const socketPath = creds.socketPath || undefined;
  const host = creds.host?.replace(/\/+$/, '') || undefined;

  return {
    async get(path: string, params?: Record<string, string>) {
      let fullPath = path;
      if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + searchParams.toString();
      }
      return dockerFetch(socketPath, host, 'GET', fullPath);
    },
    async post(path: string, body?: unknown) {
      return dockerFetch(socketPath, host, 'POST', path, body);
    },
    async put(path: string, body?: unknown) {
      return dockerFetch(socketPath, host, 'PUT', path, body);
    },
    async delete(path: string) {
      return dockerFetch(socketPath, host, 'DELETE', path);
    },
  };
}
