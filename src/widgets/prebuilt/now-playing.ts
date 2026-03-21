export const nowPlayingWidget = {
  id: 'prebuilt-now-playing',
  name: 'Now Playing',
  description: 'Currently streaming on Plex',
  html: `<!DOCTYPE html>
<html>
<head>
<style>
  body { margin:0; padding:16px; background:#1a1a2e; color:#e0e0e0; font-family:system-ui,-apple-system,sans-serif; }
  h3 { margin:0 0 12px; font-size:14px; font-weight:600; color:#a0a0b0; text-transform:uppercase; letter-spacing:0.5px; }
  .streams { display:flex; flex-direction:column; gap:8px; }
  .stream { padding:10px 12px; background:#16213e; border-radius:8px; }
  .title { font-weight:600; font-size:14px; margin-bottom:4px; }
  .meta { font-size:12px; color:#8b8ba0; display:flex; gap:12px; }
  .progress-bar { height:3px; background:#2a2a4a; border-radius:2px; margin-top:8px; overflow:hidden; }
  .progress-fill { height:100%; background:#E5A00D; border-radius:2px; transition:width 0.3s; }
  .empty { color:#6b7280; font-size:13px; }
</style>
</head>
<body>
<h3>Now Playing</h3>
<div id="widget" class="streams"><div class="empty">Loading...</div></div>
<script>
async function load() {
  try {
    var data = await commandarr.fetch('/api/proxy/plex/status/sessions');
    var el = document.getElementById('widget');
    var sessions = data && data.MediaContainer && data.MediaContainer.Metadata;
    if (!sessions || !sessions.length) { el.innerHTML = '<div class="empty">Nothing playing</div>'; return; }
    el.innerHTML = sessions.map(function(s) {
      var progress = s.viewOffset && s.duration ? Math.round(s.viewOffset / s.duration * 100) : 0;
      var user = s.User ? s.User.title : 'Unknown';
      var player = s.Player ? s.Player.title : '';
      return '<div class="stream"><div class="title">' + (s.grandparentTitle ? s.grandparentTitle + ' - ' : '') + s.title + '</div>' +
        '<div class="meta"><span>' + user + '</span><span>' + player + '</span><span>' + (s.TranscodeSession ? 'Transcoding' : 'Direct') + '</span></div>' +
        '<div class="progress-bar"><div class="progress-fill" style="width:' + progress + '%"></div></div></div>';
    }).join('');
  } catch(e) { document.getElementById('widget').innerHTML = '<div class="empty">Plex not connected</div>'; }
}
load();
setInterval(load, 10000);
</script>
</body>
</html>`,
};
