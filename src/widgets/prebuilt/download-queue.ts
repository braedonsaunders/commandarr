export const downloadQueueWidget = {
  id: 'prebuilt-download-queue',
  slug: 'download-queue',
  name: 'Download Queue',
  description: 'Combined Radarr + Sonarr download queue',
  capabilities: ['context', 'state'],
  controls: [
    { id: 'refresh', label: 'Refresh', kind: 'button', parameters: [], execution: { kind: 'state', patch: {} } },
  ],
  html: `<h3>Download Queue</h3>
<div id="widget" class="queue"><div class="empty">Loading...</div></div>`,
  css: `h3 { margin:0 0 12px; font-size:14px; font-weight:600; color:#a0a0b0; text-transform:uppercase; letter-spacing:0.5px; }
.queue { display:flex; flex-direction:column; gap:8px; }
.item { padding:10px 12px; background:#16213e; border-radius:8px; }
.item-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
.item-title { font-weight:500; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:70%; }
.item-source { font-size:11px; padding:2px 6px; border-radius:4px; font-weight:600; }
.radarr { background:#FFC23022; color:#FFC230; }
.sonarr { background:#35C5F422; color:#35C5F4; }
.item-meta { font-size:12px; color:#8b8ba0; display:flex; gap:12px; }
.progress-bar { height:3px; background:#2a2a4a; border-radius:2px; margin-top:6px; overflow:hidden; }
.progress-fill { height:100%; background:#22c55e; border-radius:2px; }
.empty { color:#6b7280; font-size:13px; }`,
  js: `async function load() {
  var items = [];
  try {
    var radarr = await commandarr.fetch('/api/proxy/radarr/api/v3/queue');
    if (radarr && radarr.records) {
      radarr.records.forEach(function(r) {
        items.push({ title: r.title || (r.movie && r.movie.title) || 'Unknown', source: 'radarr', status: r.status, progress: r.sizeleft && r.size ? Math.round((1 - r.sizeleft/r.size)*100) : 0, eta: r.timeleft || '' });
      });
    }
  } catch(e) {}
  try {
    var sonarr = await commandarr.fetch('/api/proxy/sonarr/api/v3/queue');
    if (sonarr && sonarr.records) {
      sonarr.records.forEach(function(r) {
        var title = r.title || (r.series ? r.series.title + ' S' + (r.episode ? r.episode.seasonNumber + 'E' + r.episode.episodeNumber : '') : 'Unknown');
        items.push({ title: title, source: 'sonarr', status: r.status, progress: r.sizeleft && r.size ? Math.round((1 - r.sizeleft/r.size)*100) : 0, eta: r.timeleft || '' });
      });
    }
  } catch(e) {}
  var el = document.getElementById('widget');
  if (!items.length) { el.innerHTML = '<div class="empty">Queue empty</div>'; commandarr.setStatus(''); return; }
  el.innerHTML = items.map(function(i) {
    return '<div class="item"><div class="item-header"><span class="item-title">' + i.title + '</span><span class="item-source ' + i.source + '">' + i.source.toUpperCase() + '</span></div>' +
      '<div class="item-meta"><span>' + i.progress + '%</span>' + (i.eta ? '<span>ETA: ' + i.eta + '</span>' : '') + '</div>' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + i.progress + '%"></div></div></div>';
  }).join('');
  commandarr.setStatus(items.length + ' item' + (items.length !== 1 ? 's' : ''));
}
load().then(function() { commandarr.ready(); });
setInterval(load, commandarr.config.refreshInterval || 15000);`,
};
