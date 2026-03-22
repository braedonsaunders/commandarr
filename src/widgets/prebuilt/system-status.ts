export const systemStatusWidget = {
  id: 'prebuilt-system-status',
  slug: 'system-status',
  name: 'System Status',
  description: 'Health status of all connected integrations',
  capabilities: ['context', 'state'],
  controls: [
    { id: 'refresh', label: 'Refresh', kind: 'button', parameters: [], execution: { kind: 'state', patch: {} } },
  ],
  html: `<div id="widget-root">
  <div id="header">
    <div class="header-left">
      <div class="header-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      </div>
      <span class="header-title">System Status</span>
    </div>
    <div id="stats-bar"></div>
  </div>
  <div id="grid"></div>
</div>`,
  css: `#widget-root { display:flex; flex-direction:column; gap:12px; }
#header { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.header-left { display:flex; align-items:center; gap:8px; }
.header-icon { width:28px; height:28px; border-radius:8px; background:linear-gradient(135deg, rgba(229,160,13,0.2), rgba(229,160,13,0.05)); display:flex; align-items:center; justify-content:center; color:#E5A00D; }
.header-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:1px; background:linear-gradient(135deg, #E5A00D, #FFC230); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
#stats-bar { display:flex; gap:6px; }
.stat-pill { font-size:10px; font-weight:600; padding:3px 8px; border-radius:6px; letter-spacing:0.3px; }
.stat-pill.healthy { background:rgba(34,197,94,0.12); color:#22c55e; border:1px solid rgba(34,197,94,0.2); }
.stat-pill.unhealthy { background:rgba(239,68,68,0.12); color:#ef4444; border:1px solid rgba(239,68,68,0.2); }
#grid { display:flex; flex-direction:column; gap:6px; }
.int-card { display:flex; align-items:center; gap:12px; padding:10px 14px; background:rgba(28,28,50,0.6); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.04); border-radius:10px; transition:all 0.25s cubic-bezier(0.4,0,0.2,1); }
.int-card:hover { background:rgba(34,34,58,0.8); border-color:rgba(255,255,255,0.08); transform:translateY(-1px); box-shadow:0 4px 16px rgba(0,0,0,0.2); }
.status-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; position:relative; }
.status-dot::after { content:''; position:absolute; inset:-3px; border-radius:50%; opacity:0.3; }
.status-dot.healthy { background:#22c55e; box-shadow:0 0 8px rgba(34,197,94,0.4); }
.status-dot.healthy::after { background:rgba(34,197,94,0.15); }
.status-dot.unhealthy { background:#ef4444; box-shadow:0 0 8px rgba(239,68,68,0.4); animation:pulse-red 2s ease-in-out infinite; }
.status-dot.unhealthy::after { background:rgba(239,68,68,0.15); }
.status-dot.unknown { background:#6b7280; }
@keyframes pulse-red { 0%,100% { box-shadow:0 0 8px rgba(239,68,68,0.4); } 50% { box-shadow:0 0 16px rgba(239,68,68,0.6); } }
.int-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
.int-name { font-size:13px; font-weight:500; color:#f0f0f0; }
.int-status-text { font-size:11px; color:#6a6a8a; }
.int-tools { font-size:10px; color:#4a4a6a; padding:2px 7px; background:rgba(255,255,255,0.03); border-radius:4px; border:1px solid rgba(255,255,255,0.04); white-space:nowrap; }
.empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:32px 16px; color:#6a6a8a; }
.empty-icon { font-size:28px; opacity:0.5; }
.empty-text { font-size:13px; }
.empty-sub { font-size:11px; color:#4a4a6a; }
.loading-state { display:flex; align-items:center; justify-content:center; gap:10px; padding:32px; color:#6a6a8a; font-size:13px; }
.spinner { width:18px; height:18px; border:2px solid rgba(229,160,13,0.15); border-top-color:#E5A00D; border-radius:50%; animation:spin 0.8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }`,
  js: `async function load() {
  try {
    commandarr.setStatus('Refreshing...');
    var data = await commandarr.fetch('/api/integrations');
    var grid = document.getElementById('grid');
    var statsBar = document.getElementById('stats-bar');

    if (!data || !data.length) {
      grid.innerHTML = '<div class="empty-state"><span class="empty-icon">📡</span><span class="empty-text">No integrations configured</span><span class="empty-sub">Add integrations in Settings to get started</span></div>';
      statsBar.innerHTML = '';
      commandarr.setStatus('');
      return;
    }

    var healthyCount = 0;
    var unhealthyCount = 0;
    data.forEach(function(i) {
      if (!i.configured) return;
      if (i.healthy) healthyCount++;
      else unhealthyCount++;
    });

    var statsHtml = '';
    if (healthyCount > 0) statsHtml += '<span class="stat-pill healthy">' + healthyCount + ' healthy</span>';
    if (unhealthyCount > 0) statsHtml += '<span class="stat-pill unhealthy">' + unhealthyCount + ' down</span>';
    statsBar.innerHTML = statsHtml;

    grid.innerHTML = data.map(function(i) {
      var status = i.configured ? (i.healthy ? 'healthy' : 'unhealthy') : 'unknown';
      var statusText = i.configured ? (i.healthy ? 'Connected' : 'Unreachable') : 'Not configured';
      var toolsHtml = i.toolCount ? '<span class="int-tools">' + i.toolCount + ' tools</span>' : '';
      return '<div class="int-card">' +
        '<div class="status-dot ' + status + '"></div>' +
        '<div class="int-info">' +
          '<span class="int-name">' + i.name + '</span>' +
          '<span class="int-status-text">' + statusText + '</span>' +
        '</div>' +
        toolsHtml +
      '</div>';
    }).join('');

    commandarr.setStatus(healthyCount + '/' + data.length + ' healthy');
  } catch(e) {
    document.getElementById('grid').innerHTML = '<div class="empty-state"><span class="empty-icon">⚠️</span><span class="empty-text">Failed to load status</span><span class="empty-sub">' + (e.message || 'Unknown error') + '</span></div>';
    commandarr.setStatus('Error');
  }
}

document.getElementById('grid').innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Loading integrations...</span></div>';
load().then(function() { commandarr.ready(); });
setInterval(load, commandarr.config.refreshInterval || 30000);`,
};
