/**
 * The web interface: one self-contained page (no external request), served by `server.ts`.
 * Written with String.raw so that the script keeps its backslashes; it must not contain
 * backticks or dollar-brace sequences.
 */
export const PAGE_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Skills Atlas</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='none' stroke='%2306b6d4' stroke-width='3'/%3E%3Cpath d='M16 5v22M5 16h22' stroke='%2306b6d4' stroke-width='2'/%3E%3C/svg%3E">
<style>
:root {
  --bg: #f6f7f9; --surface: #ffffff; --surface-2: #f0f2f5; --border: #e2e5ea;
  --text: #1a1d23; --muted: #626a78; --accent: #0891b2; --accent-soft: #e0f5fa;
  --green: #15803d; --green-soft: #e3f6ea; --red: #b91c1c; --red-soft: #fdecec;
  --blue: #2563eb; --shadow: 0 1px 2px rgba(16,24,40,.06), 0 4px 12px rgba(16,24,40,.06);
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1115; --surface: #171a21; --surface-2: #1e222b; --border: #2a2f3a;
    --text: #e6e8ec; --muted: #9aa3b2; --accent: #22d3ee; --accent-soft: #0e3440;
    --green: #4ade80; --green-soft: #12301f; --red: #f87171; --red-soft: #3a1717;
    --blue: #60a5fa; --shadow: 0 1px 2px rgba(0,0,0,.4), 0 4px 16px rgba(0,0,0,.3);
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  background: var(--bg); color: var(--text);
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  display: flex; flex-direction: column;
}
button, input, select { font: inherit; color: inherit; }
button { cursor: pointer; }
a { color: inherit; }
.muted { color: var(--muted); }

header {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  padding: 12px 20px; background: var(--surface); border-bottom: 1px solid var(--border);
}
.brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.brand svg { flex: none; }
.brand b { font-size: 16px; letter-spacing: .04em; }
.brand span { font-size: 12px; }
.search { flex: 1 1 320px; position: relative; }
.search input {
  width: 100%; padding: 9px 12px 9px 34px; border: 1px solid var(--border);
  border-radius: 8px; background: var(--surface-2); outline: none;
}
.search input:focus { border-color: var(--accent); background: var(--surface); }
.search svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--muted); }
.controls { display: flex; align-items: center; gap: 10px; }
select, .chip-toggle {
  border: 1px solid var(--border); background: var(--surface); border-radius: 8px; padding: 7px 10px;
}
.chip-toggle[aria-pressed="true"] { border-color: var(--blue); color: var(--blue); background: color-mix(in srgb, var(--blue) 10%, transparent); }

