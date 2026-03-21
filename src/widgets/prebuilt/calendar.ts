export const calendarWidget = {
  id: 'prebuilt-calendar',
  name: 'Upcoming Releases',
  description: 'Upcoming movies and shows from Radarr + Sonarr',
  html: `<!DOCTYPE html>
<html>
<head>
<style>
  body { margin:0; padding:16px; background:#1a1a2e; color:#e0e0e0; font-family:system-ui,-apple-system,sans-serif; }
  h3 { margin:0 0 12px; font-size:14px; font-weight:600; color:#a0a0b0; text-transform:uppercase; letter-spacing:0.5px; }
  .list { display:flex; flex-direction:column; gap:6px; }
  .item { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#16213e; border-radius:8px; }
  .item-left { display:flex; flex-direction:column; gap:2px; max-width:70%; }
  .title { font-size:13px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .date { font-size:11px; color:#8b8ba0; }
  .tag { font-size:10px; padding:2px 6px; border-radius:4px; font-weight:600; }
  .movie { background:#FFC23022; color:#FFC230; }
  .show { background:#35C5F422; color:#35C5F4; }
  .empty { color:#6b7280; font-size:13px; }
</style>
</head>
<body>
<h3>Upcoming Releases</h3>
<div id="widget" class="list"><div class="empty">Loading...</div></div>
<script>
async function load() {
  var items = [];
  var now = new Date(); var end = new Date(); end.setDate(end.getDate()+14);
  var start = now.toISOString().split('T')[0]; var endStr = end.toISOString().split('T')[0];
  try {
    var r = await commandarr.fetch('/api/proxy/radarr/api/v3/calendar?start='+start+'&end='+endStr);
    if (r && r.length) r.forEach(function(m) { items.push({ title:m.title, date:m.inCinemas||m.physicalRelease||m.digitalRelease||'', type:'movie' }); });
  } catch(e){}
  try {
    var s = await commandarr.fetch('/api/proxy/sonarr/api/v3/calendar?start='+start+'&end='+endStr);
    if (s && s.length) s.forEach(function(ep) { items.push({ title:(ep.series?ep.series.title+' ':'')+'S'+(ep.seasonNumber||0)+'E'+(ep.episodeNumber||0), date:ep.airDateUtc||'', type:'show' }); });
  } catch(e){}
  items.sort(function(a,b){ return new Date(a.date).getTime()-new Date(b.date).getTime(); });
  var el = document.getElementById('widget');
  if (!items.length) { el.innerHTML='<div class="empty">No upcoming releases</div>'; return; }
  el.innerHTML = items.slice(0,10).map(function(i) {
    var d = i.date ? new Date(i.date).toLocaleDateString() : '';
    return '<div class="item"><div class="item-left"><span class="title">'+i.title+'</span><span class="date">'+d+'</span></div><span class="tag '+i.type+'">'+(i.type==='movie'?'MOVIE':'SHOW')+'</span></div>';
  }).join('');
}
load(); setInterval(load, 60000);
</script>
</body>
</html>`,
};
