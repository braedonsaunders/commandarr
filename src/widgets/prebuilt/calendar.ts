export const calendarWidget = {
  id: 'prebuilt-calendar',
  slug: 'upcoming-releases',
  name: 'Upcoming Releases',
  description: 'Upcoming movies and shows from Radarr + Sonarr',
  capabilities: ['context', 'state'],
  controls: [
    { id: 'refresh', label: 'Refresh', kind: 'button', parameters: [], execution: { kind: 'state', patch: {} } },
  ],
  html: `<div id="widget-root">
  <div id="header">
    <div class="header-left">
      <div class="header-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <span class="header-title">Upcoming Releases</span>
    </div>
    <div id="filter-bar">
      <button class="filter-btn active" data-filter="all">All</button>
      <button class="filter-btn" data-filter="movie">Movies</button>
      <button class="filter-btn" data-filter="show">Shows</button>
    </div>
  </div>
  <div id="list"></div>
</div>`,
  css: `#widget-root { display:flex; flex-direction:column; gap:12px; }
#header { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.header-left { display:flex; align-items:center; gap:8px; }
.header-icon { width:28px; height:28px; border-radius:8px; background:linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05)); display:flex; align-items:center; justify-content:center; color:#8b5cf6; }
.header-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:1px; background:linear-gradient(135deg, #8b5cf6, #a78bfa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
#filter-bar { display:flex; gap:4px; }
.filter-btn { font-size:10px; font-weight:600; padding:3px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.03); color:#6a6a8a; cursor:pointer; transition:all 0.2s ease; }
.filter-btn:hover { background:rgba(255,255,255,0.06); color:#a0a0c0; }
.filter-btn.active { background:rgba(139,92,246,0.15); color:#a78bfa; border-color:rgba(139,92,246,0.2); }
#list { display:flex; flex-direction:column; gap:4px; }
.date-group { margin-top:4px; }
.date-group:first-child { margin-top:0; }
.date-header { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#4a4a6a; padding:4px 2px 6px; display:flex; align-items:center; gap:8px; }
.date-header::after { content:''; flex:1; height:1px; background:linear-gradient(90deg, rgba(139,92,246,0.2), transparent); }
.rel-card { display:flex; align-items:center; gap:12px; padding:10px 14px; background:rgba(28,28,50,0.6); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.04); border-radius:10px; transition:all 0.25s cubic-bezier(0.4,0,0.2,1); }
.rel-card:hover { background:rgba(34,34,58,0.8); border-color:rgba(255,255,255,0.08); transform:translateY(-1px); box-shadow:0 4px 16px rgba(0,0,0,0.2); }
.rel-poster { width:36px; height:54px; border-radius:6px; overflow:hidden; background:rgba(255,255,255,0.03); flex-shrink:0; }
.rel-poster img { width:100%; height:100%; object-fit:cover; display:block; }
.rel-poster-placeholder { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:16px; background:linear-gradient(135deg, rgba(28,28,50,0.8), rgba(42,42,74,0.8)); }
.rel-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.rel-title { font-size:13px; font-weight:500; color:#f0f0f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rel-sub { font-size:11px; color:#6a6a8a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rel-badge { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; padding:3px 8px; border-radius:5px; flex-shrink:0; }
.rel-badge.movie { background:rgba(255,194,48,0.12); color:#FFC230; border:1px solid rgba(255,194,48,0.15); }
.rel-badge.show { background:rgba(53,197,244,0.12); color:#35C5F4; border:1px solid rgba(53,197,244,0.15); }
.rel-badge.today { background:rgba(34,197,94,0.12); color:#22c55e; border:1px solid rgba(34,197,94,0.15); }
.empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:32px 16px; color:#6a6a8a; }
.empty-icon { font-size:28px; opacity:0.5; }
.empty-text { font-size:13px; }
.empty-sub { font-size:11px; color:#4a4a6a; }
.loading-state { display:flex; align-items:center; justify-content:center; gap:10px; padding:32px; color:#6a6a8a; font-size:13px; }
.spinner { width:18px; height:18px; border:2px solid rgba(139,92,246,0.15); border-top-color:#8b5cf6; border-radius:50%; animation:spin 0.8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }`,
  js: `var allItems = [];
var activeFilter = 'all';

function formatDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate();
}

function getDateKey(dateStr) {
  if (!dateStr) return 'unknown';
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'unknown';
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function getRelativeLabel(dateStr) {
  if (!dateStr) return 'Unknown';
  var d = new Date(dateStr);
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var diff = Math.round((target - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff <= 7) return formatDate(dateStr);
  return formatDate(dateStr);
}

function isToday(dateStr) {
  if (!dateStr) return false;
  var d = new Date(dateStr);
  var now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function renderItems() {
  var filtered = activeFilter === 'all' ? allItems : allItems.filter(function(i) { return i.type === activeFilter; });
  var list = document.getElementById('list');

  if (!filtered.length) {
    var msg = activeFilter === 'all' ? 'No upcoming releases' : 'No upcoming ' + (activeFilter === 'movie' ? 'movies' : 'shows');
    list.innerHTML = '<div class="empty-state"><span class="empty-icon">📅</span><span class="empty-text">' + msg + '</span><span class="empty-sub">Check back later for new releases</span></div>';
    return;
  }

  var groups = {};
  var groupOrder = [];
  filtered.forEach(function(item) {
    var key = getDateKey(item.date);
    if (!groups[key]) {
      groups[key] = [];
      groupOrder.push(key);
    }
    groups[key].push(item);
  });

  var html = '';
  groupOrder.forEach(function(key) {
    var items = groups[key];
    var label = getRelativeLabel(items[0].date);
    var todayClass = isToday(items[0].date) ? ' today' : '';

    html += '<div class="date-group">';
    html += '<div class="date-header">' + label + '</div>';

    items.forEach(function(i) {
      var posterHtml = i.poster
        ? '<img src="' + i.poster + '" alt="" loading="lazy" onerror="this.parentElement.innerHTML=\\'<div class=rel-poster-placeholder>' + (i.type === 'movie' ? '🎬' : '📺') + '</div>\\'" />'
        : '<div class="rel-poster-placeholder">' + (i.type === 'movie' ? '🎬' : '📺') + '</div>';

      var badgeClass = isToday(i.date) ? 'today' : i.type;
      var badgeText = isToday(i.date) ? 'Today' : (i.type === 'movie' ? 'Movie' : 'Show');

      html += '<div class="rel-card">' +
        '<div class="rel-poster">' + posterHtml + '</div>' +
        '<div class="rel-info">' +
          '<span class="rel-title">' + i.title + '</span>' +
          '<span class="rel-sub">' + (i.subtitle || '') + '</span>' +
        '</div>' +
        '<span class="rel-badge ' + badgeClass + '">' + badgeText + '</span>' +
      '</div>';
    });

    html += '</div>';
  });

  list.innerHTML = html;
}

function setupFilters() {
  var buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      buttons.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter');
      renderItems();
    });
  });
}

async function load() {
  allItems = [];
  var now = new Date();
  var end = new Date();
  end.setDate(end.getDate() + 30);
  var start = now.toISOString().split('T')[0];
  var endStr = end.toISOString().split('T')[0];

  try {
    var r = await commandarr.fetch('/api/proxy/radarr/api/v3/calendar?start=' + start + '&end=' + endStr);
    if (r && r.length) {
      r.forEach(function(m) {
        var poster = '';
        if (m.images && m.images.length) {
          for (var pi = 0; pi < m.images.length; pi++) {
            if (m.images[pi].coverType === 'poster') {
              poster = m.images[pi].remoteUrl || m.images[pi].url || '';
              break;
            }
          }
          if (!poster) poster = m.images[0].remoteUrl || m.images[0].url || '';
        }
        allItems.push({
          title: m.title || 'Unknown',
          subtitle: m.year ? String(m.year) : '',
          date: m.inCinemas || m.digitalRelease || m.physicalRelease || '',
          type: 'movie',
          poster: poster
        });
      });
    }
  } catch(e) {}

  try {
    var s = await commandarr.fetch('/api/proxy/sonarr/api/v3/calendar?start=' + start + '&end=' + endStr);
    if (s && s.length) {
      s.forEach(function(ep) {
        var seriesTitle = ep.series ? ep.series.title : '';
        var epNum = 'S' + String(ep.seasonNumber || 0).padStart(2, '0') + 'E' + String(ep.episodeNumber || 0).padStart(2, '0');
        var poster = '';
        if (ep.series && ep.series.images && ep.series.images.length) {
          for (var si = 0; si < ep.series.images.length; si++) {
            if (ep.series.images[si].coverType === 'poster') {
              poster = ep.series.images[si].remoteUrl || ep.series.images[si].url || '';
              break;
            }
          }
          if (!poster) poster = ep.series.images[0].remoteUrl || ep.series.images[0].url || '';
        }
        allItems.push({
          title: seriesTitle,
          subtitle: epNum + (ep.title ? ' - ' + ep.title : ''),
          date: ep.airDateUtc || '',
          type: 'show',
          poster: poster
        });
      });
    }
  } catch(e) {}

  allItems.sort(function(a, b) { return new Date(a.date).getTime() - new Date(b.date).getTime(); });
  renderItems();
  commandarr.setStatus(allItems.length + ' upcoming');
}

setupFilters();
document.getElementById('list').innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Loading calendar...</span></div>';
load().then(function() { commandarr.ready(); });
setInterval(load, 60000);`,
};
