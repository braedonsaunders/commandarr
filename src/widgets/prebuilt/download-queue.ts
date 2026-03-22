export const downloadQueueWidget = {
  id: 'prebuilt-download-queue',
  slug: 'download-queue',
  name: 'Download Queue',
  description: 'Combined Radarr + Sonarr download queue',
  capabilities: ['context', 'state'],
  controls: [
    { id: 'refresh', label: 'Refresh', kind: 'button', parameters: [], execution: { kind: 'state', patch: {} } },
  ],
  html: `<div id="widget-root">
  <div id="header">
    <div class="header-left">
      <div class="header-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </div>
      <span class="header-title">Download Queue</span>
    </div>
    <div id="speed-badge"></div>
  </div>
  <div id="queue"></div>
</div>`,
  css: `#widget-root { display:flex; flex-direction:column; gap:12px; }
#header { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.header-left { display:flex; align-items:center; gap:8px; }
.header-icon { width:28px; height:28px; border-radius:8px; background:linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05)); display:flex; align-items:center; justify-content:center; color:#22c55e; }
.header-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:1px; background:linear-gradient(135deg, #22c55e, #4ade80); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
#speed-badge { font-size:10px; font-weight:600; padding:3px 8px; border-radius:6px; background:rgba(34,197,94,0.1); color:#22c55e; border:1px solid rgba(34,197,94,0.15); display:none; }
#queue { display:flex; flex-direction:column; gap:6px; }
.dl-card { padding:12px 14px; background:rgba(28,28,50,0.6); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.04); border-radius:10px; transition:all 0.25s cubic-bezier(0.4,0,0.2,1); }
.dl-card:hover { background:rgba(34,34,58,0.8); border-color:rgba(255,255,255,0.08); transform:translateY(-1px); box-shadow:0 4px 16px rgba(0,0,0,0.2); }
.dl-header { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
.dl-title { font-size:13px; font-weight:500; color:#f0f0f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0; }
.dl-source { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; padding:2px 7px; border-radius:4px; flex-shrink:0; }
.dl-source.radarr { background:rgba(255,194,48,0.12); color:#FFC230; border:1px solid rgba(255,194,48,0.15); }
.dl-source.sonarr { background:rgba(53,197,244,0.12); color:#35C5F4; border:1px solid rgba(53,197,244,0.15); }
.dl-meta { display:flex; align-items:center; gap:12px; margin-bottom:8px; font-size:11px; color:#6a6a8a; }
.dl-meta span { display:flex; align-items:center; gap:4px; }
.dl-progress-track { height:4px; background:rgba(255,255,255,0.04); border-radius:3px; overflow:hidden; position:relative; }
.dl-progress-fill { height:100%; border-radius:3px; transition:width 0.6s cubic-bezier(0.4,0,0.2,1); position:relative; }
.dl-progress-fill.active { background:linear-gradient(90deg, #22c55e, #4ade80); box-shadow:0 0 8px rgba(34,197,94,0.3); }
.dl-progress-fill.stalled { background:linear-gradient(90deg, #f59e0b, #fbbf24); }
.dl-progress-fill.warning { background:linear-gradient(90deg, #ef4444, #f87171); }
.dl-percent { font-size:11px; font-weight:600; color:#a0a0c0; margin-left:auto; }
.empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:32px 16px; color:#6a6a8a; }
.empty-icon { font-size:28px; opacity:0.5; }
.empty-text { font-size:13px; }
.empty-sub { font-size:11px; color:#4a4a6a; }
.loading-state { display:flex; align-items:center; justify-content:center; gap:10px; padding:32px; color:#6a6a8a; font-size:13px; }
.spinner { width:18px; height:18px; border:2px solid rgba(34,197,94,0.15); border-top-color:#22c55e; border-radius:50%; animation:spin 0.8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }`,
  js: `function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  var units = ['B','KB','MB','GB','TB'];
  var i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function formatEta(eta) {
  if (!eta || eta === '00:00:00') return '';
  var parts = eta.split(':');
  if (parts.length === 3) {
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm';
    return parts[2] + 's';
  }
  return eta;
}

async function load() {
  var items = [];
  try {
    var radarr = await commandarr.fetch('/api/proxy/radarr/api/v3/queue');
    if (radarr && radarr.records) {
      radarr.records.forEach(function(r) {
        var progress = r.sizeleft && r.size ? Math.round((1 - r.sizeleft / r.size) * 100) : 0;
        items.push({
          title: r.title || (r.movie && r.movie.title) || 'Unknown',
          source: 'radarr',
          status: r.status || '',
          progress: progress,
          eta: r.timeleft || '',
          size: r.size || 0,
          sizeLeft: r.sizeleft || 0
        });
      });
    }
  } catch(e) {}
  try {
    var sonarr = await commandarr.fetch('/api/proxy/sonarr/api/v3/queue');
    if (sonarr && sonarr.records) {
      sonarr.records.forEach(function(r) {
        var title = r.title || (r.series ? r.series.title + ' S' + (r.episode ? String(r.episode.seasonNumber).padStart(2,'0') + 'E' + String(r.episode.episodeNumber).padStart(2,'0') : '') : 'Unknown');
        var progress = r.sizeleft && r.size ? Math.round((1 - r.sizeleft / r.size) * 100) : 0;
        items.push({
          title: title,
          source: 'sonarr',
          status: r.status || '',
          progress: progress,
          eta: r.timeleft || '',
          size: r.size || 0,
          sizeLeft: r.sizeleft || 0
        });
      });
    }
  } catch(e) {}

  var queue = document.getElementById('queue');
  var speedBadge = document.getElementById('speed-badge');

  if (!items.length) {
    queue.innerHTML = '<div class="empty-state"><span class="empty-icon">✅</span><span class="empty-text">Queue is empty</span><span class="empty-sub">Nothing downloading right now</span></div>';
    speedBadge.style.display = 'none';
    commandarr.setStatus('Empty');
    return;
  }

  var activeCount = items.filter(function(i) { return i.progress > 0 && i.progress < 100; }).length;
  speedBadge.style.display = activeCount > 0 ? 'block' : 'none';
  speedBadge.textContent = activeCount + ' active';

  queue.innerHTML = items.map(function(i) {
    var progressClass = 'active';
    if (i.status === 'warning' || i.status === 'delay') progressClass = 'stalled';
    if (i.status === 'failed') progressClass = 'warning';

    var eta = formatEta(i.eta);
    var sizeText = formatSize(i.size - i.sizeLeft) + ' / ' + formatSize(i.size);

    return '<div class="dl-card">' +
      '<div class="dl-header">' +
        '<span class="dl-title">' + i.title + '</span>' +
        '<span class="dl-source ' + i.source + '">' + i.source + '</span>' +
      '</div>' +
      '<div class="dl-meta">' +
        '<span>' + sizeText + '</span>' +
        (eta ? '<span>⏱ ' + eta + '</span>' : '') +
        '<span class="dl-percent">' + i.progress + '%</span>' +
      '</div>' +
      '<div class="dl-progress-track">' +
        '<div class="dl-progress-fill ' + progressClass + '" style="width:' + i.progress + '%"></div>' +
      '</div>' +
    '</div>';
  }).join('');

  commandarr.setStatus(items.length + ' item' + (items.length !== 1 ? 's' : ''));
}

document.getElementById('queue').innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Loading queue...</span></div>';
load().then(function() { commandarr.ready(); });
setInterval(load, commandarr.config.refreshInterval || 15000);`,
};
