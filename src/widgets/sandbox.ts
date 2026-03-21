// Widget sandbox bridge script injected into widget iframes
// This provides the commandarr API object that widgets use to fetch data

export function getWidgetBridgeScript(widgetId: string, refreshInterval = 30000): string {
  return `
<script>
(function() {
  // Commandarr API bridge for widgets
  const pendingRequests = new Map();
  let requestId = 0;

  window.commandarr = {
    fetch: function(path, options) {
      return new Promise(function(resolve, reject) {
        const id = ++requestId;
        pendingRequests.set(id, { resolve: resolve, reject: reject });
        window.parent.postMessage({
          type: 'commandarr-fetch',
          widgetId: '${widgetId}',
          requestId: id,
          path: path,
          options: options || {}
        }, '*');

        // Timeout after 30s
        setTimeout(function() {
          if (pendingRequests.has(id)) {
            pendingRequests.delete(id);
            reject(new Error('Request timed out'));
          }
        }, 30000);
      });
    },
    getStatus: function(integrationId) {
      return commandarr.fetch('/api/integrations/' + integrationId);
    },
    executeCommand: function(prompt) {
      return new Promise(function(resolve, reject) {
        var id = ++requestId;
        pendingRequests.set(id, { resolve: resolve, reject: reject });
        window.parent.postMessage({
          type: 'commandarr-command',
          widgetId: '${widgetId}',
          requestId: id,
          prompt: prompt
        }, '*');
      });
    },
    config: {
      refreshInterval: ${refreshInterval},
      theme: 'dark',
      widgetId: '${widgetId}'
    }
  };

  // Listen for responses from parent
  window.addEventListener('message', function(event) {
    var data = event.data;
    if (data && data.type === 'commandarr-response' && data.widgetId === '${widgetId}') {
      var pending = pendingRequests.get(data.requestId);
      if (pending) {
        pendingRequests.delete(data.requestId);
        if (data.error) {
          pending.reject(new Error(data.error));
        } else {
          pending.resolve(data.data);
        }
      }
    }
  });
})();
</script>`;
}

export function wrapWidgetHtml(html: string, widgetId: string, refreshInterval = 30000): string {
  const bridgeScript = getWidgetBridgeScript(widgetId, refreshInterval);

  // Inject bridge script right after <head> or at the beginning
  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>${bridgeScript}`);
  } else if (html.includes('<html>')) {
    return html.replace('<html>', `<html><head>${bridgeScript}</head>`);
  } else {
    return `${bridgeScript}${html}`;
  }
}
