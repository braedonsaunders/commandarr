import { useEffect, useRef, useCallback, useState } from 'react';
import { cn } from '@/lib/cn';

interface WidgetFrameProps {
  widgetId: string;
  html: string;
  css?: string;
  js?: string;
  title?: string;
  capabilities?: string[];
  controls?: unknown[];
  className?: string;
  apiBaseUrl?: string;
  /** Called when the widget sends a ready() signal */
  onReady?: () => void;
  /** Called when the widget sets a status text */
  onStatus?: (text: string) => void;
  /** Called when the widget requests a layout change */
  onLayoutChange?: (mode: 'scroll' | 'content') => void;
  /** Called when the widget resizes (scroll mode) */
  onResize?: (height: number) => void;
  /** Whether pointer events are disabled (edit mode) */
  pointerEventsDisabled?: boolean;
}

/**
 * Renders widget HTML/CSS/JS in a sandboxed iframe with a full postMessage bridge.
 * Provides commandarr.fetch(), getState(), setState(), invokeControl(), ready(), etc.
 */
export function WidgetFrame({
  widgetId,
  html,
  css = '',
  js = '',
  title,
  capabilities = ['context'],
  controls = [],
  className,
  apiBaseUrl = '/api',
  onReady,
  onStatus,
  onLayoutChange,
  onResize,
  pointerEventsDisabled = false,
}: WidgetFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);

  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe || event.source !== iframe.contentWindow) return;

      const data = event.data ?? {};
      if (data.direction !== 'widget-to-host') return;

      const { id, method, params } = data;

      const respond = (result: unknown, error?: string) => {
        iframe.contentWindow?.postMessage(
          { direction: 'host-to-widget', id, result, error },
          '*',
        );
      };

      try {
        switch (method) {
          case 'fetch': {
            const { url, options } = params;
            const targetUrl = url.startsWith('http') ? url : `${apiBaseUrl}${url}`;
            const response = await fetch(targetUrl, options);
            const contentType = response.headers.get('content-type') ?? '';
            const body = contentType.includes('application/json')
              ? await response.json()
              : await response.text();

            if (response.ok) {
              respond(body);
            } else {
              respond(null, typeof body === 'string' ? body : `Request failed: ${response.status}`);
            }
            break;
          }

          case 'getState': {
            const res = await fetch(`${apiBaseUrl}/widgets/${widgetId}/state`);
            const { state } = await res.json();
            respond(state?.stateJson ?? {});
            break;
          }

          case 'setState': {
            const res = await fetch(`${apiBaseUrl}/widgets/${widgetId}/state`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ state: params.state }),
            });
            const { state } = await res.json();
            respond(state?.stateJson ?? params.state);
            break;
          }

          case 'invokeControl': {
            const res = await fetch(`${apiBaseUrl}/widgets/${widgetId}/controls`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                controlId: params.controlId,
                input: params.input,
              }),
            });
            const result = await res.json();
            if (res.ok) {
              respond(result);
            } else {
              respond(null, result.error || 'Control execution failed');
            }
            break;
          }

          case 'setStatus': {
            onStatus?.(params.text ?? '');
            respond(true);
            break;
          }

          case 'setLayout': {
            onLayoutChange?.(params.mode ?? 'content');
            respond(true);
            break;
          }

          case 'ready': {
            setIsReady(true);
            onReady?.();
            respond(true);
            break;
          }

          case 'resize': {
            onResize?.(params.height ?? 0);
            respond(true);
            break;
          }

          default:
            respond(null, `Unknown method: ${method}`);
        }
      } catch (err) {
        respond(null, err instanceof Error ? err.message : 'Bridge error');
      }
    },
    [apiBaseUrl, widgetId, onReady, onStatus, onLayoutChange, onResize],
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Also handle legacy commandarr.fetch messages for backward compat
  const handleLegacyMessage = useCallback(
    async (event: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe || event.source !== iframe.contentWindow) return;

      const { type, id, url, options } = event.data ?? {};
      if (type !== 'commandarr.fetch') return;

      try {
        const targetUrl = url.startsWith('http') ? url : `${apiBaseUrl}${url}`;
        const response = await fetch(targetUrl, options);
        const contentType = response.headers.get('content-type') ?? '';
        const body = contentType.includes('application/json')
          ? await response.json()
          : await response.text();

        iframe.contentWindow?.postMessage(
          { type: 'commandarr.fetch.response', id, ok: response.ok, status: response.status, body },
          '*',
        );
      } catch (err) {
        iframe.contentWindow?.postMessage(
          { type: 'commandarr.fetch.response', id, ok: false, status: 0, body: err instanceof Error ? err.message : 'Unknown error' },
          '*',
        );
      }
    },
    [apiBaseUrl],
  );

  useEffect(() => {
    window.addEventListener('message', handleLegacyMessage);
    return () => window.removeEventListener('message', handleLegacyMessage);
  }, [handleLegacyMessage]);

  // Ready timeout — auto-mark ready after 10s if widget doesn't call ready()
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isReady) {
        setIsReady(true);
        onReady?.();
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [isReady, onReady]);

  // Build the full HTML document
  const bridgeScript = buildBridgeScript(widgetId, capabilities, controls);
  const fullHtml = buildWidgetDocument(html, css, js, bridgeScript);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900',
        className,
      )}
    >
      {/* Loading overlay */}
      {!isReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-amber-500" />
        </div>
      )}

      <iframe
        ref={iframeRef}
        srcDoc={fullHtml}
        sandbox="allow-scripts"
        className={cn(
          'h-full w-full border-0',
          pointerEventsDisabled && 'pointer-events-none',
        )}
        style={{ minHeight: 200 }}
        title={title ?? 'Widget'}
      />
    </div>
  );
}

