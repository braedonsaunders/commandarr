import type { IntegrationClient } from '../_base';

interface PlexCredentials {
  url: string;
  token: string;
}

function parseXmlText(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match?.[1] ?? null;
}

function parseXmlAttribute(
  xml: string,
  tag: string,
  attr: string,
): string | null {
  const tagRegex = new RegExp(`<${tag}\\s[^>]*${attr}="([^"]*)"`, 'gi');
  const match = tagRegex.exec(xml);
  return match?.[1] ?? null;
}

function parseXmlElements(
  xml: string,
  tag: string,
): Record<string, string>[] {
  const results: Record<string, string>[] = [];
  const regex = new RegExp(`<${tag}\\s([^>]*)/?\\s*>`, 'gi');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)="([^"]*)"/g;
    let attrMatch: RegExpExecArray | null;

    while ((attrMatch = attrRegex.exec(match[1]!)) !== null) {
      attrs[attrMatch[1]!] = attrMatch[2]!;
    }

    results.push(attrs);
  }

  return results;
}

async function plexFetch(
  baseUrl: string,
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const url = new URL(path, baseUrl);
  url.searchParams.set('X-Plex-Token', token);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Plex-Token': token,
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
      `Plex API error ${response.status}: ${text.slice(0, 200)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  // Plex often returns XML even when JSON is requested
  const text = await response.text();

  if (contentType.includes('xml') || text.trimStart().startsWith('<?xml') || text.trimStart().startsWith('<')) {
    return { _xml: text, _parsed: parseXmlElements(text, '\\w+') };
  }

  return { _text: text };
}

export function createClient(creds: PlexCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\/+$/, '');
  const { token } = creds;

  return {
    async get(path: string, params?: Record<string, string>) {
      let fullPath = path;
      if (params) {
        const searchParams = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + searchParams.toString();
      }
      return plexFetch(baseUrl, token, 'GET', fullPath);
    },
    async post(path: string, body?: unknown) {
      return plexFetch(baseUrl, token, 'POST', path, body);
    },
    async put(path: string, body?: unknown) {
      return plexFetch(baseUrl, token, 'PUT', path, body);
    },
    async delete(path: string) {
      return plexFetch(baseUrl, token, 'DELETE', path);
    },
  };
}

export { parseXmlElements, parseXmlAttribute, parseXmlText };
