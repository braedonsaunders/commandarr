import { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/cn';

interface WidgetFrameProps {
  html: string;
  title?: string;
  className?: string;
  apiBaseUrl?: string;
}

/**
 * Renders widget HTML in a sandboxed iframe and sets up a postMessage bridge
 * so the widget can call `commandarr.fetch(url, options)` to reach the backend API.
 */
export function WidgetFrame({
  html,
  title,
  className,
  apiBaseUrl = '/api',
}: WidgetFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleMessage = useCallback(
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
          {
            type: 'commandarr.fetch.response',
            id,
            ok: response.ok,
            status: response.status,
            body,
          },
          '*',
        );
      } catch (err) {
        iframe.contentWindow?.postMessage(
          {
            type: 'commandarr.fetch.response',
            id,
            ok: false,
            status: 0,
            body: err instanceof Error ? err.message : 'Unknown error',
          },
          '*',
        );
      }
    },
    [apiBaseUrl],
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Inject the bridge helper into the widget HTML so widgets can call commandarr.fetch()
  const bridgeScript = `<script>
(function() {
  var pending = new Map();
  var nextId = 0;
  window.commandarr = {
    fetch: function(url, options) {
      return new Promise(function(resolve, reject) {
        var id = ++nextId;
        pending.set(id, { resolve: resolve, reject: reject });
        window.parent.postMessage(
          { type: 'commandarr.fetch', id: id, url: url, options: options || {} },
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
  };
  window.addEventListener('message', function(e) {
    var d = e.data;
    if (d && d.type === 'commandarr.fetch.response') {
      var p = pending.get(d.id);
      if (p) {
        pending.delete(d.id);
        if (d.ok) p.resolve(d.body);
        else p.reject(new Error(typeof d.body === 'string' ? d.body : 'Request failed'));
      }
    }
  });
})();
<\/script>`;

  const fullHtml = html.includes('<head>')
    ? html.replace('<head>', `<head>${bridgeScript}`)
    : `${bridgeScript}${html}`;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-slate-800 bg-slate-900',
        className,
      )}
    >
      {title && (
        <div className="border-b border-slate-800 px-4 py-2">
          <h3 className="text-sm font-medium text-gray-300">{title}</h3>
        </div>
      )}

      <iframe
        ref={iframeRef}
        srcDoc={fullHtml}
        sandbox="allow-scripts"
        className="h-full w-full border-0"
        style={{ minHeight: 200 }}
        title={title ?? 'Widget'}
      />
    </div>
  );
}