function buildBridgeScript(
  widgetId: string,
  capabilities: string[],
  controls: unknown[],
): string {
  const bootstrap = JSON.stringify({
    widgetId,
    capabilities,
    controls,
    refreshInterval: 15000,
    theme: 'dark',
  });

  const CLOSE_SCRIPT = '<' + '/script>';

  return '<script>\n' +
`(function() {
  var pending = new Map();
  var nextId = 0;
  var bootstrap = ${bootstrap};

  function request(method, params) {
    return new Promise(function(resolve, reject) {
      var id = ++nextId;
      pending.set(id, { resolve: resolve, reject: reject });
      window.parent.postMessage(
        { direction: 'widget-to-host', id: id, method: method, params: params || {} },
        '*'
      );
      setTimeout(function() {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error('Request timed out'));
        }
      }, 30000);
    });
  }

  window.commandarr = {
    fetch: function(url, options) {
      return request('fetch', { url: url, options: options || {} });
    },
    getState: function() {
      return request('getState', {});
    },
    setState: function(state) {
      return request('setState', { state: state });
    },
    invokeControl: function(controlId, input) {
      return request('invokeControl', { controlId: controlId, input: input || {} });
    },
    setStatus: function(text) {
      return request('setStatus', { text: text || '' });
    },
    setLayout: function(mode) {
      return request('setLayout', { mode: mode });
    },
    ready: function() {
      return request('ready', {});
    },
    config: {
      refreshInterval: bootstrap.refreshInterval,
      theme: bootstrap.theme,
      widgetId: bootstrap.widgetId,
      capabilities: bootstrap.capabilities
    }
  };

  // Handle responses from host
  window.addEventListener('message', function(e) {
    var d = e.data;
    if (d && d.direction === 'host-to-widget') {
      var p = pending.get(d.id);
      if (p) {
        pending.delete(d.id);
        if (d.error) p.reject(new Error(d.error));
        else p.resolve(d.result);
      }
    }
    // Legacy fetch response support
    if (d && d.type === 'commandarr.fetch.response') {
      var p2 = pending.get(d.id);
      if (p2) {
        pending.delete(d.id);
        if (d.ok) p2.resolve(d.body);
        else p2.reject(new Error(typeof d.body === 'string' ? d.body : 'Request failed'));
      }
    }
  });
})();\n` + CLOSE_SCRIPT;
}

function buildWidgetDocument(
  html: string,
  css: string,
  js: string,
  bridgeScript: string,
): string {
  // If the HTML already looks like a full document (legacy widgets), inject bridge
  if (html.includes('<!DOCTYPE') || html.includes('<html')) {
    if (html.includes('<head>')) {
      return html.replace('<head>', `<head>${bridgeScript}`);
    }
    return `${bridgeScript}${html}`;
  }

  // Build a proper document from separate html/css/js fields
  const baseStyles = `
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; background: transparent; color: #e0e0e0; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.5; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
  `;

  const CLOSE_SCRIPT = '<' + '/script>';

  // Sanitize widget JS — prevent </script> from closing the block prematurely
  const safeJs = js.replace(/<\/script/gi, '<\\/script');

  return '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: https:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\';">\n' +
    bridgeScript + '\n' +
    '<style>' + baseStyles + (css ? '\n' + css : '') + '</style>\n' +
    '</head>\n' +
    '<body>\n' +
    html + '\n' +
    '<script>\n' +
    'document.addEventListener(\'DOMContentLoaded\', function() {\n' +
    safeJs + '\n' +
    '});\n' +
    CLOSE_SCRIPT + '\n' +
    '</body>\n' +
    '</html>';
}