main { flex: 1; display: grid; grid-template-columns: 230px minmax(0, 1fr) 360px; min-height: 0; }
nav, .list, aside { overflow: auto; min-height: 0; }
nav { border-right: 1px solid var(--border); padding: 12px 8px; }
nav button {
  display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%;
  border: 0; background: none; padding: 7px 10px; border-radius: 6px; text-align: left;
}
nav button:hover { background: var(--surface-2); }
nav button[aria-current="true"] { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
nav button .n { color: var(--muted); font-variant-numeric: tabular-nums; font-size: 12px; }
nav hr { border: 0; border-top: 1px solid var(--border); margin: 8px 4px; }

.list { padding: 12px 20px 40px; }
.list-head { display: flex; justify-content: space-between; align-items: baseline; margin: 4px 2px 10px; }
.rows { display: flex; flex-direction: column; gap: 6px; }
.row {
  display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; gap: 4px 12px; align-items: start;
  padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  cursor: pointer; transition: border-color .12s, box-shadow .12s;
}
.row:hover { border-color: var(--accent); box-shadow: var(--shadow); }
.row.on { border-color: var(--green); background: color-mix(in srgb, var(--green-soft) 60%, var(--surface)); }
.row.off { border-color: var(--red); background: color-mix(in srgb, var(--red-soft) 60%, var(--surface)); }
.row input { margin: 3px 0 0; width: 16px; height: 16px; accent-color: var(--green); cursor: pointer; }
.row .title { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; min-width: 0; }
.row .name { font-weight: 600; overflow-wrap: anywhere; }
.row .source { color: var(--muted); font-size: 12px; text-decoration: none; overflow-wrap: anywhere; }
.row .source:hover { color: var(--accent); text-decoration: underline; }
.row .desc {
  grid-column: 2 / 4; color: var(--muted); font-size: 13px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.row .pop { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.badge { font-size: 11px; padding: 1px 7px; border-radius: 99px; white-space: nowrap; }
.badge.official { color: var(--blue); background: color-mix(in srgb, var(--blue) 12%, transparent); }
.badge.installed { color: var(--accent); background: var(--accent-soft); }
.badge.remove { color: var(--red); background: var(--red-soft); }
.more { display: block; margin: 16px auto 0; }
[hidden] { display: none !important; }
.empty { text-align: center; padding: 48px 0; }

aside { border-left: 1px solid var(--border); background: var(--surface); padding: 16px 18px 24px; }
aside h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 20px 0 8px; }
aside h2:first-child { margin-top: 0; }
.summary { display: flex; gap: 8px; flex-wrap: wrap; }
.summary .badge { font-size: 12px; padding: 3px 10px; }
.picked { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.picked button {
  border: 1px solid var(--border); background: var(--surface-2); border-radius: 99px; padding: 2px 6px 2px 10px;
  font-size: 12px; display: inline-flex; gap: 6px; align-items: center;
}
.picked button.rm { border-color: color-mix(in srgb, var(--red) 40%, transparent); color: var(--red); }
.picked button:hover { border-color: var(--accent); }
.picked button span { opacity: .6; }
.choice { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 6px; cursor: pointer; }
.choice:hover { border-color: var(--accent); }
.choice:has(input:checked) { border-color: var(--accent); background: var(--accent-soft); }
.choice input { margin-top: 3px; accent-color: var(--accent); }
.choice small { display: block; color: var(--muted); overflow-wrap: anywhere; }
.agents-head { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
.agents-head input { flex: 1; min-width: 0; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-2); }
.agents { max-height: 220px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; padding: 4px; }
.agents label { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
.agents label:hover { background: var(--surface-2); }
.agents input { accent-color: var(--accent); }
.agents .badge { margin-left: auto; color: var(--green); background: var(--green-soft); }
.link { border: 0; background: none; color: var(--accent); padding: 0; font-size: 12px; }
.link:hover { text-decoration: underline; }
pre {
  margin: 0; padding: 10px; background: var(--surface-2); border-radius: 8px; font-size: 11.5px;
  white-space: pre-wrap; overflow-wrap: anywhere; max-height: 160px; overflow: auto;
}
.primary {
  width: 100%; margin-top: 16px; padding: 11px; border: 0; border-radius: 8px;
  background: var(--accent); color: #fff; font-weight: 600; font-size: 15px;
}
.primary:hover:not(:disabled) { filter: brightness(1.08); }
.primary:disabled { opacity: .45; cursor: not-allowed; }
.ghost { border: 1px solid var(--border); background: var(--surface); border-radius: 8px; padding: 7px 12px; }
.ghost:hover { border-color: var(--accent); color: var(--accent); }
.warn { color: var(--red); font-size: 13px; margin-top: 8px; }

dialog { border: 0; border-radius: 14px; padding: 0; width: min(640px, calc(100vw - 32px)); background: var(--surface); color: var(--text); box-shadow: var(--shadow); }
dialog::backdrop { background: rgba(0,0,0,.45); }
.dlg { padding: 20px 22px; }
.dlg h3 { margin: 0 0 14px; }
.task { display: grid; grid-template-columns: 22px 1fr auto; gap: 2px 10px; padding: 10px 0; border-top: 1px solid var(--border); }
.task:first-of-type { border-top: 0; }
.task .skills { grid-column: 2 / 4; color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
.task .err { grid-column: 2 / 4; }
.task .phase { color: var(--muted); font-size: 12px; }
.icon { width: 16px; height: 16px; margin-top: 2px; }
.spin { border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.ok { color: var(--green); } .ko { color: var(--red); }
.dlg footer { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }

@media (max-width: 1100px) { main { grid-template-columns: 200px minmax(0, 1fr) 320px; } }
@media (max-width: 860px) {
  main { grid-template-columns: minmax(0, 1fr); overflow: auto; }
  nav { border-right: 0; border-bottom: 1px solid var(--border); display: flex; overflow-x: auto; gap: 4px; padding: 8px 16px; }
  nav button { width: auto; white-space: nowrap; }
  nav hr { display: none; }
  .list { padding: 12px 16px 24px; overflow: visible; }
  aside { border-left: 0; border-top: 1px solid var(--border); overflow: visible; padding: 16px; }
  header { padding: 12px 16px; }
}
</style>
</head>
<body>
<header>
  <div class="brand">
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="none" stroke="var(--accent)" stroke-width="2.5"/><path d="M16 4v24M4 16h24" stroke="var(--accent)" stroke-width="1.5"/><circle cx="16" cy="16" r="4" fill="var(--accent)"/></svg>
    <div><b>SKILLS ATLAS</b><br><span class="muted" id="tagline"></span></div>
  </div>
  <label class="search">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input id="q" type="search" autocomplete="off" spellcheck="false">
  </label>
  <div class="controls">
    <select id="sort"></select>
    <button id="official" class="chip-toggle" aria-pressed="false"></button>
  </div>
</header>
<main>
  <nav id="themes"></nav>
  <section class="list">
    <div class="list-head"><strong id="count"></strong><span class="muted" id="where"></span></div>
    <div class="rows" id="rows"></div>
    <button class="ghost more" id="more" hidden></button>
  </section>
  <aside id="panel"></aside>
</main>
<dialog id="progress"><div class="dlg" id="progress-body"></div></dialog>
<script>
(function () {
  'use strict';
  var token = location.hash.slice(1);
  var M = {};
  var S = null;               // server state: themes, agents, installed, defaults…
  var installedById = new Map();
  var adds = new Map();       // id -> skill, to install
  var removes = new Set();    // installed ids to uninstall
  var opts = { scope: 'project', method: 'symlink', agents: new Set() };
  var view = { q: '', sort: 'installs', official: false, theme: '', offset: 0, items: [], total: 0, counts: {}, all: 0 };
  var showAllAgents = false, agentFilter = '', planTimer = 0, planSeq = 0, queryTimer = 0, querySeq = 0;
  var fmt = new Intl.NumberFormat();
  var PAGE = 100;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** Message with {placeholders} filled in. */
  function tr(key, vars) {
    var s = M[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function api(path, body) {
    var init = { headers: { 'x-atlas-token': token } };
    if (body) { init.method = 'POST'; init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body); }
    return fetch(path, init).then(function (res) {
      if (res.ok) return res;
      return res.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || res.statusText); });
    });
  }
  function apiJson(path, body) { return api(path, body).then(function (r) { return r.json(); }); }

  // ---- selection -------------------------------------------------------------------------
  function isChecked(id) { return installedById.has(id) ? !removes.has(id) : adds.has(id); }
  function toggle(skill) {
    if (installedById.has(skill.id)) { if (removes.has(skill.id)) removes.delete(skill.id); else removes.add(skill.id); }
    else if (adds.has(skill.id)) adds.delete(skill.id);
    else adds.set(skill.id, skill);
    renderRows(); renderPanel();
  }

  // ---- list ------------------------------------------------------------------------------
  function popularity(s) {
    if (s.installs) return tr('installs', { n: fmt.format(s.installs) });
    if (s.stars) return tr('stars', { n: fmt.format(s.stars) });
    return s.rank != null ? tr('rank', { n: fmt.format(s.rank) }) : '';
  }
  function githubUrl(s) { return /^[\w.-]+\/[\w.-]+$/.test(s.source) ? 'https://github.com/' + s.source : ''; }

  function rowHtml(s) {
    var inst = installedById.get(s.id);
    var on = isChecked(s.id);
    var cls = inst ? (on ? '' : ' off') : (on ? ' on' : '');
    var badges = '';
    if (s.official) badges += '<span class="badge official">◆ ' + esc(M.official) + '</span>';
    if (inst) badges += on
      ? '<span class="badge installed">● ' + esc(tr('installedIn', { where: inst.scopes.map(function (x) { return M[x]; }).join(' + ') })) + '</span>'
      : '<span class="badge remove">✗ ' + esc(M.willRemove) + '</span>';
    var url = githubUrl(s);
    var source = url ? '<a class="source" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.source) + '</a>'
                     : '<span class="source">' + esc(s.source) + '</span>';
    return '<div class="row' + cls + '" data-id="' + esc(s.id) + '">' +
      '<input type="checkbox" tabindex="-1"' + (on ? ' checked' : '') + ' aria-label="' + esc(s.name) + '">' +
      '<div class="title"><span class="name">' + esc(s.name) + '</span>' + source + badges + '</div>' +
      '<span class="pop">' + esc(popularity(s)) + '</span>' +
      '<div class="desc">' + esc(s.description || M.noDescription) + '</div></div>';
  }

  var shown = new Map();
  function renderRows() {
    var rows = $('rows');
    shown = new Map(view.items.map(function (s) { return [s.id, s]; }));
    rows.innerHTML = view.items.length ? view.items.map(rowHtml).join('') : '<div class="empty muted">' + esc(M.noMatch) + '</div>';
    $('count').textContent = tr('results', { n: fmt.format(view.total) });
    var more = $('more');
    more.hidden = view.items.length >= view.total;
    more.textContent = tr('loadMore', { n: fmt.format(Math.min(PAGE, view.total - view.items.length)) });
  }
  $('rows').addEventListener('click', function (e) {
    if (e.target.closest('a')) return;
    var row = e.target.closest('.row');
    if (row) toggle(shown.get(row.dataset.id));
  });

  function matchesQuery(s) {
    var terms = view.q.toLowerCase().split(/\s+/).filter(Boolean);
    var text = (s.id + ' ' + (s.description || '')).toLowerCase();
    return (!view.official || s.official) && terms.every(function (t) { return text.indexOf(t) >= 0; });
  }

  /** Installed skills are few and known here; the catalog is searched by the server, a page at a time. */
  function load(append) {
    var seq = ++querySeq;
    var local = view.theme === 'installed';
    // For installed skills the server only gives the theme counts of the search.
    var p = new URLSearchParams({ q: view.q, sort: view.sort, official: view.official ? '1' : '0', theme: local ? '' : view.theme,
      offset: String(append ? view.items.length : 0), limit: String(local ? 1 : PAGE) });
    return apiJson('/api/skills?' + p).then(function (r) {
      if (seq !== querySeq) return;
      view.counts = r.counts; view.all = r.all;
      if (local) {
        var list = S.installed.filter(matchesQuery);
        list.sort(view.sort === 'name'
          ? function (a, b) { return a.name.localeCompare(b.name); }
          : function (a, b) { return (b.installs || 0) - (a.installs || 0); });
        view.items = list; view.total = list.length;
      } else {
        view.items = append ? view.items.concat(r.items) : r.items;
        view.total = r.total;
      }
      renderRows(); renderThemes();
      if (!append) document.querySelector('.list').scrollTop = 0;
    }).catch(fail);
  }
  $('more').addEventListener('click', function () { load(true); });

  // ---- themes ----------------------------------------------------------------------------
  function renderThemes() {
    var installedCount = S.installed.filter(matchesQuery).length;
    var html = '<button data-theme=""' + (view.theme === '' ? ' aria-current="true"' : '') + '><span>' + esc(M.allThemes) +
      '</span><span class="n">' + fmt.format(view.all) + '</span></button>';
    S.themes.forEach(function (th) {
      var n = th.id === 'installed' ? installedCount : (view.counts[th.id] || 0);
      if (th.id === 'installed' && !S.installed.length) return;
      html += '<button data-theme="' + esc(th.id) + '"' + (view.theme === th.id ? ' aria-current="true"' : '') + '><span>' +
        esc(th.label) + '</span><span class="n">' + fmt.format(n) + '</span></button>';
      if (th.id === 'installed') html += '<hr>';
    });
    $('themes').innerHTML = html;
  }
  $('themes').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    view.theme = b.dataset.theme;
    load(false);
  });

  // ---- panel -----------------------------------------------------------------------------
  function selectedAgents() { return S.agents.filter(function (a) { return opts.agents.has(a.id); }).map(function (a) { return a.id; }); }

  function renderPanel() {
    var nAdd = adds.size, nRm = removes.size;
    var h = '<h2>' + esc(M.selection) + '</h2>';
    if (!nAdd && !nRm) h += '<p class="muted">' + esc(M.selectionEmpty) + '</p>';
    else {
      h += '<div class="summary">' +
        (nAdd ? '<span class="badge" style="color:var(--green);background:var(--green-soft)">+ ' + esc(tr('toInstall', { n: nAdd })) + '</span>' : '') +
        (nRm ? '<span class="badge remove">− ' + esc(tr('toRemove', { n: nRm })) + '</span>' : '') +
        '<button class="link" data-act="clear">' + esc(M.clear) + '</button></div><div class="picked">';
      adds.forEach(function (s) { h += '<button data-add="' + esc(s.id) + '" title="' + esc(s.id) + '">' + esc(s.name) + '<span>×</span></button>'; });
      removes.forEach(function (id) {
        var s = installedById.get(id);
        h += '<button class="rm" data-rm="' + esc(id) + '" title="' + esc(id) + '">' + esc(s ? s.name : id) + '<span>×</span></button>';
      });
      h += '</div>';
    }
    if (nAdd) {
      h += '<h2>' + esc(M.scopeTitle) + '</h2>' +
        choice('scope', 'project', M.scopeProject, tr('scopeProjectHint', { cwd: S.cwd })) +
        choice('scope', 'global', M.scopeGlobal, M.scopeGlobalHint);
      var list = S.agents.filter(function (a) {
        var hit = !agentFilter || (a.id + ' ' + a.name).toLowerCase().indexOf(agentFilter) >= 0;
        return hit && (showAllAgents || agentFilter || a.detected || opts.agents.has(a.id));
      });
      h += '<h2>' + esc(M.agentsTitle) + ' <span style="text-transform:none;letter-spacing:0">· ' +
        esc(tr('agentsCount', { n: opts.agents.size })) + '</span></h2>' +
        '<div class="agents-head"><input id="agent-filter" type="search" placeholder="' + esc(M.agentsFilter) + '" value="' + esc(agentFilter) + '">' +
        '<button class="link" data-act="all-agents">' + esc(showAllAgents ? M.showDetected : M.showAllAgents) + '</button></div>' +
        '<div class="agents">' + (list.length ? list.map(function (a) {
          return '<label><input type="checkbox" data-agent="' + esc(a.id) + '"' + (opts.agents.has(a.id) ? ' checked' : '') + '>' +
            esc(a.name) + ' <span class="muted" style="font-size:12px">' + esc(a.id) + '</span>' +
            (a.detected ? '<span class="badge">' + esc(M.detected) + '</span>' : '') + '</label>';
        }).join('') : '<p class="muted" style="margin:6px 8px">' + esc(M.noAgent) + '</p>') + '</div>';
      h += '<h2>' + esc(M.methodTitle) + '</h2>' +
        choice('method', 'symlink', M.symlink, M.symlinkHint) + choice('method', 'copy', M.copy, M.copyHint);
    }
    if (nAdd || nRm) {
      h += '<h2>' + esc(M.commands) + '</h2><pre id="plan">…</pre>';
      var blocked = nAdd && !opts.agents.size;
      if (blocked) h += '<p class="warn">' + esc(M.needAgent) + '</p>';
      h += '<button class="primary" data-act="apply"' + (blocked ? ' disabled' : '') + '>' + esc(M.apply) + '</button>';
    }
    var focusFilter = document.activeElement && document.activeElement.id === 'agent-filter';
    $('panel').innerHTML = h;
    if (focusFilter) { var f = $('agent-filter'); f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    schedulePlan();
  }
  function choice(name, value, label, hint) {
    return '<label class="choice"><input type="radio" name="' + name + '" value="' + value + '"' + (opts[name] === value ? ' checked' : '') + '>' +
      '<span>' + esc(label) + '<small>' + esc(hint) + '</small></span></label>';
  }
  function body() {
    return { install: Array.from(adds.keys()), remove: Array.from(removes), options: { agents: selectedAgents(), scope: opts.scope, method: opts.method } };
  }
  /** Command preview, computed by the server with the same code as the terminal. */
  function schedulePlan() {
    clearTimeout(planTimer);
    if (!adds.size && !removes.size) return;
    if (adds.size && !opts.agents.size) { var p0 = $('plan'); if (p0) p0.textContent = '—'; return; }
    var seq = ++planSeq;
    planTimer = setTimeout(function () {
      apiJson('/api/plan', body()).then(function (r) {
        var p = $('plan');
        if (p && seq === planSeq) p.textContent = r.commands.map(function (c) { return '$ ' + c; }).join('\n');
      }).catch(function (err) { var p = $('plan'); if (p) p.textContent = err.message; });
    }, 150);
  }

  $('panel').addEventListener('click', function (e) {
    var t = e.target.closest('[data-act],[data-add],[data-rm]');
    if (!t) return;
    if (t.dataset.add) adds.delete(t.dataset.add);
    else if (t.dataset.rm) removes.delete(t.dataset.rm);
    else if (t.dataset.act === 'clear') { adds.clear(); removes.clear(); }
    else if (t.dataset.act === 'all-agents') showAllAgents = !showAllAgents;
    else if (t.dataset.act === 'apply') return apply();
    renderRows(); renderPanel();
  });
  $('panel').addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'scope' || t.name === 'method') opts[t.name] = t.value;
    else if (t.dataset.agent) { if (t.checked) opts.agents.add(t.dataset.agent); else opts.agents.delete(t.dataset.agent); }
    renderPanel();
  });
  $('panel').addEventListener('input', function (e) {
    if (e.target.id !== 'agent-filter') return;
    agentFilter = e.target.value.trim().toLowerCase();
    renderPanel();
  });

  // ---- apply -----------------------------------------------------------------------------
  function apply() {
    var dlg = $('progress'), tasks = [];
    var out = $('progress-body');
    function render(end) {
      var h = '<h3>' + esc(end ? (end.ok ? M.summaryOk : M.summaryFailed) : M.progressTitle) + '</h3>';
      tasks.forEach(function (t) {
        var icon = t.done ? (t.ok ? '<span class="icon ok">✓</span>' : '<span class="icon ko">✗</span>')
                          : (t.started ? '<span class="icon spin"></span>' : '<span class="icon muted">○</span>');
        h += '<div class="task">' + icon + '<strong>' + esc(t.kind === 'remove' ? M.uninstall : t.source) + '</strong>' +
          '<span class="phase ' + (t.done ? (t.ok ? 'ok' : 'ko') : '') + '">' + esc(M['phase_' + (t.done ? (t.ok ? 'done' : 'failed') : t.phase)]) + '</span>' +
          '<span class="skills">' + esc(t.skills.join(', ')) + '</span>' +
          (t.error ? '<pre class="err">' + esc(t.error) + '</pre>' : '') + '</div>';
      });
      if (!tasks.length) h += '<p class="muted">…</p>';
      if (end && end.error) h += '<p class="warn">' + esc(end.error) + '</p>';
      h += '<footer><span class="muted">' + esc(end ? '' : M.applying) + '</span>' +
        (end ? '<button class="primary" style="width:auto;margin:0;padding:8px 18px" id="close">' + esc(M.close) + '</button>' : '') + '</footer>';
      out.innerHTML = h;
      var c = $('close');
      if (c) c.onclick = function () { dlg.close(); refresh(); };
    }
    render(null);
    dlg.showModal();
    dlg.oncancel = function (e) { if (!$('close')) e.preventDefault(); };
    api('/api/apply', body()).then(function (res) {
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
      function pump() {
        return reader.read().then(function (chunk) {
          if (chunk.done) return;
          buf += dec.decode(chunk.value, { stream: true });
          var lines = buf.split('\n'); buf = lines.pop();
          lines.filter(Boolean).forEach(function (line) {
            var ev = JSON.parse(line);
            if (ev.type === 'start') tasks[ev.i] = { kind: ev.kind, source: ev.source, skills: ev.skills, started: true, phase: 'fetching' };
            else if (ev.type === 'phase') tasks[ev.i].phase = ev.phase;
            else if (ev.type === 'done') { tasks[ev.i].done = true; tasks[ev.i].ok = ev.ok; tasks[ev.i].error = ev.error; }
            render(ev.type === 'end' ? ev : null);
          });
          return pump();
        });
      }
      return pump();
    }).catch(function (err) { render({ ok: false, error: err.message }); });
  }

  /** After an install: what is installed changed, the selection is spent. */
  function refresh() {
    adds.clear(); removes.clear();
    return apiJson('/api/state').then(function (st) { setState(st); renderPanel(); return load(false); }).catch(fail);
  }

  // ---- boot ------------------------------------------------------------------------------
  function setState(st) {
    S = st;
    installedById = new Map(st.installed.map(function (s) { return [s.id, s]; }));
  }
  function fail(err) {
    $('rows').innerHTML = '<div class="empty warn">' + esc(tr('error', { msg: err.message || String(err) })) + '</div>';
  }

  apiJson('/api/state').then(function (st) {
    M = st.messages;
    document.documentElement.lang = st.lang;
    fmt = new Intl.NumberFormat(st.lang === 'fr' ? 'fr-FR' : 'en-US');
    setState(st);
    opts.scope = st.defaults.scope; opts.method = st.defaults.method;
    opts.agents = new Set(st.defaults.agents);
    $('tagline').textContent = M.tagline;
    $('q').placeholder = M.searchPlaceholder;
    $('sort').innerHTML = '<option value="installs">' + esc(M.sortInstalls) + '</option><option value="name">' + esc(M.sortName) + '</option>';
    $('official').textContent = '◆ ' + M.officialOnly;
    renderPanel();
    return load(false);
  }).catch(function (err) {
    document.body.innerHTML = '<p style="padding:40px;text-align:center">' + esc(err.message) + '</p>';
  });

  $('q').addEventListener('input', function (e) {
    clearTimeout(queryTimer);
    queryTimer = setTimeout(function () { view.q = e.target.value.trim(); load(false); }, 120);
  });
  $('sort').addEventListener('change', function (e) { view.sort = e.target.value; load(false); });
  $('official').addEventListener('click', function (e) {
    view.official = !view.official;
    e.currentTarget.setAttribute('aria-pressed', String(view.official));
    load(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); $('q').focus(); }
  });
})();
</script>
</body>
</html>
`;
