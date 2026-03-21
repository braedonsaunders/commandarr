export const systemStatusWidget = {
  id: 'prebuilt-system-status',
  name: 'System Status',
  description: 'Health status of all connected integrations',
  html: `<!DOCTYPE html>
<html>
<head>
<style>
  body { margin:0; padding:16px; background:#1a1a2e; color:#e0e0e0; font-family:system-ui,-apple-system,sans-serif; }
  h3 { margin:0 0 12px; font-size:14px; font-weight:600; color:#a0a0b0; text-transform:uppercase; letter-spacing:0.5px; }
  .grid { display:flex; flex-direction:column; gap:8px; }
  .item { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:#16213e; border-radius:8px; }
  .name { font-weight:500; }
  .dot { width:10px; height:10px; border-radius:50%; }
  .dot.healthy { background:#22c55e; box-shadow:0 0 6px #22c55e44; }
  .dot.unhealthy { background:#ef4444; box-shadow:0 0 6px #ef444444; }
  .dot.unknown { background:#6b7280; }
  .loading { color:#6b7280; font-size:13px; }
</style>
</head>
<body>
<h3>System Status</h3>
<div id="widget" class="grid"><div class="loading">Loading...</div></div>
<script>
async function load() {
  try {
    const data = await commandarr.fetch('/api/integrations');
    const el = document.getElementById('widget');
    if (!data || !data.length) { el.innerHTML = '<div class="loading">No integrations configured</div>'; return; }
    el.innerHTML = data.map(function(i) {
      var status = i.configured ? (i.healthy ? 'healthy' : 'unhealthy') : 'unknown';
      return '<div class="item"><span class="name">' + i.name + '</span><span class="dot ' + status + '"></span></div>';
    }).join('');
  } catch(e) { document.getElementById('widget').innerHTML = '<div class="loading">Error loading status</div>'; }
}
load();
setInterval(load, commandarr.config.refreshInterval || 30000);
</script>
</body>
</html>`,
};
