'use strict';

const api = window.launcher;
const view = document.getElementById('view');
const nav = document.getElementById('nav');
const q = (selector) => document.querySelector(selector);

let cfg = null;
let page = 'start';
let timers = [];
let partnerRefreshTimer = null;

// ---------------------------------------------------------------------------
// Helfer
// ---------------------------------------------------------------------------

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmtSize = (b) => {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  return (b / Math.pow(1024, i)).toFixed(i ? 1 : 0).replace('.', ',') + ' ' + u[i];
};
const fmtDate = (ms) =>
  new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDay = (ms) => new Date(ms).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtClock = (ms) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtHours = (h) => {
  const mins = Math.round(h * 60);
  return Math.floor(mins / 60) + ' h ' + String(mins % 60).padStart(2, '0') + ' min';
};
const fmtNum = (n, d = 0) => (isFinite(n) ? n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
const eur = (n) => fmtNum(n, 2) + ' €';

const hueOf = (s) => {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};
const initials = (s) =>
  String(s)
    .replace(/^FS\d{2}_/i, '')
    .split(/[\s_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

const I = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
  start: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.6 3.6-6 8-6s8 2.4 8 6"/></svg>',
  mods: '<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><path d="M8 20v-6h8v6"/></svg>',
  log: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></svg>',
  calc: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>',
  server: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  restore: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  cloud: '<svg viewBox="0 0 24 24"><path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
};

function toast(msg, error = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (error ? ' error' : '');
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), error ? 7000 : 4000);
}

function openModal(html, wide = false) {
  const root = document.getElementById('modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  root.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });
  return { el: overlay.firstElementChild, close };
}

function confirmDialog(title, text, okLabel = 'Bestätigen', danger = false) {
  return new Promise((resolve) => {
    const m = openModal(
      `<h2>${esc(title)}</h2><p class="lead">${esc(text)}</p>
       <div class="modal-actions">
         <button class="btn" data-no>Abbrechen</button>
         <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(okLabel)}</button>
       </div>`
    );
    m.el.querySelector('[data-no]').onclick = () => (m.close(), resolve(false));
    m.el.querySelector('[data-yes]').onclick = () => (m.close(), resolve(true));
  });
}

const activeProfile = () => cfg.profiles.find((p) => p.id === cfg.activeProfile) || cfg.profiles[0];

async function persist() {
  cfg = await api.config.set(cfg);
  return cfg;
}

function head(title, sub, actions = '') {
  return `<div class="page-head"><div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div class="head-actions">${actions}</div></div>`;
}

function emptyBox(title, text) {
  return `<div class="empty">${I.box}<b>${esc(title)}</b><span>${esc(text)}</span></div>`;
}

const sourceLabel = (s) => (s === 'settings' ? 'aus den Einstellungen' : s === 'gameSettings' ? 'aus der gameSettings.xml' : s === 'profile' ? 'vom Hof-Profil' : 'Spiel-Standard');

async function activateProfile(id) {
  cfg.activeProfile = id;
  await persist();
  const r = await api.applyProfile();
  if (!r.ok) toast(r.error, true);
  else if (r.changed) toast('Mod-Ordner gewechselt: ' + r.dir);
}

function clearTimers() {
  timers.forEach(clearInterval);
  timers = [];
}

function iconEl(m, cls = 'mod-icon') {
  if (m.icon) return `<img class="${cls}" src="${m.icon}" alt="">`;
  const h = hueOf(m.id);
  return `<div class="${cls} ph" data-icon-file="${esc(m.file)}" style="background:linear-gradient(135deg,hsl(${h} 45% 28%),hsl(${(h + 40) % 360} 50% 18%))">${esc(initials(m.title || m.id))}</div>`;
}

let modIconObserver = null;
const modIconRequests = new Map();
function requestModIcon(file) {
  if (!modIconRequests.has(file)) {
    const request = api.mods.icon(file).finally(() => modIconRequests.delete(file));
    modIconRequests.set(file, request);
  }
  return modIconRequests.get(file);
}
function loadModIcons(root = document) {
  if (modIconObserver) modIconObserver.disconnect();
  if (!('IntersectionObserver' in window)) return;
  modIconObserver = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const placeholder = entry.target, file = placeholder.dataset.iconFile;
      observer.unobserve(placeholder);
      requestModIcon(file).then((src) => {
        if (!src) return;
        const mod = M.items.find((item) => item.file === file);
        if (mod) mod.icon = src;
        if (!placeholder.isConnected) return;
        const image = document.createElement('img');
        image.className = placeholder.className.replace(/\sph\b/, '');
        image.src = src;
        image.alt = '';
        placeholder.replaceWith(image);
      });
    }
  }, { root: document.querySelector('.content'), rootMargin: '120px' });
  root.querySelectorAll('[data-icon-file]').forEach((node) => modIconObserver.observe(node));
}

const pages = {};

// ---------------------------------------------------------------------------
// Starten
// ---------------------------------------------------------------------------

pages.start = {
  title: 'Starten',
  icon: I.start,
  async render() {
    const p = activeProfile();
    const gameOk = !!cfg.gamePath;
    const [mods, saves, backups, mf] = await Promise.all([api.mods.list(), api.saves.list(), api.backups.list(), api.modFolderInfo()]);
    const args = [p.skipIntro && '-skipStartVideos', p.devMode && '-cheats -console', p.autoStartSave && p.savegame && '-autoStartSavegameId', p.extraArgs].filter(Boolean).join(' ');
    const modErrors = mods.ok ? mods.items.filter((m) => m.enabled && m.errors.some((e) => e.sev === 'error')).length : 0;

    view.innerHTML =
      head('Starten', 'Bereit für die nächste Ernte?') +
      `<div class="grid g-main">
        <div class="stack">
          <div class="card hero">
            <div class="hero-top">
              <img src="../assets/icon.png" alt="">
              <div>
                <h2>Landwirtschafts-Simulator 25</h2>
                <p>${gameOk ? '<span class="chip ok"><i></i>Spiel gefunden</span>' : '<span class="chip bad"><i></i>Spiel-Pfad fehlt</span>'}</p>
              </div>
            </div>
            <button class="btn primary launch" id="btn-launch">${I.play}SPIEL STARTEN</button>
            ${gameOk ? '' : '<p class="note" style="margin:0">Lege den Pfad zur FarmingSimulator2025.exe unter <a data-go="settings">Einstellungen</a> fest.</p>'}
          </div>
          <div class="grid g-3">
            <div class="card stat"><b>${mods.ok ? mods.items.length : '–'}</b><span>Mods im Ordner</span></div>
            <div class="card stat"><b>${saves.ok ? saves.items.length : '–'}</b><span>Spielstände</span></div>
            <div class="card stat"><b>${backups.items.length}</b><span>Backups</span></div>
          </div>
          <div class="banner">${I.folder}<div class="grow"><small>Aktiver Mod-Ordner · ${esc(sourceLabel(mf.source))}</small><span class="path">${esc(mf.dir)}</span></div>
            ${modErrors ? `<a data-go="mods"><span class="chip bad"><i></i>${modErrors} Mod${modErrors > 1 ? 's' : ''} mit Fehlern</span></a>` : ''}</div>
        </div>

        <div class="stack">
          <div class="card">
            <h2>Aktives Profil</h2>
            <div class="field" style="margin-bottom:14px">
              <select class="input" id="sel-profile">
                ${cfg.profiles.map((x) => `<option value="${esc(x.id)}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
              </select>
            </div>
            <dl class="kv">
              <dt>Hof</dt><dd>${esc(p.farm || '–')}</dd>
              <dt>Savegame</dt><dd>${esc(p.savegame || 'nicht zugeordnet')}</dd>
              <dt>Startoptionen</dt><dd class="mono">${esc(args || 'keine')}</dd>
            </dl>
          </div>
          <div class="card">
            <h2>Schnelleinstellungen</h2>
            <div class="setting"><div><b>Dev Mode</b><small>Startet mit -cheats und -console</small></div>
              <label class="switch"><input type="checkbox" data-qs="devMode" ${p.devMode ? 'checked' : ''}><span></span></label></div>
            <div class="setting"><div><b>Shader Cache leeren</b><small>Löscht den Cache vor dem Start</small></div>
              <label class="switch"><input type="checkbox" data-qs="clearShader" ${p.clearShader ? 'checked' : ''}><span></span></label></div>
            <div class="setting"><div><b>Intro überspringen</b><small>Startet mit -skipStartVideos</small></div>
              <label class="switch"><input type="checkbox" data-qs="skipIntro" ${p.skipIntro ? 'checked' : ''}><span></span></label></div>
            <div class="setting"><div><b>Automatisches Backup vor jedem Start</b><small>${p.savegame ? 'Sichert ' + esc(p.savegame) : 'Sichert alle Spielstände'}</small></div>
              <label class="switch"><input type="checkbox" data-global="autoBackup" ${cfg.autoBackup ? 'checked' : ''}><span></span></label></div>
          </div>
        </div>
      </div>`;

    document.getElementById('btn-launch').onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const r = await api.launch();
      btn.disabled = false;
      if (r.ok) toast('Landwirtschafts-Simulator 25 wird gestartet …' + (r.notes && r.notes.length ? ' (' + r.notes.join(', ') + ')' : ''));
      else toast(r.error, true);
    };
    document.getElementById('sel-profile').onchange = async (e) => {
      await activateProfile(e.target.value);
      pages.start.render();
    };
    view.querySelectorAll('[data-qs]').forEach((cb) => {
      cb.onchange = async () => {
        activeProfile()[cb.dataset.qs] = cb.checked;
        await persist();
        pages.start.render();
      };
    });
    view.querySelectorAll('[data-global]').forEach((cb) => {
      cb.onchange = async () => {
        cfg[cb.dataset.global] = cb.checked;
        await persist();
      };
    });
  }
};

// ---------------------------------------------------------------------------
// Hof Profile
// ---------------------------------------------------------------------------

async function modPicker(st, getSpec) {
  const res = await api.mods.list(getSpec());
  if (!res.ok) return toast(res.error || 'Mod-Ordner nicht lesbar.', true);
  const items = res.items;
  let sel = new Set(st.modSelection.length ? st.modSelection : items.filter((m) => m.enabled).map((m) => m.id));
  const m = openModal(
    `<h2>Mods dem Profil zuweisen</h2>
     <p class="lead">Beim Start sind nur die ausgewählten Mods aktiv. Alle anderen werden vorübergehend auf <span class="mono">.bak</span> gesetzt und beim nächsten Start mit „Alle Mods“ wieder aktiviert.</p>
     <div class="toolbar"><input class="input" id="pk-q" placeholder="Suchen …"><span class="grow"></span><button class="btn sm" id="pk-all">Alle</button><button class="btn sm" id="pk-none">Keine</button></div>
     <div class="picker-list" id="pk-list"></div>
     <div class="modal-actions"><span class="chip" id="pk-count"></span><button class="btn" data-no>Abbrechen</button><button class="btn primary" data-yes>Übernehmen</button></div>`,
    true
  );
  const list = m.el.querySelector('#pk-list');
  const draw = () => {
    const q = m.el.querySelector('#pk-q').value.trim().toLowerCase();
    const shown = items.filter((x) => (x.title + ' ' + x.id + ' ' + x.author).toLowerCase().includes(q));
    list.innerHTML = shown.length
      ? shown
          .map(
            (x) => `<label class="pick">${iconEl(x, '')}<div class="grow"><b>${esc(x.title)}</b><small>${esc(x.id)}${x.version ? ' · v' + esc(x.version) : ''}</small></div>
            <span class="switch"><input type="checkbox" data-id="${esc(x.id)}" ${sel.has(x.id) ? 'checked' : ''}><span></span></span></label>`
          )
          .join('')
      : emptyBox('Keine Mods', 'Nichts gefunden.');
    list.querySelectorAll('input[data-id]').forEach((cb) => {
      cb.onchange = () => {
        if (cb.checked) sel.add(cb.dataset.id);
        else sel.delete(cb.dataset.id);
        count();
      };
    });
    count();
  };
  const count = () => (m.el.querySelector('#pk-count').textContent = sel.size + ' von ' + items.length + ' gewählt');
  m.el.querySelector('#pk-q').oninput = draw;
  m.el.querySelector('#pk-all').onclick = () => ((sel = new Set(items.map((x) => x.id))), draw());
  m.el.querySelector('#pk-none').onclick = () => ((sel = new Set()), draw());
  m.el.querySelector('[data-no]').onclick = m.close;
  m.el.querySelector('[data-yes]').onclick = () => {
    st.modSelection = Array.from(sel);
    m.close();
    st.onSelection && st.onSelection();
  };
  draw();
}

async function profileForm(p) {
  const isNew = !p;
  const base = p || {
    id: 'p' + Date.now(), name: '', farm: '', notes: '', devMode: false, clearShader: false, skipIntro: true, extraArgs: '',
    modFolderMode: 'keep', modFolder: '', savegame: '', autoStartSave: false, modMode: 'all', modSelection: []
  };
  const st = { ...base, modSelection: [...(base.modSelection || [])] };
  const saves = await api.saves.list();
  const slots = saves.ok ? saves.items : [];

  const m = openModal(
    `<h2>${isNew ? 'Neues Profil' : 'Profil bearbeiten'}</h2>
     <p class="lead">Jedes Profil hat eigenen Mod-Ordner, Savegame und Startoptionen.</p>
     <div class="form-row">
       <div class="field"><label>Profilname</label><input class="input" id="f-name" maxlength="60" value="${esc(st.name)}" placeholder="z. B. Multiplayer Server X"></div>
       <div class="field"><label>Hofname</label><input class="input" id="f-farm" maxlength="60" value="${esc(st.farm)}"></div>
     </div>

     <div class="sec-title">Mod-Ordner</div>
     <div class="field"><select class="input" id="f-mf">
        <option value="keep">Unverändert lassen (laut gameSettings.xml)</option>
        <option value="default">Spiel-Standard (Profil-Ordner\\mods)</option>
        <option value="custom">Eigener Ordner …</option></select>
        <small>Der Launcher trägt den Ordner beim Wechseln und Starten in die gameSettings.xml ein – es werden keine Ordner umbenannt oder verschoben.</small></div>
     <div class="field path-row-wrap ${st.modFolderMode === 'custom' ? '' : 'hidden'}" id="f-mf-row">
       <div class="path-row"><input class="input mono" id="f-mfp" value="${esc(st.modFolder)}" placeholder="D:\\FS25\\Mods\\Multiplayer" spellcheck="false"><button class="btn" id="f-mfpick">${I.folder}Wählen</button></div></div>

     <div class="sec-title">Savegame &amp; Mods</div>
     <div class="form-row">
       <div class="field"><label>Zugeordnetes Savegame</label><select class="input" id="f-save">
          <option value="">Keins</option>
          ${slots.map((s) => `<option value="${esc(s.slot)}">${esc(s.slot)} – ${esc(s.name)}</option>`).join('')}</select></div>
       <div class="field"><label>Mods</label><div class="path-row"><select class="input" id="f-mm"><option value="all">Alle Mods aktiv</option><option value="selection">Nur ausgewählte</option></select>
          <button class="btn ${st.modMode === 'selection' ? '' : 'hidden'}" id="f-mpick">${I.mods}<span id="f-mcount"></span></button></div></div>
     </div>
     <div class="setting"><div><b>Savegame direkt laden</b><small>Hängt -autoStartSavegameId an (experimentell, benötigt ein zugeordnetes Savegame)</small></div><label class="switch"><input type="checkbox" id="f-auto" ${st.autoStartSave ? 'checked' : ''}><span></span></label></div>

     <div class="sec-title">Start</div>
     <div class="field"><label>Zusätzliche Startparameter</label><input class="input mono" id="f-args" maxlength="300" value="${esc(st.extraArgs)}" placeholder="-beispiel -noch"><small>Nur Parameter in der Form -name werden übernommen.</small></div>
     <div class="field"><label>Notizen</label><textarea class="input" id="f-notes" maxlength="400">${esc(st.notes)}</textarea></div>
     <div class="setting"><div><b>Dev Mode</b></div><label class="switch"><input type="checkbox" id="f-dev" ${st.devMode ? 'checked' : ''}><span></span></label></div>
     <div class="setting"><div><b>Shader Cache leeren</b></div><label class="switch"><input type="checkbox" id="f-shader" ${st.clearShader ? 'checked' : ''}><span></span></label></div>
     <div class="setting"><div><b>Intro überspringen</b></div><label class="switch"><input type="checkbox" id="f-intro" ${st.skipIntro ? 'checked' : ''}><span></span></label></div>
     <div class="modal-actions" style="margin-top:20px"><button class="btn" data-no>Abbrechen</button><button class="btn primary" data-yes>Speichern</button></div>`,
    true
  );
  const q = (s) => m.el.querySelector(s);
  q('#f-mf').value = st.modFolderMode;
  q('#f-save').value = st.savegame;
  q('#f-mm').value = st.modMode;
  const countLabel = () => (q('#f-mcount').textContent = 'Mods wählen (' + st.modSelection.length + ')');
  countLabel();
  st.onSelection = countLabel;

  q('#f-mf').onchange = (e) => q('#f-mf-row').classList.toggle('hidden', e.target.value !== 'custom');
  q('#f-mfpick').onclick = async () => {
    const v = await api.pick('dir');
    if (v) q('#f-mfp').value = v;
  };
  q('#f-mm').onchange = (e) => q('#f-mpick').classList.toggle('hidden', e.target.value !== 'selection');
  q('#f-mpick').onclick = () => modPicker(st, () => ({ modFolderMode: q('#f-mf').value, modFolder: q('#f-mfp').value.trim() }));
  q('[data-no]').onclick = m.close;
  q('[data-yes]').onclick = async () => {
    const name = q('#f-name').value.trim();
    if (!name) return toast('Bitte einen Profilnamen eingeben.', true);
    const mode = q('#f-mf').value;
    const folder = q('#f-mfp').value.trim();
    if (mode === 'custom' && !folder) return toast('Bitte einen Mod-Ordner wählen.', true);
    const next = {
      id: st.id, name,
      farm: q('#f-farm').value.trim(),
      notes: q('#f-notes').value.trim(),
      extraArgs: q('#f-args').value.trim(),
      devMode: q('#f-dev').checked,
      clearShader: q('#f-shader').checked,
      skipIntro: q('#f-intro').checked,
      modFolderMode: mode,
      modFolder: mode === 'custom' ? folder : '',
      savegame: q('#f-save').value,
      autoStartSave: q('#f-auto').checked,
      modMode: q('#f-mm').value,
      modSelection: st.modSelection
    };
    const idx = cfg.profiles.findIndex((x) => x.id === st.id);
    if (idx >= 0) cfg.profiles[idx] = next;
    else cfg.profiles.push(next);
    await persist();
    if (st.id === cfg.activeProfile) {
      const r = await api.applyProfile();
      if (!r.ok) toast(r.error, true);
    }
    m.close();
    pages.profiles.render();
  };
  q('#f-name').focus();
}

pages.profiles = {
  title: 'Hof Profile',
  icon: I.user,
  async render() {
    const modeLabel = (p) =>
      p.modFolderMode === 'custom' ? p.modFolder : p.modFolderMode === 'default' ? 'Spiel-Standard' : 'laut gameSettings.xml';
    view.innerHTML =
      head('Hof Profile', 'Mod-Ordner, Savegame und Startoptionen pro Hof.', `<button class="btn primary" id="p-new">${I.plus}Neues Profil</button>`) +
      `<div class="grid g-2">
        ${cfg.profiles
          .map((p) => {
            const active = p.id === cfg.activeProfile;
            return `<div class="card profile-card ${active ? 'active' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
                <div><h3>${esc(p.name)}</h3><div class="sub">${esc(p.farm || 'Kein Hofname')}</div></div>
                ${active ? '<span class="chip ok"><i></i>Aktiv</span>' : ''}
              </div>
              <dl class="pc-info">
                <dt>Mod-Ordner</dt><dd title="${esc(modeLabel(p))}">${esc(modeLabel(p))}</dd>
                <dt>Savegame</dt><dd>${esc(p.savegame || 'nicht zugeordnet')}${p.autoStartSave && p.savegame ? ' · wird direkt geladen' : ''}</dd>
                <dt>Mods</dt><dd>${p.modMode === 'selection' ? p.modSelection.length + ' ausgewählte Mods' : 'Alle aktiv'}</dd>
              </dl>
              <div class="pc-tags">
                ${p.devMode ? '<span class="tag">DEV MODE</span>' : ''}
                ${p.clearShader ? '<span class="tag">SHADER-RESET</span>' : ''}
                ${p.skipIntro ? '<span class="tag">KEIN INTRO</span>' : ''}
                ${p.extraArgs ? `<span class="tag mono">${esc(p.extraArgs)}</span>` : ''}
              </div>
              ${p.notes ? `<div class="sub">${esc(p.notes)}</div>` : ''}
              <div class="pc-actions">
                ${active ? '' : `<button class="btn sm primary" data-use="${esc(p.id)}">${I.check}Aktivieren</button>`}
                <button class="btn sm" data-edit="${esc(p.id)}">${I.edit}Bearbeiten</button>
                ${cfg.profiles.length > 1 ? `<button class="btn sm danger" data-del="${esc(p.id)}">${I.trash}</button>` : ''}
              </div>
            </div>`;
          })
          .join('')}
      </div>
      <p class="note">Beim Aktivieren und beim Spielstart schreibt der Launcher den Mod-Ordner des Profils in die <span class="mono">gameSettings.xml</span> (mit Sicherheitskopie <span class="mono">.ls25launcher.bak</span>). Das Spiel muss dafür beendet sein.</p>`;

    document.getElementById('p-new').onclick = () => profileForm(null);
    view.querySelectorAll('[data-use]').forEach((b) => {
      b.onclick = async () => {
        await activateProfile(b.dataset.use);
        pages.profiles.render();
      };
    });
    view.querySelectorAll('[data-edit]').forEach((b) => {
      b.onclick = () => profileForm(cfg.profiles.find((x) => x.id === b.dataset.edit));
    });
    view.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        const p = cfg.profiles.find((x) => x.id === b.dataset.del);
        if (!(await confirmDialog('Profil löschen?', `„${p.name}“ wird aus dem Launcher entfernt. Mods und Spielstände bleiben unberührt.`, 'Löschen', true))) return;
        cfg.profiles = cfg.profiles.filter((x) => x.id !== p.id);
        await persist();
        pages.profiles.render();
      };
    });
  }
};

// ---------------------------------------------------------------------------
// Mods & Assets (Mod-Regal)
// ---------------------------------------------------------------------------

const M = { items: [], dir: '', source: '', file: '', filter: 'all', type: 'all', sort: 'name', q: '', limit: 80, conflicts: null, conflictMap: {}, hub: {}, hubRun: null, scroll: 0 };

function modType(m) {
  const explicit = String(m.category || '').toLowerCase();
  const text = `${m.id} ${m.title} ${m.description || ''} ${explicit}`.toLowerCase();
  if (/\b(map|maps|karte|karten|region|landscape|landkreis)\b/.test(text) || /\bmap\b/.test(explicit)) return 'maps';
  if (/\b(tractor|tractors|traktor|traktoren|schlepper)\b/.test(text) || /\b(tractors|tractor)\b/.test(explicit) || /\b(fendt|john deere|deutz fahr|new holland|case ih|massey ferguson|valtra|steyr|zetor|ursus)\b/.test(text)) return 'tractors';
  if (/\b(implement|implements|anbaugerät|anbaugeraet|anbaugeräte|anbaugeraete|pflugs?|plows?|grubber|cultivators?|sämaschinen?|seeders?|sprayers?|spritzen?|mowers?|mäher|harrows?|eggen|balers?|pressen?|trailers?|anhänger|anhaenger)\b/.test(text) || /\b(implements|tools)\b/.test(explicit)) return 'implements';
  return 'other';
}

function conflictFor(id) {
  return M.conflictMap[id] || [];
}

function problems(m) {
  const errs = m.errors.filter((e) => e.sev === 'error');
  const warns = m.errors.filter((e) => e.sev === 'warn');
  const infos = m.errors.filter((e) => e.sev === 'info');
  const cf = conflictFor(m.id);
  return {
    errs, warns, infos, cf,
    errCount: errs.length + (m.logErrors || 0),
    warnCount: warns.length + (m.logWarnings || 0) + cf.length
  };
}

function hubChip(m) {
  const h = M.hub[m.id];
  if (!h) return '';
  if (h.status === 'update') return `<span class="chip warn" title="Neueste ModHub-Version: ${esc(h.latest)}"><i></i>Update ${esc(h.latest)}</span>`;
  if (h.status === 'current') return '<span class="chip ok"><i></i>ModHub aktuell</span>';
  if (h.status === 'notfound') return '<span class="chip mute" title="Nicht im offiziellen ModHub gefunden"><i></i>Nicht im ModHub</span>';
  return `<span class="chip mute" title="${esc(h.note || '')}"><i></i>ModHub ?</span>`;
}

function modCard(m) {
  const p = problems(m);
  let note;
  if (p.errCount) {
    const first = p.errs[0] ? p.errs[0].text : `${m.logErrors} Fehler im Spiel-Log`;
    note = `<div class="mod-note err">${I.eye.replace('<svg', '<svg width="14" height="14" style="flex:none;margin-top:2px;fill:none;stroke:currentColor;stroke-width:2"')}<span>${esc(first)}</span></div>`;
  } else if (p.warnCount) {
    const first = p.warns[0] ? p.warns[0].text : p.cf[0] ? p.cf[0] : `${m.logWarnings} Warnungen im Spiel-Log`;
    note = `<div class="mod-note warn"><span>${esc(first)}</span></div>`;
  } else {
    note = '<div class="mod-note ok"><span>Keine Probleme erkannt</span></div>';
  }
  return `<div class="card mod ${m.enabled ? '' : 'off'} ${p.errCount ? 'has-error' : ''}" data-open="${esc(m.file)}">
    <div class="mod-top">
      ${iconEl(m)}
      <div class="mod-meta">
        <div class="mod-title" title="${esc(m.title)}">${esc(m.title)}</div>
        <div class="mod-by">${m.author ? 'von ' + esc(m.author) : 'Modder unbekannt'}</div>
        <div class="mod-file" title="${esc(m.file)}">${esc(m.file)}</div>
      </div>
    </div>
    <div class="mod-badges">
      <span class="chip v-chip">${m.version ? 'v' + esc(m.version) : 'Version ?'}</span>
      ${m.enabled ? '' : '<span class="chip mute"><i></i>Deaktiviert</span>'}
      ${p.errCount ? `<span class="chip bad"><i></i>${p.errCount} Fehler</span>` : ''}
      ${p.warnCount ? `<span class="chip warn"><i></i>${p.warnCount} Warnung${p.warnCount > 1 ? 'en' : ''}</span>` : ''}
      ${m.multiplayer === false ? '<span class="chip info"><i></i>Nur Singleplayer</span>' : ''}
      ${hubChip(m)}
    </div>
    ${note}
    <div class="mod-foot">
      <span>${fmtSize(m.size)} · ${new Date(m.mtime).toLocaleDateString('de-DE')}</span>
      <span class="acts" data-stop><span>${m.enabled ? 'Aktiv' : 'Aus'}</span>
        <label class="switch" title="${m.enabled ? 'Deaktivieren (.bak)' : 'Aktivieren'}"><input type="checkbox" data-toggle="${esc(m.file)}" ${m.enabled ? 'checked' : ''}><span></span></label></span>
    </div>
  </div>`;
}

function filteredMods() {
  const q = M.q.trim().toLowerCase();
  let list = M.items.filter((m) => !q || (m.title + ' ' + m.id + ' ' + m.author).toLowerCase().includes(q));
  if (M.type !== 'all') list = list.filter((m) => modType(m) === M.type);
  list = list.filter((m) => {
    const p = problems(m);
    switch (M.filter) {
      case 'on': return m.enabled;
      case 'off': return !m.enabled;
      case 'err': return p.errCount > 0;
      case 'warn': return p.warnCount > 0;
      case 'update': return M.hub[m.id] && M.hub[m.id].status === 'update';
      case 'conflict': return p.cf.length > 0;
      default: return true;
    }
  });
  const issueCounts = new Map(list.map((m) => [m, problems(m)]));
  const by = {
    name: (a, b) => a.title.localeCompare(b.title, 'de', { sensitivity: 'base' }),
    author: (a, b) => (a.author || '~').localeCompare(b.author || '~', 'de', { sensitivity: 'base' }) || by.name(a, b),
    size: (a, b) => b.size - a.size,
    date: (a, b) => b.mtime - a.mtime,
    errors: (a, b) => issueCounts.get(b).errCount - issueCounts.get(a).errCount || issueCounts.get(b).warnCount - issueCounts.get(a).warnCount || by.name(a, b)
  };
  return list.sort(by[M.sort] || by.name);
}

function modDetails(file) {
  const m = M.items.find((x) => x.file === file);
  if (!m) return;
  const p = problems(m);
  const h = M.hub[m.id];
  const issues = [
    ...p.errs.map((e) => ({ s: 'bad', t: e.text })),
    ...(m.logErrors ? [{ s: 'bad', t: `${m.logErrors}× Fehler im Spiel-Log (siehe Log-Analyse)` }] : []),
    ...p.warns.map((e) => ({ s: 'warn', t: e.text })),
    ...(m.logWarnings ? [{ s: 'warn', t: `${m.logWarnings}× Warnung im Spiel-Log` }] : []),
    ...p.cf.map((t) => ({ s: 'warn', t })),
    ...(h && h.status === 'update' ? [{ s: 'warn', t: `Neue Version im ModHub: ${h.latest} (installiert: ${m.version || 'unbekannt'})` }] : []),
    ...p.infos.map((e) => ({ s: 'info', t: e.text }))
  ];
  const md = openModal(
    `<div class="d-head">${iconEl(m, 'mod-icon big')}<div><h2>${esc(m.title)}</h2>
        <div class="mod-by">${m.author ? 'von ' + esc(m.author) : 'Modder unbekannt'}</div>
        <div class="mod-badges" style="margin-top:8px"><span class="chip">${m.version ? 'v' + esc(m.version) : 'Version ?'}</span>${m.enabled ? '<span class="chip ok"><i></i>Aktiv</span>' : '<span class="chip mute"><i></i>Deaktiviert</span>'}${hubChip(m)}</div></div></div>
     <div class="kv2">
       <div><small>Dateiname</small><span class="mono">${esc(m.file)}</span></div>
       <div><small>Mod-ID</small><span class="mono">${esc(m.id)}</span></div>
       <div><small>Größe</small><span>${fmtSize(m.size)}</span></div>
       <div><small>Geändert</small><span>${fmtDate(m.mtime)}</span></div>
       <div><small>Typ</small><span>${m.kind === 'folder' ? 'Entpackter Ordner' : 'ZIP-Archiv'}</span></div>
       <div><small>Multiplayer</small><span>${m.multiplayer === null ? 'keine Angabe' : m.multiplayer ? 'Unterstützt' : 'Nicht unterstützt'}</span></div>
       <div><small>descVersion</small><span>${m.descVersion || '–'}</span></div>
       <div><small>ModHub</small><span>${h ? (h.url ? `<a data-ext="${esc(h.url)}">${h.status === 'update' ? 'Update ' + esc(h.latest) : h.status === 'current' ? 'Aktuell' : 'Ansehen'}</a>` : esc(h.note || h.status)) : 'nicht geprüft'}</span></div>
     </div>
     ${m.description ? `<div class="sec-title">Beschreibung</div><div class="desc-box">${esc(m.description)}</div>` : ''}
     <div class="sec-title">Fehler &amp; Hinweise</div>
     ${issues.length ? issues.map((i) => `<div class="issue"><i class="dot ${i.s === 'bad' ? 'bad' : i.s}"></i><span>${esc(i.t)}</span></div>`).join('') : '<div class="issue"><i class="dot ok"></i><span>Keine Probleme erkannt.</span></div>'}
     <div class="modal-actions" style="margin-top:18px">
       <button class="btn danger" data-trash>${I.trash}Papierkorb</button>
       <button class="btn" data-reveal>${I.folder}Im Explorer zeigen</button>
       <button class="btn" data-toggle-d>${m.enabled ? 'Deaktivieren' : 'Aktivieren'}</button>
       <button class="btn primary" data-close>Schließen</button>
     </div>`,
    true
  );
  md.el.querySelector('[data-close]').onclick = md.close;
  const detailPlaceholder = md.el.querySelector('[data-icon-file]');
  if (detailPlaceholder) requestModIcon(m.file).then((src) => {
    if (!src || !detailPlaceholder.isConnected) return;
    m.icon = src;
    const image = document.createElement('img'); image.className = detailPlaceholder.className.replace(/\sph\b/, ''); image.src = src; image.alt = '';
    detailPlaceholder.replaceWith(image);
  });
  md.el.querySelector('[data-reveal]').onclick = () => api.mods.reveal(m.file);
  md.el.querySelector('[data-toggle-d]').onclick = async () => {
    md.close();
    await toggleMod(m.file);
  };
  md.el.querySelector('[data-trash]').onclick = async () => {
    if (!(await confirmDialog('Mod entfernen?', `„${m.title}“ wird in den Papierkorb verschoben.`, 'In den Papierkorb', true))) return;
    const r = await api.mods.trash(m.file);
    if (r.ok) {
      md.close();
      toast('Mod in den Papierkorb verschoben.');
      loadMods();
    } else toast(r.error, true);
  };
}

async function toggleMod(file) {
  const r = await api.mods.toggle(file);
  if (r.ok) toast(r.enabled ? 'Mod aktiviert.' : 'Mod deaktiviert (.bak) – Datei bleibt erhalten.');
  else toast(r.error, true);
  await loadMods();
}

function buildConflictMap() {
  M.conflictMap = {};
  if (!M.conflicts) return;
  const add = (id, t) => (M.conflictMap[id] = M.conflictMap[id] || []).push(t);
  const title = (id) => (M.items.find((x) => x.id === id) || { title: id }).title;
  for (const c of M.conflicts.conflicts) {
    for (const mod of c.mods) {
      const others = c.mods.filter((x) => x.id !== mod.id).map((x) => title(x.id));
      add(mod.id, `Überschreibt „${c.target}“ – genau wie ${others.join(', ')}`);
    }
  }
  for (const d of M.conflicts.duplicates) {
    for (const mod of d.mods) add(mod.id, `Mehrfach installiert („${d.title}“): ${d.mods.map((x) => x.id).join(', ')}`);
  }
}

function drawSummary() {
  const el = document.getElementById('m-chips');
  if (!el) return;
  const all = M.items.length;
  const on = M.items.filter((m) => m.enabled).length;
  const err = M.items.filter((m) => problems(m).errCount).length;
  const warn = M.items.filter((m) => !problems(m).errCount && problems(m).warnCount).length;
  const upd = M.items.filter((m) => M.hub[m.id] && M.hub[m.id].status === 'update').length;
  const totalSize = M.items.reduce((a, b) => a + b.size, 0);
  const oversized = M.items.filter((m) => m.size > 512 * 1024 * 1024).length;
  el.innerHTML = `<span class="chip"><i></i>${all} Mods</span><span class="chip ok"><i></i>${on} aktiv</span>${all - on ? `<span class="chip mute"><i></i>${all - on} deaktiviert</span>` : ''}
    ${err ? `<span class="chip bad"><i></i>${err} mit Fehlern</span>` : ''}${warn ? `<span class="chip warn"><i></i>${warn} mit Warnungen</span>` : ''}${upd ? `<span class="chip warn"><i></i>${upd} Update${upd > 1 ? 's' : ''}</span>` : ''}
    <span class="chip ${totalSize > 20 * 1024 * 1024 * 1024 || oversized ? 'warn' : ''}" title="${oversized} Datei(en) größer als 512 MB">${fmtSize(totalSize)} Mods gesamt${oversized ? ` · ${oversized} sehr groß` : ''}</span>`;
}

function drawGrid() {
  const el = document.getElementById('m-grid');
  if (!el) return;
  const list = filteredMods();
  const visible = list.slice(0, M.limit);
  el.innerHTML = list.length
    ? `<div class="mod-grid">${visible.map(modCard).join('')}</div><div class="mod-paging"><span class="note">${visible.length} von ${list.length} Mods angezeigt</span>${visible.length < list.length ? '<button class="btn" id="m-more">Mehr Mods laden</button>' : ''}</div>`
    : `<div class="card">${emptyBox('Keine Mods gefunden', M.q || M.filter !== 'all' ? 'Keine Treffer für Suche/Filter.' : 'Der Mod-Ordner ist leer. Ziehe .zip-Dateien in dieses Fenster, um Mods zu installieren.')}</div>`;
  el.querySelector('#m-more')?.addEventListener('click', () => { M.limit += 80; drawGrid(); });
  el.querySelectorAll('[data-open]').forEach((c) => {
    c.onclick = (e) => {
      if (e.target.closest('[data-stop]')) return;
      modDetails(c.dataset.open);
    };
  });
  el.querySelectorAll('[data-toggle]').forEach((cb) => {
    cb.onchange = () => toggleMod(cb.dataset.toggle);
  });
  loadModIcons(document);
}

function drawConflicts() {
  const el = document.getElementById('m-conflicts');
  if (!el) return;
  const c = M.conflicts;
  if (!c) {
    el.innerHTML = '';
    return;
  }
  const title = (id) => (M.items.find((x) => x.id === id) || { title: id }).title;
  const chip = (id) => `<button class="chip" data-chip="${esc(id)}">${esc(title(id))}</button>`;
  const n = c.conflicts.length + c.duplicates.length;
  el.innerHTML = `<div class="card" style="margin-bottom:16px">
    <h2>Konflikt-Check · ${n ? n + ' Hinweis' + (n > 1 ? 'e' : '') : 'keine Konflikte'}</h2>
    ${c.conflicts.map((x) => `<div class="conflict"><b>Mehrere Mods überschreiben <span class="mono">${esc(x.target)}</span></b>
        <p>Beide Skripte ersetzen dieselbe Spielfunktion. Das funktioniert oft, kann aber zu Fehlern führen. Treten Probleme auf, einen der Mods deaktivieren.</p>
        <div class="mod-badges">${x.mods.map((mm) => chip(mm.id)).join('')}</div></div>`).join('')}
    ${c.duplicates.map((x) => `<div class="conflict"><b>„${esc(x.title)}“ ist mehrfach aktiv</b>
        <p>Vermutlich liegen zwei Versionen desselben Mods im Ordner. Nur eine sollte aktiv sein.</p>
        <div class="mod-badges">${x.mods.map((mm) => chip(mm.id)).join('')}</div></div>`).join('')}
    ${n ? '' : '<p style="color:var(--text-2)">Keine überschneidenden Skript-Funktionen und keine doppelten Mods gefunden.</p>'}
    <p class="note" style="margin-top:6px">${c.scanned} aktive Mods und ${c.scripts} Skriptdateien geprüft. Der Check erkennt nur Skript-Überschneidungen (Utils.overwrittenFunction) und doppelte Mods, keine Inhaltskonflikte.</p></div>`;
  el.querySelectorAll('[data-chip]').forEach((b) => {
    b.onclick = () => {
      const m = M.items.find((x) => x.id === b.dataset.chip);
      if (m) modDetails(m.file);
    };
  });
}

function updateHubUI() {
  const el = document.getElementById('m-hub');
  if (!el) return;
  if (!M.hubRun) {
    el.innerHTML = '';
    return;
  }
  const pct = M.hubRun.total ? Math.round((M.hubRun.done / M.hubRun.total) * 100) : 0;
  el.innerHTML = `<div class="card" style="margin-bottom:16px;padding:14px 18px"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><b>ModHub-Abgleich läuft …</b><span class="chip">${M.hubRun.done} / ${M.hubRun.total}</span></div><div class="progress"><i style="width:${pct}%"></i></div></div>`;
}

async function runHub() {
  if (M.hubRun) return;
  const todo = M.items.filter((m) => m.title && m.title !== m.id);
  if (!todo.length) return toast('Keine Mods mit Titel zum Abgleichen.', true);
  M.hubRun = { done: 0, total: todo.length };
  updateHubUI();
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const m = todo[i++];
      try {
        M.hub[m.id] = await api.mods.modhub({ title: m.title, version: m.version });
      } catch {
        M.hub[m.id] = { status: 'unknown', note: 'Fehler beim Abruf' };
      }
      M.hubRun.done++;
      if (M.hubRun.done % 4 === 0) updateHubUI();
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  M.hubRun = null;
  updateHubUI();
  drawSummary();
  drawGrid();
  const upd = Object.values(M.hub).filter((h) => h.status === 'update').length;
  const unk = Object.values(M.hub).filter((h) => h.status === 'unknown').length;
  if (unk === todo.length) toast('ModHub konnte nicht ausgewertet werden (Seitenformat/Verbindung). Der Abgleich ist experimentell.', true);
  else toast(upd ? `${upd} Mod${upd > 1 ? 's' : ''} mit verfügbarem Update.` : 'Keine Updates im ModHub gefunden.');
}

async function loadMods() {
  const scroll = document.querySelector('.content').scrollTop;
  const r = await api.mods.list();
  M.items = r.items || [];
  M.dir = r.dir;
  M.source = r.source;
  M.file = r.settingsFile;
  M.ok = r.ok;
  M.error = r.error;
  if (M.conflicts) buildConflictMap();
  if (page === 'mods') {
    drawBanner();
    drawSummary();
    drawConflicts();
    drawGrid();
    document.querySelector('.content').scrollTop = scroll;
  }
}

function drawBanner() {
  const el = document.getElementById('m-banner');
  if (!el) return;
  el.innerHTML = `${I.folder}<div class="grow"><small>Mod-Ordner · ${esc(sourceLabel(M.source))}</small><span class="path">${esc(M.dir)}</span></div>
    ${M.ok ? '' : `<span class="chip bad"><i></i>${esc(M.error || 'nicht gefunden')}</span>`}`;
}

let syncPeer = null, syncConn = null, syncRemote = [], syncLocal = [], syncBusy = false, syncQueue = [];
let syncProgressOff = null;
function setupP2PSync() {
  const status = document.getElementById('sync-status'), compare = document.getElementById('sync-compare');
  const setStatus = (s) => { if (status) status.textContent = s; };
  const setProgress = (n) => { const bar = document.getElementById('sync-progress'); if (bar) bar.style.width = `${Math.max(0, Math.min(100, n))}%`; };
  if (syncProgressOff) syncProgressOff();
  syncProgressOff = api.sync.onProgress((p) => {
    if (p.complete) { setProgress(100); setStatus(`SHA-256-Vergleich abgeschlossen · ${p.total} Mods`); return; }
    setStatus(`SHA-256 ${p.done}/${p.total} Mods · ${fmtSize(p.bytesDone)} / ${fmtSize(p.totalBytes)}${p.name ? ` · ${p.name}` : ''}`);
    setProgress(p.totalBytes ? p.bytesDone / p.totalBytes * 100 : 0);
  });
  const connect = (conn, hosting) => {
    syncConn = conn;
    conn.on('open', async () => {
      setStatus('Verbunden · vergleiche SHA-256 …');
      const local = await api.sync.manifest();
      syncLocal = local.items;
      conn.send({ type: 'manifest', items: local.items });
      if (hosting) setStatus('Sitzung bereit · Raumcode: ' + syncPeer.id.replace(/^ANX/i, ''));
    });
    conn.on('data', async (msg) => {
      try {
        if (msg.type === 'manifest') {
          syncRemote = msg.items || [];
          const local = await api.sync.manifest(), map = new Map(local.items.map((x) => [x.name.toLowerCase(), x]));
          const missing = syncRemote.filter((x) => !map.has(x.name.toLowerCase()) || map.get(x.name.toLowerCase()).sha256 !== x.sha256);
          compare.innerHTML = `<div class="toolbar"><p>${missing.length} fehlende oder abweichende ZIP-Mods · ${syncRemote.length} im Peer-Ordner</p>${missing.length ? '<button class="btn primary" id="sync-all">Alle fehlenden Mods synchronisieren</button>' : ''}</div>${missing.map((x) => `<div class="status-row"><span class="grow">${esc(x.name)} · ${fmtSize(x.size)}</span><button class="btn sm" data-sync-file="${esc(x.name)}">Nur diese Mod</button></div>`).join('') || '<p>Alle ZIP-Mods stimmen überein.</p>'}`;
          const beginQueue = (names) => { syncQueue = names.slice(); setProgress(0); if (syncQueue.length) { const name = syncQueue.shift(); conn.send({ type: 'request', name }); setStatus(`Fordere ${name} an …`); } };
          compare.querySelector('#sync-all')?.addEventListener('click', () => beginQueue(missing.map((x) => x.name)));
          compare.querySelectorAll('[data-sync-file]').forEach((b) => b.onclick = () => beginQueue([b.dataset.syncFile]));
          setStatus('Vergleich abgeschlossen.');
        } else if (msg.type === 'request') {
          const meta = syncLocal.find((x) => x.name === msg.name); if (!meta) return;
          conn.send({ type: 'file-start', name: meta.name, size: meta.size });
          for (let offset = 0; offset < meta.size; offset += 48 * 1024) {
            const data = await api.sync.read(meta.name, offset, Math.min(48 * 1024, meta.size - offset));
            conn.send({ type: 'file-chunk', data, sent: Math.min(meta.size, offset + 48 * 1024), size: meta.size });
            setProgress((offset + 48 * 1024) / meta.size * 100); setStatus(`Sende ${meta.name}: ${Math.min(100, Math.round((offset + 48 * 1024) / meta.size * 100))}%`);
            while (conn.dataChannel && conn.dataChannel.bufferedAmount > 1024 * 1024) await new Promise((r) => setTimeout(r, 50));
          }
          conn.send({ type: 'file-end' }); setStatus('Datei gesendet.');
        } else if (msg.type === 'profile-request') {
          const pkg = await api.sync.profile();
          conn.send({ type: 'profile-start', name: pkg.name, size: pkg.size, token: pkg.token });
          for (let offset = 0; offset < pkg.size; offset += 48 * 1024) {
            const data = await api.sync.read('profile:' + pkg.token, offset, Math.min(48 * 1024, pkg.size - offset));
            conn.send({ type: 'profile-chunk', data });
            setProgress((offset + 48 * 1024) / pkg.size * 100); setStatus(`Sende Profil: ${Math.min(100, Math.round((offset + 48 * 1024) / pkg.size * 100))}%`);
            while (conn.dataChannel && conn.dataChannel.bufferedAmount > 1024 * 1024) await new Promise((r) => setTimeout(r, 50));
          }
          conn.send({ type: 'profile-end' });
        } else if (msg.type === 'profile-start') {
          syncBusy = true; window._syncToken = await api.sync.begin(msg.name, msg.size); window._syncName = msg.name; window._syncSize = msg.size; window._syncReceived = 0;
        } else if (msg.type === 'profile-chunk') {
          window._syncReceived = await api.sync.chunk(window._syncToken, msg.data);
          setProgress(window._syncReceived / window._syncSize * 100);
          setStatus(`Empfange Profil: ${Math.min(100, Math.round(window._syncReceived / window._syncSize * 100))}%`);
        } else if (msg.type === 'profile-end') {
          const result = await api.sync.finish(window._syncToken); syncBusy = false;
          if (result.ok && result.profile) cfg = await api.config.get();
          setStatus(result.ok ? `Profil empfangen: ${result.file}` : result.error); if (result.ok) await loadMods();
        } else if (msg.type === 'file-start') {
          syncBusy = true; window._syncToken = await api.sync.begin(msg.name, msg.size); window._syncName = msg.name; window._syncSize = msg.size; window._syncReceived = 0;
        } else if (msg.type === 'file-chunk') {
          window._syncReceived = await api.sync.chunk(window._syncToken, msg.data);
          setProgress(window._syncReceived / window._syncSize * 100);
          setStatus(`Empfange ${window._syncName}: ${Math.min(100, Math.round(window._syncReceived / window._syncSize * 100))}%`);
        } else if (msg.type === 'file-end') {
          const result = await api.sync.finish(window._syncToken); syncBusy = false;
          if (!result.ok) { syncQueue = []; setStatus(result.error); }
          else if (syncQueue.length) { const name = syncQueue.shift(); conn.send({ type: 'request', name }); setStatus(`Empfangen: ${result.file} · fordere ${name} an …`); }
          else { setStatus(`Synchronisierung abgeschlossen: ${result.file}`); await loadMods(); }
        }
      } catch (err) { syncBusy = false; setStatus('Sync-Fehler: ' + err.message); }
    });
    conn.on('close', () => setStatus('Verbindung geschlossen.'));
    conn.on('error', (e) => setStatus('Verbindungsfehler: ' + e.message));
  };
  document.getElementById('sync-host').onclick = () => {
    if (typeof Peer === 'undefined') return setStatus('PeerJS konnte nicht geladen werden.');
    const code = Math.random().toString(36).slice(2, 8).toUpperCase(); syncPeer = new Peer('ANX' + code); setStatus('Erstelle Sitzung …');
    syncPeer.on('open', () => { document.getElementById('sync-code').value = code; setStatus('Raumcode: ' + code + ' · warte auf Peer'); });
    syncPeer.on('connection', (c) => connect(c, true)); syncPeer.on('error', (e) => setStatus('PeerJS: ' + e.type));
  };
  document.getElementById('sync-join').onclick = () => {
    if (typeof Peer === 'undefined') return setStatus('PeerJS konnte nicht geladen werden.');
    const code = document.getElementById('sync-code').value.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (code.length !== 6) return setStatus('Bitte einen sechsstelligen Raumcode eingeben.');
    syncPeer = new Peer(); setStatus('Verbinde …'); syncPeer.on('open', () => connect(syncPeer.connect('ANX' + code, { reliable: true }))); syncPeer.on('error', (e) => setStatus('PeerJS: ' + e.type));
  };
  document.getElementById('sync-profile').onclick = () => {
    if (!syncConn || !syncConn.open) return setStatus('Erst einer aktiven Sync-Sitzung beitreten.');
    syncConn.send({ type: 'profile-request' }); setStatus('Profilpaket wird vorbereitet …');
  };
}

pages.mods = {
  title: 'Mods & Assets',
  icon: I.mods,
  async render() {
    view.innerHTML =
      head(
        'Mods & Assets',
        'Alle Mods mit Version, Modder, Icon und Fehlern auf einen Blick.',
        `<button class="btn" id="m-conf">${I.shield}Konflikte prüfen</button><button class="btn" id="m-hubbtn">${I.cloud}ModHub prüfen</button><button class="btn" id="m-open">${I.folder}Ordner</button><button class="btn" id="m-ref">${I.refresh}</button>`
      ) +
      `<div class="banner" id="m-banner"></div>
       <div class="card" style="margin-bottom:16px"><h2>P2P Mod- &amp; Profil-Sync</h2><p class="note" style="margin:4px 0 12px">ZIP-Mods abgleichen oder das aktive Profil mit aktivem Mod-Set und zugeordnetem Savegame direkt übertragen. WebRTC wird über PeerJS vermittelt.</p><div class="toolbar"><button class="btn primary" id="sync-host">Host Sync Session</button><input class="input mono" id="sync-code" placeholder="Raumcode"><button class="btn" id="sync-join">Join Sync Session</button><button class="btn" id="sync-profile">Profil senden</button><span id="sync-status" class="note" style="margin:0"></span></div><div class="progress"><i id="sync-progress" style="width:0%"></i></div><div id="sync-compare"></div></div>
       <div id="m-hub"></div><div id="m-conflicts"></div>
       <div class="chips" id="m-chips"></div>
       <div class="toolbar">
         <input class="input" id="m-search" placeholder="Mods durchsuchen …" value="${esc(M.q)}">
         <select class="input" id="m-type"><option value="all">Alle Typen</option><option value="maps">Maps</option><option value="tractors">Traktoren</option><option value="implements">Anbaugeräte</option><option value="other">Sonstige</option></select>
         <select class="input" id="m-filter">
           <option value="all">Alle</option><option value="on">Aktiv</option><option value="off">Deaktiviert</option>
           <option value="err">Mit Fehlern</option><option value="warn">Mit Warnungen</option><option value="update">Update verfügbar</option><option value="conflict">Mit Konflikten</option></select>
         <select class="input" id="m-sort">
           <option value="name">Sortiert nach Name</option><option value="author">nach Modder</option><option value="errors">Meiste Fehler zuerst</option><option value="size">nach Größe</option><option value="date">nach Datum</option></select>
         <span class="grow"></span><span class="note" style="margin:0">Tipp: .zip-Dateien einfach ins Fenster ziehen</span>
       </div>
       <div id="m-grid"><div class="card"><span class="spin"></span></div></div>`;

    document.getElementById('m-filter').value = M.filter;
    document.getElementById('m-type').value = M.type;
    document.getElementById('m-sort').value = M.sort;
    document.getElementById('m-search').oninput = (e) => ((M.q = e.target.value), (M.limit = 80), drawGrid());
    document.getElementById('m-type').onchange = (e) => ((M.type = e.target.value), (M.limit = 80), drawGrid());
    document.getElementById('m-filter').onchange = (e) => ((M.filter = e.target.value), (M.limit = 80), drawGrid());
    document.getElementById('m-sort').onchange = (e) => ((M.sort = e.target.value), (M.limit = 80), drawGrid());
    document.getElementById('m-open').onclick = async () => {
      const o = await api.openFolder('mods');
      if (!o.ok) toast(o.error, true);
    };
    document.getElementById('m-ref').onclick = () => loadMods();
    setupP2PSync();
    document.getElementById('m-hubbtn').onclick = () => runHub();
    document.getElementById('m-conf').onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const r = await api.mods.conflicts();
      btn.disabled = false;
      if (!r.ok) return toast(r.error, true);
      M.conflicts = r;
      buildConflictMap();
      drawConflicts();
      drawSummary();
      drawGrid();
    };
    drawBanner();
    updateHubUI();
    drawConflicts();
    await loadMods();
  }
};

// --- Drag-&-Drop-Installer -----------------------------------------------------

async function installFiles(paths) {
  const res = await api.mods.install(paths, []);
  if (!res.ok) return toast(res.error, true);
  let results = res.results;
  const exists = results.filter((r) => r.exists);
  if (exists.length) {
    const yes = await confirmDialog('Mod ersetzen?', `${exists.map((e) => e.name).join(', ')} ${exists.length > 1 ? 'sind' : 'ist'} bereits installiert. Vorhandene Version ersetzen?`, 'Ersetzen');
    results = results.filter((r) => !r.exists);
    if (yes) {
      const r2 = await api.mods.install(exists.map((e) => e.path), exists.map((e) => e.name));
      results = results.concat(r2.results || []);
    }
  }
  const ok = results.filter((r) => r.ok);
  const bad = results.filter((r) => !r.ok && !r.exists);
  if (ok.length) toast(`${ok.length} Mod${ok.length > 1 ? 's' : ''} installiert${ok.some((r) => r.renamed) ? ' (Dateiname bereinigt)' : ''}.`);
  bad.slice(0, 3).forEach((r) => toast(`${r.src}: ${r.error}`, true));
  if (page === 'mods') loadMods();
}

(function setupDrop() {
  const overlay = document.getElementById('drop-overlay');
  let depth = 0;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  document.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    overlay.hidden = false;
  });
  document.addEventListener('dragover', (e) => {
    if (hasFiles(e)) e.preventDefault();
  });
  document.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (!depth) overlay.hidden = true;
  });
  document.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    overlay.hidden = true;
    const paths = Array.from(e.dataTransfer.files).map((f) => api.pathFor(f)).filter(Boolean);
    if (paths.length) installFiles(paths);
  });
})();

// ---------------------------------------------------------------------------
// Saves & Backups
// ---------------------------------------------------------------------------

const KIND = { manual: ['Manuell', ''], auto: ['Auto', 'ok'], safety: ['Sicherheitskopie', 'info'] };

pages.saves = {
  title: 'Saves & Backups',
  icon: I.save,
  async render() {
    const [saves, backups] = await Promise.all([api.saves.list(), api.backups.list()]);
    const assigned = activeProfile().savegame;
    const slots = Array.from(new Set(backups.items.map((b) => b.slot).filter(Boolean)));
    const filterSlot = pages.saves.slot || '';

    view.innerHTML =
      head('Saves & Backups', 'Spielstände sichern und mit einem Klick wiederherstellen.', `<button class="btn" id="b-open">${I.folder}Backup-Ordner</button><button class="btn" id="b-ref">${I.refresh}</button>`) +
      `<div class="stack">
        <div class="card"><div class="setting" style="padding:0;border:0"><div><b>Automatisches Backup vor jedem Start</b><small>Sichert ${assigned ? esc(assigned) + ' (Profil-Zuordnung)' : 'alle Spielstände'} beim Klick auf „Starten“. Es werden die letzten ${cfg.autoBackupKeep} Auto-Backups pro Slot behalten.</small></div>
          <label class="switch"><input type="checkbox" id="b-auto" ${cfg.autoBackup ? 'checked' : ''}><span></span></label></div></div>
        <div class="card"><h2>Spielstände</h2>${
          !saves.ok
            ? emptyBox('Profil-Ordner nicht gefunden', 'Prüfe den Pfad in den Einstellungen.')
            : saves.items.length
            ? `<table class="table"><thead><tr><th>Slot</th><th>Name / Karte</th><th>Spielzeit</th><th class="num">Größe</th><th></th></tr></thead><tbody>
                ${saves.items
                  .map(
                    (s) => `<tr><td><span class="tag ${s.slot === assigned ? 'zip' : ''}">${esc(s.slot.replace('savegame', 'SLOT '))}</span></td>
                    <td><b>${esc(s.name)}</b>${s.map ? `<div style="color:var(--text-3);font-size:12.5px">${esc(s.map)}${s.saveDate ? ' · ' + esc(s.saveDate) : ''}</div>` : ''}</td>
                    <td>${s.playTime ? fmtHours(s.playTime) : '–'}</td><td class="num">${fmtSize(s.size)}</td>
                    <td class="act"><button class="btn sm primary" data-bk="${esc(s.slot)}">${I.save}Backup erstellen</button></td></tr>`
                  )
                  .join('')}</tbody></table>`
            : emptyBox('Keine Spielstände', 'Es wurden keine savegame-Ordner gefunden.')
        }</div>
        <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h2 style="margin:0">Backups · ${backups.items.length}</h2>
          ${slots.length > 1 ? `<select class="input" id="b-slot" style="width:auto"><option value="">Alle Slots</option>${slots.map((s) => `<option value="${esc(s)}" ${s === filterSlot ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>` : ''}</div>${
          backups.items.length
            ? `<table class="table"><thead><tr><th>Datum &amp; Uhrzeit</th><th>Slot</th><th>Art</th><th class="num">Größe</th><th></th></tr></thead><tbody>
                ${backups.items
                  .filter((b) => !filterSlot || b.slot === filterSlot)
                  .map(
                    (b) => `<tr><td><b>${fmtDay(b.when)}</b><div style="color:var(--text-3);font-size:12.5px">${new Date(b.when).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</div></td>
                    <td><span class="tag">${esc((b.slot || '?').replace('savegame', 'SLOT '))}</span></td>
                    <td><span class="chip ${KIND[b.kind][1]}">${KIND[b.kind][0]}</span></td><td class="num">${fmtSize(b.size)}</td>
                    <td class="act"><button class="btn sm primary" data-rs="${esc(b.file)}">${I.restore}Wiederherstellen</button><button class="btn sm danger" data-rm="${esc(b.file)}">${I.trash}</button></td></tr>`
                  )
                  .join('')}</tbody></table>`
            : emptyBox('Noch keine Backups', 'Erstelle oben dein erstes Backup oder aktiviere das Auto-Backup.')
        }</div>
      </div>
      <p class="note mono">${esc(backups.dir || '')}</p>`;

    document.getElementById('b-open').onclick = async () => {
      const o = await api.openFolder('backups');
      if (!o.ok) toast(o.error, true);
    };
    document.getElementById('b-ref').onclick = () => pages.saves.render();
    document.getElementById('b-auto').onchange = async (e) => {
      cfg.autoBackup = e.target.checked;
      await persist();
      toast(cfg.autoBackup ? 'Auto-Backup vor dem Start aktiviert.' : 'Auto-Backup deaktiviert.');
    };
    const sl = document.getElementById('b-slot');
    if (sl) sl.onchange = () => ((pages.saves.slot = sl.value), pages.saves.render());
    view.querySelectorAll('[data-bk]').forEach((b) => {
      b.onclick = async () => {
        b.disabled = true;
        const r = await api.backups.create(b.dataset.bk);
        if (r.ok) toast('Backup erstellt: ' + r.file);
        else toast(r.error, true);
        pages.saves.render();
      };
    });
    view.querySelectorAll('[data-rs]').forEach((b) => {
      b.onclick = async () => {
        const item = backups.items.find((x) => x.file === b.dataset.rs);
        if (!(await confirmDialog('Diesen Stand wiederherstellen?', `${fmtDate(item.when)} · ${item.slot}. Der aktuelle Stand wird vorher automatisch als Sicherheitskopie gesichert. Das Spiel muss beendet sein.`, 'Wiederherstellen'))) return;
        b.disabled = true;
        const r = await api.backups.restore(b.dataset.rs);
        if (r.ok) toast('Spielstand ' + r.slot + ' wiederhergestellt.');
        else toast(r.error, true);
        pages.saves.render();
      };
    });
    view.querySelectorAll('[data-rm]').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmDialog('Backup löschen?', `„${b.dataset.rm}“ wird in den Papierkorb verschoben.`, 'Löschen', true))) return;
        const r = await api.backups.remove(b.dataset.rm);
        if (r.ok) toast('Backup gelöscht.');
        else toast(r.error, true);
        pages.saves.render();
      };
    });
  }
};

// ---------------------------------------------------------------------------
// Log-Analyse
// ---------------------------------------------------------------------------

const L = { sig: '', data: null, filter: 'all', q: '', mod: '', live: false, open: new Set() };

function drawLogList() {
  const el = document.getElementById('l-list');
  if (!el || !L.data || !L.data.ok) return;
  const q = L.q.trim().toLowerCase();
  const list = L.data.entries
    .filter((e) => (L.filter === 'all' || (L.filter === 'error' ? e.sev === 'error' : e.sev === 'warn')) && (!L.mod || e.mod.toLowerCase() === L.mod) && (!q || (e.text + ' ' + e.raw + ' ' + e.mod).toLowerCase().includes(q)))
    .sort((a, b) => (a.sev === b.sev ? b.count - a.count : a.sev === 'error' ? -1 : 1));
  el.innerHTML = list.length
    ? list
        .map((e, i) => {
          const k = e.line + '|' + e.sev;
          return `<div class="log-entry ${e.sev}"><i class="dot ${e.sev === 'error' ? 'bad' : 'warn'}"></i><div class="body">
            <div class="txt">${esc(e.text)}</div>
            <div class="meta">
              ${e.mod ? `<button class="chip" data-mod="${esc(e.mod.toLowerCase())}">${esc(e.mod)}</button>` : ''}
              ${e.count > 1 ? `<span class="chip">${e.count}×</span>` : ''}
              ${e.translated ? '' : '<span class="chip mute">Original-Meldung</span>'}
              <span style="color:var(--text-3);font-size:12px">Zeile ${e.line}</span>
              <button class="link-btn" data-raw="${i}">${L.open.has(k) ? 'Original ausblenden' : 'Original anzeigen'}</button>
            </div>${L.open.has(k) ? `<pre>${esc(e.raw)}</pre>` : ''}</div></div>`;
        })
        .join('')
    : emptyBox(L.data.entries.length ? 'Keine Treffer' : 'Keine Fehler oder Warnungen', L.data.entries.length ? 'Passe Filter oder Suche an.' : 'Das Log ist sauber – sehr gut!');
  el.querySelectorAll('[data-raw]').forEach((b) => {
    b.onclick = () => {
      const e = list[+b.dataset.raw];
      const k = e.line + '|' + e.sev;
      if (L.open.has(k)) L.open.delete(k);
      else L.open.add(k);
      drawLogList();
    };
  });
  el.querySelectorAll('[data-mod]').forEach((b) => {
    b.onclick = () => {
      L.mod = b.dataset.mod;
      const sel = document.getElementById('l-mod');
      if (sel) sel.value = L.mod;
      drawLogList();
    };
  });
}

function drawLogHead() {
  const el = document.getElementById('l-top');
  if (!el || !L.data) return;
  const d = L.data;
  if (!d.ok) {
    el.innerHTML = `<div class="card">${emptyBox('Keine Log-Datei gefunden', (d.tried && d.tried.length ? 'Gesucht in: ' + d.tried.join(' · ') + '. ' : '') + 'Lege den Pfad in den Einstellungen fest.')}</div>`;
    document.getElementById('l-body').innerHTML = '';
    return;
  }
  const mods = Object.entries(d.byMod).sort((a, b) => b[1].errors + b[1].warnings - (a[1].errors + a[1].warnings));
  el.innerHTML = `<div class="banner">${I.log}<div class="grow"><small>Log-Datei${d.truncated ? ' (nur die letzten 8 MB ausgewertet)' : ''}</small><span class="path">${esc(d.file)}</span></div>
      <span class="chip ${L.live ? 'ok' : ''}"><i></i>${L.live ? 'Live' : 'Stand'} ${fmtClock(Date.now())}</span></div>
    <div class="stat-row">
      <div class="card stat"><b class="${d.counts.errors ? 'bad' : ''}">${fmtNum(d.counts.errors)}</b><span>Fehler</span></div>
      <div class="card stat"><b class="${d.counts.warnings ? 'warn' : ''}">${fmtNum(d.counts.warnings)}</b><span>Warnungen</span></div>
      <div class="card stat"><b>${mods.length}</b><span>Betroffene Mods</span></div>
      <div class="card stat"><b>${fmtNum(d.lineCount)}</b><span>Zeilen · ${fmtSize(d.size)}</span></div>
    </div>
    <div class="toolbar">
      <div class="seg" id="l-seg"><button data-f="all" class="${L.filter === 'all' ? 'on' : ''}">Alle</button><button data-f="error" class="${L.filter === 'error' ? 'on' : ''}">Fehler</button><button data-f="warn" class="${L.filter === 'warn' ? 'on' : ''}">Warnungen</button></div>
      <input class="input" id="l-q" placeholder="Im Log suchen …" value="${esc(L.q)}">
      <select class="input" id="l-mod"><option value="">Alle Mods</option>${mods.map(([k, v]) => `<option value="${esc(k)}" ${k === L.mod ? 'selected' : ''}>${esc(k)} (${v.errors + v.warnings})</option>`).join('')}</select>
    </div>`;
  document.querySelectorAll('#l-seg button').forEach((b) => {
    b.onclick = () => {
      L.filter = b.dataset.f;
      document.querySelectorAll('#l-seg button').forEach((x) => x.classList.toggle('on', x === b));
      drawLogList();
    };
  });
  document.getElementById('l-q').oninput = (e) => ((L.q = e.target.value), drawLogList());
  document.getElementById('l-mod').onchange = (e) => ((L.mod = e.target.value), drawLogList());
}

async function loadLog(force) {
  const r = await api.log.analyze(force ? '' : L.sig);
  if (r.unchanged) return;
  L.data = r;
  L.sig = r.sig || '';
  if (page !== 'log') return;
  const q = document.getElementById('l-q');
  const hadFocus = q && document.activeElement === q;
  drawLogHead();
  drawLogList();
  if (hadFocus) document.getElementById('l-q').focus();
}

pages.log = {
  title: 'Log-Analyse',
  icon: I.log,
  async render() {
    view.innerHTML =
      head('Log-Analyse', 'Fehler und Warnungen aus dem Spiel-Log – in verständlichem Deutsch.',
        `<label class="chip" style="gap:10px;padding:6px 12px">Live-Modus<span class="switch"><input type="checkbox" id="l-live" ${L.live ? 'checked' : ''}><span></span></span></label><button class="btn" id="l-open">${I.folder}Datei zeigen</button><button class="btn primary" id="l-ref">${I.refresh}Neu laden</button>`) +
      `<div id="l-top"><div class="card"><span class="spin"></span></div></div><div id="l-body"><div id="l-list"></div></div>`;
    document.getElementById('l-ref').onclick = () => loadLog(true);
    document.getElementById('l-open').onclick = () => api.openFolder('log');
    document.getElementById('l-live').onchange = (e) => {
      L.live = e.target.checked;
      clearTimers();
      if (L.live) timers.push(setInterval(() => loadLog(false), 3000));
      toast(L.live ? 'Live-Modus: Log wird alle 3 Sekunden geprüft.' : 'Live-Modus beendet.');
    };
    if (L.live) timers.push(setInterval(() => loadLog(false), 3000));
    await loadLog(true);
  }
};

// ---------------------------------------------------------------------------
// Rechner
// ---------------------------------------------------------------------------

const CROPS = [
  ['Weizen', 8500, 300], ['Gerste', 8000, 290], ['Hafer', 7500, 270], ['Raps', 5500, 550], ['Mais', 12500, 260],
  ['Sonnenblumen', 5500, 480], ['Sojabohnen', 4500, 560], ['Kartoffeln', 38000, 130], ['Zuckerrüben', 60000, 70]
];

const CALC_DEFAULT = {
  tab: 'yield',
  yield: { crop: 'Weizen', area: 10, yph: 8500, price: 300, seed: 250, fert: 200, fuel: 120, rent: 0 },
  feed: { label: 'Futter', animals: 20, perDay: 100, stock: 50000, yph: 12000, days: 365, price: 0 },
  mix: { total: 10000, rows: [['Komponente 1', 25, 0], ['Komponente 2', 25, 0], ['Komponente 3', 25, 0], ['Komponente 4', 25, 0]] },
  work: { area: 20, width: 12, speed: 12, eff: 85, lph: 40, diesel: 1.2, wage: 0 }
};

let calc = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem('ls25calc') || 'null');
    return saved ? { ...CALC_DEFAULT, ...saved } : JSON.parse(JSON.stringify(CALC_DEFAULT));
  } catch {
    return JSON.parse(JSON.stringify(CALC_DEFAULT));
  }
})();

function saveCalc() {
  try {
    localStorage.setItem('ls25calc', JSON.stringify(calc));
  } catch {
    /* nicht verfügbar */
  }
}

const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return isFinite(n) ? n : 0;
};
const field = (grp, key, label, unit, step = 'any') =>
  `<div class="field"><label>${label}</label><div class="unit"><input class="input" type="number" step="${step}" min="0" data-c="${grp}.${key}" value="${calc[grp][key]}"><em>${unit}</em></div></div>`;
const resRow = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;

const CALC_VIEWS = {
  yield() {
    const c = calc.yield;
    const total = c.area * c.yph;
    const revenue = (total / 1000) * c.price;
    const costs = c.area * (c.seed + c.fert + c.fuel + c.rent);
    const profit = revenue - costs;
    return {
      inputs: `<div class="field"><label>Fruchtart (Startwerte)</label><select class="input" id="c-crop">${CROPS.map((x) => `<option ${x[0] === c.crop ? 'selected' : ''}>${x[0]}</option>`).join('')}<option ${c.crop === 'Eigene' ? 'selected' : ''}>Eigene</option></select></div>
        <div class="fgrid">${field('yield', 'area', 'Fläche', 'ha')}${field('yield', 'yph', 'Ertrag', 'L/ha')}${field('yield', 'price', 'Verkaufspreis', '€/1000 L')}${field('yield', 'seed', 'Saatgut', '€/ha')}${field('yield', 'fert', 'Dünger &amp; Spritzmittel', '€/ha')}${field('yield', 'fuel', 'Diesel &amp; Wartung', '€/ha')}${field('yield', 'rent', 'Pacht', '€/ha')}</div>
        <p class="note">Die Startwerte je Fruchtart sind grobe Richtwerte. Trage den Ertrag aus deinem Spielstand und den aktuellen Verkaufspreis deiner Karte ein.</p>`,
      result: `<div class="result-big"><small>Gewinn</small><b class="${profit < 0 ? 'neg' : ''}">${eur(profit)}</b></div>
        <dl class="res-list">${resRow('Gesamtertrag', fmtNum(total) + ' L')}${resRow('Erlös', eur(revenue))}${resRow('Kosten gesamt', eur(costs))}${resRow('Gewinn je ha', eur(c.area ? profit / c.area : 0))}${resRow('Kostendeckender Preis', total ? eur(costs / (total / 1000)) + ' /1000 L' : '–')}</dl>`
    };
  },
  feed() {
    const c = calc.feed;
    const day = c.animals * c.perDay;
    const year = day * c.days;
    const lasts = day ? c.stock / day : 0;
    const missing = Math.max(0, year - c.stock);
    return {
      inputs: `<div class="field"><label>Futterart (nur Beschriftung)</label><input class="input" data-c="feed.label" value="${esc(c.label)}" maxlength="40"></div>
        <div class="fgrid">${field('feed', 'animals', 'Anzahl Tiere', 'Stk')}${field('feed', 'perDay', 'Verbrauch je Tier und Tag', 'L')}${field('feed', 'stock', 'Aktueller Vorrat', 'L')}${field('feed', 'yph', 'Ertrag der Anbaufläche', 'L/ha')}${field('feed', 'days', 'Spieltage je Jahr', 'Tage')}${field('feed', 'price', 'Zukaufpreis (optional)', '€/1000 L')}</div>
        <p class="note">Den Verbrauch je Tier findest du im Tierhaltungs-Menü des Spiels. Spieltage je Jahr = Tage pro Monat × 12 (siehe Zeiteinstellungen deines Spielstands).</p>`,
      result: `<div class="result-big"><small>Vorrat reicht für</small><b class="${lasts < 7 ? 'neg' : ''}">${fmtNum(lasts, 1)} Tage</b></div>
        <dl class="res-list">${resRow(esc(c.label) + ' pro Tag', fmtNum(day) + ' L')}${resRow('pro Woche (7 Tage)', fmtNum(day * 7) + ' L')}${resRow('pro Jahr', fmtNum(year) + ' L')}${resRow('Fehlmenge bis Jahresende', fmtNum(missing) + ' L')}${resRow('Anbaufläche für Jahresbedarf', c.yph ? fmtNum(year / c.yph, 1) + ' ha' : '–')}${resRow('Zukaufkosten Fehlmenge', c.price ? eur((missing / 1000) * c.price) : '–')}</dl>`
    };
  },
  mix() {
    const c = calc.mix;
    const sum = c.rows.reduce((a, r) => a + num(r[1]), 0);
    let costTotal = 0;
    const rows = c.rows.map((r, i) => {
      const amount = sum ? (c.total * num(r[1])) / sum : 0;
      const cost = (amount / 1000) * num(r[2]);
      costTotal += cost;
      return `<div class="mix-row"><input class="input" data-mix="${i}.0" value="${esc(r[0])}" maxlength="30"><div class="unit"><input class="input" type="number" min="0" step="any" data-mix="${i}.1" value="${r[1]}"><em>%</em></div><div class="unit"><input class="input" type="number" min="0" step="any" data-mix="${i}.2" value="${r[2]}"><em>€/1000L</em></div><span class="out">${fmtNum(amount)} L</span><span class="out">${eur(cost)}</span><button class="btn sm ghost" data-mixdel="${i}" title="Zeile entfernen">${I.trash}</button></div>`;
    });
    return {
      wide: true,
      inputs: `<div class="field"><label>Gesamtmenge der Mischung</label><div class="unit" style="max-width:260px"><input class="input" type="number" min="0" step="any" data-c="mix.total" value="${c.total}"><em>L</em></div></div>
        <div class="mix-row head"><span>Komponente</span><span>Anteil</span><span>Preis</span><span style="text-align:right">Menge</span><span style="text-align:right">Kosten</span><span></span></div>
        ${rows.join('')}
        <div style="display:flex;gap:10px;align-items:center;margin-top:12px"><button class="btn sm" id="c-mixadd">${I.plus}Komponente</button>
        <span class="chip ${Math.abs(sum - 100) < 0.01 ? 'ok' : 'warn'}"><i></i>Summe ${fmtNum(sum, 1)} %${Math.abs(sum - 100) < 0.01 ? '' : ' – wird auf 100 % umgerechnet'}</span>
        <span class="grow" style="flex:1"></span><b>Mischungskosten: ${eur(costTotal)}</b></div>
        <p class="note">Trage die Zutaten und Anteile deiner Mischration (z. B. aus dem Rezept im Spiel) ein. Die Mengen werden auf die Gesamtmenge verteilt.</p>`,
      result: ''
    };
  },
  work() {
    const c = calc.work;
    const haph = ((c.width * c.speed) / 10) * (c.eff / 100);
    const hours = haph ? c.area / haph : 0;
    const diesel = hours * c.lph;
    const cost = diesel * c.diesel + hours * c.wage;
    return {
      inputs: `<div class="fgrid">${field('work', 'area', 'Fläche', 'ha')}${field('work', 'width', 'Arbeitsbreite', 'm')}${field('work', 'speed', 'Arbeitsgeschwindigkeit', 'km/h')}${field('work', 'eff', 'Wirkungsgrad', '%')}${field('work', 'lph', 'Dieselverbrauch', 'L/h')}${field('work', 'diesel', 'Dieselpreis', '€/L')}${field('work', 'wage', 'Lohnkosten (optional)', '€/h')}</div>
        <p class="note">Flächenleistung = Breite × Geschwindigkeit ÷ 10 × Wirkungsgrad. Wendezeiten und Entladen sind im Wirkungsgrad enthalten (typisch 75–90 %).</p>`,
      result: `<div class="result-big"><small>Arbeitszeit</small><b>${fmtHours(hours)}</b></div>
        <dl class="res-list">${resRow('Flächenleistung', fmtNum(haph, 2) + ' ha/h')}${resRow('Dieselbedarf', fmtNum(diesel, 1) + ' L')}${resRow('Kosten gesamt', eur(cost))}${resRow('Kosten je ha', eur(c.area ? cost / c.area : 0))}</dl>`
    };
  }
};

pages.calc = {
  title: 'Rechner',
  icon: I.calc,
  async render() {
    const tabs = [['yield', 'Ertrag &amp; Gewinn'], ['feed', 'Futter'], ['mix', 'Mischration'], ['work', 'Arbeitszeit']];
    const draw = (keepFocus) => {
      const v = CALC_VIEWS[calc.tab]();
      const active = document.activeElement;
      const focusKey = keepFocus && active ? active.getAttribute('data-c') || active.getAttribute('data-mix') : null;
      const pos = keepFocus && active && active.selectionStart != null ? active.selectionStart : null;
      document.getElementById('c-body').innerHTML = v.wide
        ? `<div class="card">${v.inputs}</div>`
        : `<div class="calc-grid"><div class="card"><h2>Eingaben</h2>${v.inputs}</div><div class="card"><h2>Ergebnis</h2>${v.result}</div></div>`;
      bind();
      if (focusKey) {
        const el = document.querySelector(`[data-c="${focusKey}"],[data-mix="${focusKey}"]`);
        if (el) {
          el.focus();
          if (pos != null && el.type !== 'number') el.setSelectionRange(pos, pos);
        }
      }
    };
    const bind = () => {
      document.querySelectorAll('[data-c]').forEach((el) => {
        el.oninput = () => {
          const [g, k] = el.dataset.c.split('.');
          calc[g][k] = el.type === 'number' ? num(el.value) : el.value;
          saveCalc();
          draw(true);
        };
      });
      document.querySelectorAll('[data-mix]').forEach((el) => {
        el.oninput = () => {
          const [i, j] = el.dataset.mix.split('.').map(Number);
          calc.mix.rows[i][j] = j === 0 ? el.value : num(el.value);
          saveCalc();
          draw(true);
        };
      });
      document.querySelectorAll('[data-mixdel]').forEach((b) => {
        b.onclick = () => {
          calc.mix.rows.splice(+b.dataset.mixdel, 1);
          saveCalc();
          draw();
        };
      });
      const add = document.getElementById('c-mixadd');
      if (add) add.onclick = () => (calc.mix.rows.push(['Komponente ' + (calc.mix.rows.length + 1), 0, 0]), saveCalc(), draw());
      const crop = document.getElementById('c-crop');
      if (crop) {
        crop.onchange = () => {
          const preset = CROPS.find((x) => x[0] === crop.value);
          calc.yield.crop = crop.value;
          if (preset) {
            calc.yield.yph = preset[1];
            calc.yield.price = preset[2];
          }
          saveCalc();
          draw();
        };
      }
    };

    view.innerHTML =
      head('Rechner', 'Ertrag, Futterbedarf, Mischrationen und Arbeitszeit.') +
      `<div class="tabs" id="c-tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${calc.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="c-body"></div>`;
    document.querySelectorAll('#c-tabs button').forEach((b) => {
      b.onclick = () => {
        calc.tab = b.dataset.tab;
        saveCalc();
        document.querySelectorAll('#c-tabs button').forEach((x) => x.classList.toggle('on', x === b));
        draw();
      };
    });
    draw();
  }
};

// ---------------------------------------------------------------------------
// Server Status
// ---------------------------------------------------------------------------

function serverForm() {
  const m = openModal(
    `<h2>Lieblingsserver hinzufügen</h2>
     <p class="lead">Mit der Statistik-Adresse deines Servers siehst du Spieleranzahl, Map und Spielernamen. Ohne Adresse wird nur der Spielport geprüft.</p>
     <div class="field"><label>Name</label><input class="input" id="s-name" maxlength="60" placeholder="Mein Multiplayer-Server"></div>
     <div class="field"><label>Statistik-Adresse (optional)</label><input class="input mono" id="s-url" maxlength="600" placeholder="http://1.2.3.4:8080/feed/dedicated-server-stats.xml?code=…" spellcheck="false">
       <small>Du findest den Link im Webinterface des Dedicated Servers (Bereich „Spieler/Statistik“), in der Regel mit Zugriffscode.</small></div>
     <div class="form-row"><div class="field"><label>Host / IP</label><input class="input" id="s-host" maxlength="200" placeholder="beispiel.de" spellcheck="false"></div>
     <div class="field"><label>Spielport</label><input class="input" id="s-port" type="number" min="1" max="65535" value="10823"></div></div>
     <div class="modal-actions"><button class="btn" data-no>Abbrechen</button><button class="btn primary" data-yes>Hinzufügen</button></div>`
  );
  m.el.querySelector('[data-no]').onclick = m.close;
  m.el.querySelector('[data-yes]').onclick = async () => {
    const url = m.el.querySelector('#s-url').value.trim();
    let host = m.el.querySelector('#s-host').value.trim();
    if (url && !/^https?:\/\//i.test(url)) return toast('Die Statistik-Adresse muss mit http:// oder https:// beginnen.', true);
    if (!host && url) {
      try {
        host = new URL(url).hostname;
      } catch {
        return toast('Ungültige Statistik-Adresse.', true);
      }
    }
    if (!host) return toast('Bitte Host oder Statistik-Adresse angeben.', true);
    cfg.servers.push({
      name: m.el.querySelector('#s-name').value.trim() || host,
      host,
      port: parseInt(m.el.querySelector('#s-port').value, 10) || 10823,
      statsUrl: url
    });
    await persist();
    m.close();
    pages.status.render();
  };
  m.el.querySelector('#s-name').focus();
}

pages.status = {
  title: 'Server Status',
  icon: I.server,
  async render() {
    view.innerHTML =
      head('Server Status', 'Erreichbarkeit der GIANTS-Dienste und deiner Lieblingsserver.', `<button class="btn" id="s-add">${I.plus}Server hinzufügen</button><button class="btn primary" id="s-ref">${I.refresh}Prüfen</button>`) +
      `<div class="stack"><div class="card"><h2>Lieblingsserver</h2><div id="s-cus">${cfg.servers.length ? '<span class="spin"></span>' : emptyBox('Noch keine Server', 'Füge einen Multiplayer-Server hinzu, um Spieleranzahl und Map zu sehen.')}</div></div>
       <div class="card"><h2>Offizielle Dienste</h2><div id="s-off"><span class="spin"></span></div></div></div>
       <p class="note" id="s-time"></p>`;
    document.getElementById('s-add').onclick = serverForm;
    document.getElementById('s-ref').onclick = () => pages.status.render();

    const row = (r) => `<div class="status-row"><i class="dot ${r.online ? 'ok' : 'bad'}"></i>
      <div class="grow"><b>${esc(r.name)}</b><small>${esc(r.target)} · ${esc(r.detail)}</small></div>
      <span class="ms">${r.ms != null ? r.ms + ' ms' : '–'}</span><span class="chip ${r.online ? 'ok' : 'bad'}"><i></i>${r.online ? 'Online' : 'Offline'}</span></div>`;

    const srv = (r, idx) => {
      const s = r.stats;
      const pct = s && s.capacity ? Math.round((s.numUsed / s.capacity) * 100) : 0;
      return `<div class="srv"><div class="srv-head"><i class="dot ${r.online ? 'ok' : 'bad'}"></i>
          <div class="grow"><b>${esc(r.name)}${s && s.serverName && s.serverName !== r.name ? ' · ' + esc(s.serverName) : ''}</b><small>${esc(r.target)} · ${esc(r.detail)}</small></div>
          <span class="ms">${r.ms != null ? r.ms + ' ms' : '–'}</span><span class="chip ${r.online ? 'ok' : 'bad'}"><i></i>${r.online ? 'Online' : 'Offline'}</span>
          <button class="btn sm danger" data-srv="${idx}">${I.trash}</button></div>
        ${s ? `<div class="srv-stats"><div><small>Spieler</small><span>${s.numUsed} / ${s.capacity || '?'}</span><div class="bar"><i style="width:${pct}%"></i></div></div>
          <div><small>Map</small><span>${esc(s.map || '–')}</span></div><div><small>Spiel / Mods</small><span>${esc(s.game ? s.game.replace('Farming Simulator ', 'FS') : '–')} ${esc(s.version)} · ${s.mods} Mods</span></div></div>
          ${s.players.length ? `<div class="srv-players">${s.players.map((n) => `<span class="chip">${esc(n)}</span>`).join('')}</div>` : ''}` : ''}</div>`;
    };

    const load = async () => {
      const res = await api.status.check();
      if (page !== 'status') return;
      document.getElementById('s-off').innerHTML = res.official.map(row).join('');
      if (cfg.servers.length) {
        document.getElementById('s-cus').innerHTML = res.custom.map(srv).join('');
        view.querySelectorAll('[data-srv]').forEach((b) => {
          b.onclick = async () => {
            cfg.servers.splice(parseInt(b.dataset.srv, 10), 1);
            await persist();
            pages.status.render();
          };
        });
      }
      document.getElementById('s-time').textContent = 'Zuletzt geprüft: ' + fmtDate(res.checkedAt) + ' · aktualisiert sich alle 30 Sekunden';
    };
    await load();
    timers.push(setInterval(load, 30000));
  }
};

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------

pages.settings = {
  title: 'Einstellungen',
  icon: I.gear,
  async render() {
    const mf = await api.modFolderInfo();
    const row = (id, label, hint, val, kind, extra = '') => `<div class="field"><label>${label}</label>
      <div class="path-row"><input class="input mono" id="${id}" value="${esc(val)}" spellcheck="false">
      <button class="btn" data-pick="${id}" data-kind="${kind}">${I.folder}Wählen</button>${extra}</div><small>${hint}</small></div>`;

    view.innerHTML =
      head('Einstellungen', 'Pfade und Verhalten des Launchers.') +
      `<div class="stack">
        <div class="card"><h2>Pfade</h2>
          ${row('st-game', 'Spiel (FarmingSimulator2025.exe)', 'Wird beim Start ausgeführt.', cfg.gamePath, 'file', '<button class="btn" id="st-detect">Erkennen</button>')}
          ${row('st-profile', 'Profil-Ordner', 'Enthält gameSettings.xml, savegame-Ordner und die Log-Datei – meist Dokumente\\My Games\\FarmingSimulator2025.', cfg.profilePath, 'dir')}
          ${row('st-mods', 'Mods-Ordner', 'Wird gespeichert und als modsDirectoryOverride in gameSettings.xml eingetragen.', cfg.modsPath || '', 'dir')}
          ${row('st-backup', 'Backup-Ordner', 'Hier werden die ZIP-Sicherungen gespeichert.', cfg.backupPath, 'dir')}
          ${row('st-log', 'Log-Datei (optional)', 'Leer lassen für automatische Suche (log.txt bzw. game.log.txt im Profil-Ordner).', cfg.logPath, 'log')}
        </div>
        <div class="card"><h2>Mod-Ordner</h2>
          <dl class="kv"><dt>Aktuell verwendet</dt><dd class="mono">${esc(mf.dir)}</dd><dt>Quelle</dt><dd>${esc(sourceLabel(mf.source))}</dd>
          <dt>gameSettings.xml</dt><dd class="mono">${esc(mf.gameSettings.file)}${mf.gameSettings.exists ? '' : ' (nicht gefunden)'}</dd></dl>
          <p class="note">Der Launcher liest den Mod-Ordner aus dem Eintrag <span class="mono">modsDirectoryOverride</span> der gameSettings.xml. Ist dort nichts aktiv, wird der Ordner „mods“ im Profil-Ordner verwendet.</p>
        </div>
        <div class="card"><h2>Verhalten</h2>
          <div class="setting"><div><b>Ressourcenschonender Mod-Abgleich</b><small>Begrenzt den SHA-256-Scan auf etwa 24 MiB/s und merkt sich Prüfsummen unveränderter ZIP-Dateien.</small></div>
            <label class="switch"><input type="checkbox" id="st-lowperf" ${cfg.lowPerformanceMode !== false ? 'checked' : ''}><span></span></label></div>
          <div class="setting"><div><b>Launcher nach dem Spielstart schließen</b><small>Beendet den Launcher, sobald das Spiel läuft.</small></div>
            <label class="switch"><input type="checkbox" id="st-close" ${cfg.closeOnLaunch ? 'checked' : ''}><span></span></label></div>
          <div class="setting"><div><b>Automatisches Backup vor jedem Start</b><small>Sichert vor dem Spielstart die Spielstände.</small></div>
            <label class="switch"><input type="checkbox" id="st-auto" ${cfg.autoBackup ? 'checked' : ''}><span></span></label></div>
          <div class="setting"><div><b>Auto-Backups behalten</b><small>Ältere automatische Backups je Slot wandern in den Papierkorb.</small></div>
            <div class="unit" style="width:130px"><input class="input" type="number" min="1" max="50" id="st-keep" value="${cfg.autoBackupKeep}"><em>Stück</em></div></div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn primary" id="st-save">${I.check}Speichern</button></div>
      </div>`;

    view.querySelectorAll('[data-pick]').forEach((b) => {
      b.onclick = async () => {
        const v = await api.pick(b.dataset.kind);
        if (v) document.getElementById(b.dataset.pick).value = v;
      };
    });
    document.getElementById('st-detect').onclick = async () => {
      const g = await api.detectGame();
      if (g) {
        document.getElementById('st-game').value = g;
        toast('Spiel gefunden.');
      } else toast('Keine Installation gefunden. Bitte manuell wählen.', true);
    };
    document.getElementById('st-save').onclick = async () => {
      cfg.gamePath = document.getElementById('st-game').value.trim();
      cfg.profilePath = document.getElementById('st-profile').value.trim();
      cfg.modsPath = document.getElementById('st-mods').value.trim();
      cfg.backupPath = document.getElementById('st-backup').value.trim();
      cfg.logPath = document.getElementById('st-log').value.trim();
      cfg.closeOnLaunch = document.getElementById('st-close').checked;
      cfg.autoBackup = document.getElementById('st-auto').checked;
      cfg.lowPerformanceMode = document.getElementById('st-lowperf').checked;
      cfg.autoBackupKeep = parseInt(document.getElementById('st-keep').value, 10) || 10;
      const saved = await persist();
      L.sig = '';
      toast(saved && saved.settingsError ? 'Einstellungen gespeichert, aber gameSettings.xml: ' + saved.settingsError : 'Einstellungen gespeichert.');
      pages.settings.render();
    };
  }
};

// ---------------------------------------------------------------------------
// Über uns
// ---------------------------------------------------------------------------

pages.partners = {
  title: 'Partner', icon: I.cloud,
  async render(force = true) {
    const data = await api.partners.list(force);
    const cards = (data.items || []).map((p) => `<article class="card partner-card"><div class="partner-head">${p.logo ? `<img class="partner-logo" loading="lazy" referrerpolicy="no-referrer" data-partner-logo src="${esc(p.logo)}" alt="Logo ${esc(p.title)}">` : `<div class="partner-logo partner-placeholder">${esc(initials(p.title))}</div>`}<div class="grow"><span class="tag">Partner</span><h3>${esc(p.title)}</h3></div></div><p>${esc(p.description || 'Partner der Agri-Nexus-Community.')}</p><button class="btn primary" data-partner-url="${esc(p.url)}">Website öffnen</button></article>`).join('');
    const updated = data.updatedAt ? fmtDate(data.updatedAt) : 'noch nicht synchronisiert';
    view.innerHTML = head('Agri Nexus Partner', 'Unsere Partner mit Logo, Beschreibung und direktem Link.', `<button class="btn" id="partner-refresh">${I.refresh}Liste aktualisieren</button><button class="btn primary" id="partner-edit">Partnerliste verwalten</button>`) +
      `<small class="partner-sync-status">${data.stale ? `Abruf fehlgeschlagen: ${esc(data.error || 'Verbindung nicht verfügbar')} · gespeicherte Liste wird angezeigt` : `Zuletzt aktualisiert: ${esc(updated)}`}</small>
      <div class="partner-grid">${cards || `<div class="card">${emptyBox('Noch keine Partner eingetragen', 'Füge deine ersten Partner über „Partnerliste verwalten“ hinzu. Die App lädt neue Einträge danach automatisch.')}</div>`}</div>`;
    document.getElementById('partner-refresh').onclick = () => pages.partners.render(true);
    document.getElementById('partner-edit').onclick = () => api.partners.open('https://github.com/AgrarJulian/LS-Launcher/edit/main/partners.json');
    view.querySelectorAll('[data-partner-url]').forEach((b) => b.onclick = () => api.partners.open(b.dataset.partnerUrl));
    view.querySelectorAll('[data-partner-logo]').forEach((img) => { img.onerror = () => { const fallback = document.createElement('div'); fallback.className = 'partner-logo partner-placeholder'; fallback.textContent = initials(img.alt.replace(/^Logo\s+/, '')); img.replaceWith(fallback); }; });
    if (partnerRefreshTimer) clearInterval(partnerRefreshTimer);
    partnerRefreshTimer = setInterval(() => { if (page === 'partners') pages.partners.render(true); }, 2 * 60 * 1000);
    timers.push(partnerRefreshTimer);
  }
};

pages.about = {
  title: 'Über uns',
  icon: I.info,
  async render() {
    const link = (u) => `<a data-ext="https://${u}">${u}</a>`;
    view.innerHTML = `<div class="card about">
      <div class="about-head"><img src="../assets/icon.png" alt="">
        <div><h2>Agri Nexus v1.0.3-beta</h2><p>Freies Open-Source-Verwaltungstool für den Landwirtschafts-Simulator 25</p></div></div>
      <hr>
      <section><h3>Projekt &amp; Community</h3>
        <ul>
          <li>Entwickelt mit ❤️ für die LS25-Community</li>
          <li>Quellcode &amp; Updates: ${link('github.com/AgrarJulian/LS-Launcher')}</li>
          <li>Fehler melden / Feedback: ${link('github.com/AgrarJulian/LS-Launcher/issues')}</li>
        </ul></section>
      <section><h3>Lizenz &amp; Haftungsausschluss</h3>
        <p>Dieses Programm ist freie Software und steht unter der MIT-Lizenz.<br>Die Software wird "wie gesehen" (AS IS) zur Verfügung gestellt, ohne jegliche ausdrückliche oder stillschweigende Gewährleistung.</p>
        <p>Der Entwickler übernimmt keine Haftung für etwaige Schäden, Datenverlust oder beschädigte Spielstände/Mods, die durch die Nutzung dieser Software entstehen. Die Nutzung erfolgt auf eigene Gefahr.</p></section>
      <section><h3>Rechtlicher Hinweis</h3>
        <p>Agri Nexus ist ein inoffizielles Community-Projekt und steht in keinerlei Verbindung mit der GIANTS Software GmbH. "Landwirtschafts-Simulator" und "GIANTS Software" sind eingetragene Marken der GIANTS Software GmbH.</p></section>
      <section style="margin-bottom:0"><ul><li>Datenschutzbestimmungen: ${link('github.com/AgrarJulian/LS-Launcher/blob/main/PRIVACY.md')}</li></ul></section>
    </div>`;
  }
};

let companionLinks = [], companionEnabled = false;
pages.companion = {
  title: 'Live & Werkstatt', icon: I.gear,
  async render() {
    const saves = await api.saves.list(), slots = saves.items || [], profile = activeProfile();
    let slot = pages.companion.slot || profile.savegame || slots[0]?.slot || '';
    if (slot && !slots.some((s) => s.slot === slot)) slot = slots[0]?.slot || '';
    const editor = slot ? await api.saveTools.inspect(slot) : { ok: false, error: 'Kein Spielstand gefunden.', fields: [], issues: [] };
    const [binding, graphics, bootRuns] = await Promise.all([api.profileSnapshots.info('inputBinding', profile.id), api.profileSnapshots.info('graphics', profile.id), api.performance.bootRuns()]);
    view.innerHTML = head('Live-Begleiter & Werkstatt', 'Second Screen, Savegame-Werkzeuge, Profil-Sicherungen und Mod-Analyse.') +
      `<div class="stack">
        <div class="card"><h2>Live-Begleiter · lokales WLAN</h2><p class="note">Zeigt Spielstand, Karte und Kontostand. Weitere Silos, Aufträge und Produktionen benötigen ein Telemetrie-Mod, das Daten an den eingeblendeten /api/telemetry-Endpunkt sendet.</p><div class="toolbar"><button class="btn primary" id="comp-start">${companionEnabled ? 'Link aktualisieren' : 'Companion starten'}</button><button class="btn" id="comp-stop" ${companionEnabled ? '' : 'disabled'}>Beenden</button></div>${companionLinks.map((u) => `<div class="path-row"><input class="input mono" readonly value="${esc(u)}"><button class="btn" data-comp-copy="${esc(u)}">Link kopieren</button></div><small>Telemetrie-POST: <span class="mono">${esc(u)}/api/telemetry</span></small>`).join('') || '<span class="note">Server ist aus.</span>'}</div>
        <div class="card"><h2>Dev-Makro-Deck</h2><p class="note">Bei aktivem Dev Mode kopieren die Tasten den Befehl in die Zwischenablage. Im Spiel Konsole öffnen und einfügen.</p><div class="toolbar">${[['1','gsPlayerFlightMode'],['2','gsMoneyAdd'],['3','gsTimeSet'],['4','gsToggleHUD']].map(([n,c]) => `<button class="btn" data-macro="${c}" ${profile.devMode ? '' : 'disabled'}>Alt+${n} · ${c}</button>`).join('')}</div><small>Dev Mode ${profile.devMode ? 'aktiv' : 'ausgeschaltet'} für ${esc(profile.name)}.</small></div>
        <div class="card"><h2>Savegame-Editor &amp; Diagnose</h2><p class="note">Vor Änderungen wird ein vollständiges ZIP-Backup erstellt. Nur numerische Felder in ausgewählten XML-Dateien; Spiel muss beendet sein.</p><div class="toolbar"><select class="input" id="save-slot">${slots.map((s) => `<option value="${esc(s.slot)}" ${s.slot === slot ? 'selected' : ''}>${esc(s.slot)} · ${esc(s.name)}${s.map ? ' · ' + esc(s.map) : ''}</option>`).join('')}</select><button class="btn" id="save-refresh">Neu einlesen</button></div>${editor.ok ? `<div class="form-row"><div class="field"><label>XML-Feld</label><select class="input" id="save-field">${editor.fields.map((f, i) => `<option value="${i}">${esc(f.file)} · &lt;${esc(f.tag)}&gt;${f.occurrence ? ` [${f.occurrence + 1}]` : ''} = ${esc(f.value)}</option>`).join('')}</select></div><div class="field"><label>Neuer Wert</label><input class="input" id="save-value" inputmode="decimal"></div></div><button class="btn primary" id="save-apply" ${editor.fields.length ? '' : 'disabled'}>Mit Vorher-Backup ändern</button>` : `<span class="note">${esc(editor.error || 'Keine editierbaren numerischen Felder gefunden.')}</span>`}<div class="tool-report">${editor.issues?.length ? `<b>Prüfhinweise</b>${editor.issues.map((x) => `<div class="status-row"><span>${esc(x.file)} · ${esc(x.issue)}</span></div>`).join('')}` : '<span class="chip ok">Keine XML-Strukturfehler gefunden</span>'}</div><p class="note">Cleanup meldet strukturelle Auffälligkeiten. Verwaiste Ballen und Helfer-Aufträge werden nicht automatisch gelöscht, weil es dafür keine sichere allgemeine Reparaturregel gibt.</p></div>
        <div class="card"><h2>Controller- &amp; Grafikprofile</h2><p class="note">Sichere den aktuellen Stand pro Launcher-Profil, nachdem du die gewünschte Belegung oder Grafik im Spiel eingestellt hast. Vor Wiederherstellung wird die aktuelle XML-Datei als .agri-nexus.bak gesichert.</p><div class="setting"><div><b>inputBinding.xml · ${binding ? 'gesichert ' + fmtDate(binding.mtime) : 'noch kein Snapshot'}</b></div><span class="toolbar"><button class="btn sm" id="binding-save">Stand sichern</button><button class="btn sm" id="binding-apply" ${binding ? '' : 'disabled'}>Wiederherstellen</button></span></div><div class="setting"><div><b>gameSettings.xml · ${graphics.length ? graphics.length + ' Preset(s)' : 'noch keine Presets'}</b><small>Stelle Grafik im Spiel ein und sichere mehrere Presets, z. B. „Ultra“, „FPS-Boost“ oder „Screenshot“.</small></div><span class="toolbar"><select class="input" id="graphics-preset" ${graphics.length ? '' : 'disabled'}>${graphics.map((x) => `<option value="${esc(x.name)}">${esc(x.name)} · ${fmtDate(x.mtime)}</option>`).join('') || '<option>Keine Presets</option>'}</select><button class="btn sm" id="graphics-save">Als Preset sichern</button><button class="btn sm" id="graphics-apply" ${graphics.length ? '' : 'disabled'}>Preset anwenden</button></span></div></div>
        <div class="card"><h2>Mod-Leistung, Ladezeit &amp; Modpack</h2><p class="note">Der Ladezeit-Tracker sucht nach Ladeabschluss-Markern in log.txt; je nach Spielversion werden nicht immer passende Marker geschrieben. Der Bloat-Scan zeigt Dateigrößen, keine gemessenen FPS oder VRAM-Werte.</p><div class="toolbar"><button class="btn" id="perf-scan">Mod-Bloat scannen</button><button class="btn" id="boot-refresh">Ladezeiten aktualisieren</button><button class="btn primary" id="modpack-export">Aktives Profil als Modpack-Manifest exportieren</button></div><div class="tool-report">${bootRuns.length ? `<b>Letzte Starts</b>${bootRuns.slice(0,5).map((x) => `<div class="status-row"><span class="grow">${fmtDate(x.startedAt)} · ${esc(x.profile || '')}</span><span>${x.durationMs == null ? esc(x.marker) : `${Math.floor(x.durationMs / 60000)}:${String(Math.floor(x.durationMs / 1000) % 60).padStart(2,'0')} min · ${esc(x.marker)}`}</span></div>`).join('')}` : '<span class="note">Noch keine Ladezeitmessung vorhanden. Starte das Spiel über Agri Nexus und prüfe später erneut.</span>'}</div><div id="perf-report" class="tool-report"></div></div>
        <div class="card"><h2>Discord Rich Presence</h2><p class="note">Zeigt Spielstatus, aktives Profil, Karte und aktive Mod-Anzahl. Discord muss dafür laufen.</p><span class="chip">App-ID 1567209388068970666</span></div>
      </div>`;
    document.getElementById('comp-start').onclick = async () => { const r = await api.companion.start(); if (!r.ok) return toast(r.error, true); companionEnabled = true; companionLinks = r.urls || []; pages.companion.render(); };
    document.getElementById('comp-stop').onclick = async () => { await api.companion.stop(); companionEnabled = false; companionLinks = []; pages.companion.render(); };
    view.querySelectorAll('[data-comp-copy]').forEach((b) => b.onclick = async () => { await api.copyText(b.dataset.compCopy); toast('Companion-Link kopiert.'); });
    view.querySelectorAll('[data-macro]').forEach((b) => b.onclick = async () => { await api.copyText(b.dataset.macro); toast(`${b.dataset.macro} kopiert – im Spiel in die Konsole einfügen.`); });
    document.getElementById('save-slot').onchange = () => { pages.companion.slot = document.getElementById('save-slot').value; pages.companion.render(); };
    document.getElementById('save-refresh').onclick = () => pages.companion.render();
    const field = document.getElementById('save-field');
    if (field && editor.fields.length) { document.getElementById('save-value').value = editor.fields[Number(field.value)].value; field.onchange = () => { document.getElementById('save-value').value = editor.fields[Number(field.value)].value; }; }
    document.getElementById('save-apply')?.addEventListener('click', async () => { const f = editor.fields[Number(field.value)]; if (!f) return; if (!(await confirmDialog('Savegame-Wert ändern?', `Vollbackup von ${slot} erstellen und <${f.tag}> in ${f.file} ändern?`, 'Backup & ändern', true))) return; const r = await api.saveTools.edit(slot, f.file, f.tag, f.occurrence, document.getElementById('save-value').value); if (!r.ok) toast(r.error, true); else { toast('Geändert; Vorher-Backup: ' + r.backup); pages.companion.render(); } });
    document.getElementById('binding-save').onclick = async () => { const r = await api.profileSnapshots.save('inputBinding', profile.id); if (!r.ok) toast(r.error, true); else { toast('Controllerbelegung gesichert.'); pages.companion.render(); } };
    document.getElementById('binding-apply').onclick = async () => { if (!(await confirmDialog('Controllerbelegung anwenden?', 'Die aktuelle inputBinding.xml wird vorher als .agri-nexus.bak gesichert.', 'Sichern & anwenden', true))) return; const r = await api.profileSnapshots.apply('inputBinding', profile.id); if (!r.ok) toast(r.error, true); else toast('Controllerbelegung angewendet.'); };
    document.getElementById('graphics-save').onclick = async () => { const name = prompt('Name für das Grafik-Preset (z. B. Ultra, FPS-Boost, Screenshot):'); if (!name) return; const r = await api.profileSnapshots.save('graphics', profile.id, name); if (!r.ok) toast(r.error, true); else { toast('Grafik-Preset gesichert.'); pages.companion.render(); } };
    document.getElementById('graphics-apply').onclick = async () => { const name = document.getElementById('graphics-preset').value; if (!(await confirmDialog('Grafik-Preset anwenden?', `„${name}“ wird eingespielt. Die aktuelle gameSettings.xml wird zuvor gesichert.`, 'Sichern & anwenden', true))) return; const r = await api.profileSnapshots.apply('graphics', profile.id, name); if (!r.ok) toast(r.error, true); else toast('Grafik-Preset angewendet.'); };
    document.getElementById('modpack-export').onclick = async () => { const r = await api.mods.exportManifest(); if (r.ok) toast(`Manifest exportiert: ${r.count} Mods · ${r.file}`); else if (!r.canceled) toast(r.error, true); };
    document.getElementById('boot-refresh').onclick = () => pages.companion.render();
    document.getElementById('perf-scan').onclick = async (e) => { const b = e.currentTarget; b.disabled = true; b.textContent = 'Scanne …'; const r = await api.mods.performanceReport(); b.disabled = false; b.textContent = 'Mod-Bloat scannen'; if (!r.ok) return toast(r.error, true); document.getElementById('perf-report').innerHTML = `<b>${fmtSize(r.totalBytes)} gesamt · ${r.largeCount} Mod(s) über 512 MiB · ${r.assetCount} große Assets</b><h3>Größte Mods</h3>${r.mods.slice(0,10).map((m) => `<div class="status-row"><span class="grow">${esc(m.name)}${m.error ? ' · ' + esc(m.error) : ''}</span>${fmtSize(m.size)}</div>`).join('')}<h3>Große Assets</h3>${r.assets.slice(0,15).map((a) => `<div class="status-row"><span class="grow">${esc(a.mod)} · ${esc(a.file)}</span>${fmtSize(a.size)} · ${esc(a.note)}</div>`).join('') || '<p>Keine großen Dateien erkannt.</p>'}<p class="note">Log: ${r.log?.ok ? `${r.log.counts?.errors || 0} Fehler, ${r.log.counts?.warnings || 0} Warnungen` : esc(r.log?.error || 'nicht gefunden')}</p>`; };
    if (window._toolMacroHandler) document.removeEventListener('keydown', window._toolMacroHandler);
    if (profile.devMode) { window._toolMacroHandler = (e) => { const n = e.key; if (!e.altKey || !['1','2','3','4'].includes(n)) return; const c = {1:'gsPlayerFlightMode',2:'gsMoneyAdd',3:'gsTimeSet',4:'gsToggleHUD'}[n]; e.preventDefault(); api.copyText(c); toast(`${c} kopiert – im Spiel einfügen.`); }; document.addEventListener('keydown', window._toolMacroHandler); }
  }
};

pages.screenshots = {
  title: 'Screenshots', icon: I.image || I.mods,
  async render() {
    const [r, saves] = await Promise.all([api.gallery.list(), api.saves.list()]);
    const slotFilter = pages.screenshots.slot || '';
    const items = (r.items || []).filter((x) => !slotFilter || x.tags?.savegame === slotFilter);
    view.innerHTML = head('Screenshot-Galerie', 'Bilder mit Hof-, Karten- und Spielstand-Kontext versehen und vergleichen.', `<button class="btn" id="ss-open">Ordner öffnen</button>`) +
      `<div class="toolbar"><select class="input" id="ss-filter"><option value="">Alle Spielstände</option>${(saves.items || []).map((s) => `<option value="${esc(s.slot)}" ${slotFilter === s.slot ? 'selected' : ''}>${esc(s.slot)} · ${esc(s.name)}</option>`).join('')}</select><select class="input" id="ss-left"><option value="">Vorher-Bild wählen</option>${r.items.map((x) => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('')}</select><select class="input" id="ss-right"><option value="">Nachher-Bild wählen</option>${r.items.map((x) => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('')}</select><button class="btn" id="ss-compare">Vergleichen</button></div>
      <div class="note" style="margin:0 0 14px">${esc(r.dir)} · Kontext wird als Agri Nexus JSON-Begleitdatei neben dem Bild gespeichert.</div><div class="shot-grid">${items.length ? items.map((x) => `<article class="card shot"><img src="" loading="lazy" data-shot="${esc(x.name)}" alt="${esc(x.name)}"><b title="${esc(x.name)}">${esc(x.name)}</b><small>${fmtDate(x.mtime)}${x.tags ? ` · ${esc(x.tags.profile || '')} · ${esc(x.tags.map || '')} · ${esc(x.tags.savegame || '')}` : ''}</small><div class="pc-actions"><button class="btn sm" data-tagshot="${esc(x.name)}">Kontext übernehmen</button><button class="btn sm" data-copyshot="${esc(x.name)}">Kopieren</button><button class="btn sm" data-revealshot="${esc(x.name)}">Teilen / öffnen</button></div></article>`).join('') : emptyBox('Keine Screenshots gefunden', 'Der Ordner screenshots im FarmingSimulator2025-Profil ist leer.')}</div>`;
    document.getElementById('ss-open').onclick = () => api.gallery.open();
    document.getElementById('ss-filter').onchange = (e) => { pages.screenshots.slot = e.target.value; pages.screenshots.render(); };
    document.getElementById('ss-compare').onclick = async () => {
      const left = document.getElementById('ss-left').value, right = document.getElementById('ss-right').value;
      if (!left || !right) return toast('Bitte zwei Screenshots für den Vergleich wählen.', true);
      const [a, b] = await Promise.all([api.gallery.image(left), api.gallery.image(right)]);
      openModal(`<h2>Vorher / Nachher</h2><div class="g-2"><figure><img style="width:100%;border-radius:12px" src="${a}" alt=""><figcaption>${esc(left)}</figcaption></figure><figure><img style="width:100%;border-radius:12px" src="${b}" alt=""><figcaption>${esc(right)}</figcaption></figure></div><div class="modal-actions"><button class="btn primary" data-close>Schließen</button></div>`, true).el.querySelector('[data-close]').onclick = (e) => e.currentTarget.closest('.overlay').remove();
    };
    const screenshotObserver = new IntersectionObserver((entries, observer) => { for (const entry of entries) if (entry.isIntersecting) { const img = entry.target; observer.unobserve(img); api.gallery.image(img.dataset.shot).then((src) => { if (img.isConnected) img.src = src; }); } }, { root: document.querySelector('.content'), rootMargin: '180px' });
    view.querySelectorAll('[data-shot]').forEach((img) => screenshotObserver.observe(img));
    view.querySelectorAll('[data-copyshot]').forEach((b) => b.onclick = async () => toast(await api.gallery.copy(b.dataset.copyshot) ? 'Bild in die Zwischenablage kopiert.' : 'Bild konnte nicht kopiert werden.', false));
    view.querySelectorAll('[data-revealshot]').forEach((b) => b.onclick = () => api.gallery.reveal(b.dataset.revealshot));
    view.querySelectorAll('[data-tagshot]').forEach((b) => b.onclick = async () => { const s = activeProfile().savegame || ''; const savegame = prompt('Spielstand (z. B. savegame1):', s); if (savegame === null) return; const mapName = (saves.items || []).find((x) => x.slot === savegame)?.map || ''; const map = prompt('Kartenname:', mapName) || ''; const result = await api.gallery.tag(b.dataset.tagshot, { savegame, map }); if (!result.ok) toast(result.error, true); else { toast('Kontext-Tags gespeichert.'); pages.screenshots.render(); } });
  }
};

// RP lobby, farm roles, contracts, and admin controls.
let rpPeer = null, rpHost = false, rpState = null, rpConnections = new Map(), rpMemberId = '', rpName = 'Spieler', rpSaveSyncUrl = '', rpSaveSyncTimer = null;
function rpBlank() { return { locked: false, server: { ip: '', port: '10823', password: '' }, rules: 'Bitte respektvoll spielen und die Serverregeln beachten.', members: [], farms: [], tasks: [], fieldMarkers: [], deliveries: [], events: [], rentals: [] }; }
function rpSend(conn, payload) { try { conn.send(payload); } catch {} }
async function rpDownloadSavegame() {
  if (!rpHost || !rpSaveSyncUrl) return;
  const result = await api.rp.syncSavegame(rpSaveSyncUrl);
  const el = document.getElementById('rp-save-sync-status');
  if (el) el.textContent = result.ok ? `Aktualisiert ${fmtDate(result.downloadedAt)} · ${fmtSize(result.bytes)}` : result.error;
  if (!result.ok) toast('Admin-Savegame-Sync: ' + result.error, true);
}
function rpPublish() { if (!rpHost) return; for (const c of rpConnections.values()) rpSend(c, { type: 'snapshot', state: rpState }); renderRP(); }
function rpApplyAction(conn, m) {
  if (!rpHost || !rpState || !m || !m.action) return;
  const actor = rpState.members.find((x) => x.id === conn.peer), managed = (farmId) => actor && (actor.role === 'Admin' || (actor.role === 'Hofleiter' && actor.farmId === farmId));
  if (actor && !actor.acceptedRules && m.action !== 'acceptRules') { rpSend(conn, { type: 'notice', text: 'Bitte zuerst die Serverregeln bestätigen.' }); return; }
  if (m.action === 'joinFarm') { const member = actor; if (member && rpState.farms.some((f) => f.id === m.farmId)) { member.farmId = m.farmId; member.role = 'Freiberufler'; } }
  if (m.action === 'acceptRules' && actor) actor.acceptedRules = true;
  if (m.action === 'createFarm' && actor && rpState.farms.length < 30 && String(m.name || '').trim() && !rpState.farms.some((f) => f.name.toLowerCase() === String(m.name).trim().toLowerCase())) {
    const id = 'farm-' + Date.now(); rpState.farms.push({ id, name: String(m.name).trim().slice(0, 60), balance: 100000, priceList: [], structures: [], roles: [] }); actor.farmId = id; actor.role = 'Hofleiter';
  }
  if (m.action === 'startShift' && actor && !actor.shiftStartedAt) actor.shiftStartedAt = Date.now();
  if (m.action === 'endShift' && actor?.shiftStartedAt) { const startedAt = actor.shiftStartedAt, endedAt = Date.now(), minutes = Math.max(1, Math.round((endedAt - startedAt) / 60000)); actor.workMinutes = (actor.workMinutes || 0) + minutes; (actor.workSessions ||= []).push({ startedAt, endedAt, minutes }); actor.shiftStartedAt = 0; }
  if (m.action === 'setRules' && actor?.role === 'Admin') rpState.rules = String(m.rules || '').slice(0, 2500);
  if (m.action === 'transfer') {
    const from = rpState.farms.find((f) => f.id === actor?.farmId), to = rpState.farms.find((f) => f.id === m.toFarmId), amount = Math.floor(Number(m.amount));
    if (from && to && from.id !== to.id && managed(from.id) && amount > 0 && amount <= from.balance) { from.balance -= amount; to.balance += amount; (rpState.transfers ||= []).unshift({ id: 'tx-' + Date.now(), from: from.id, to: to.id, amount, memo: String(m.memo || '').slice(0, 120), at: Date.now() }); }
  }
  if (m.action === 'addRental' && managed(actor?.farmId) && actor?.farmId) rpState.rentals.unshift({ id: 'rent-' + Date.now(), farmId: actor.farmId, machine: String(m.machine || '').slice(0, 80), hourly: Math.max(0, Number(m.hourly) || 0), listedBy: actor.id, bookedBy: '', hours: 0 });
  if (m.action === 'bookRental') {
    const item = rpState.rentals.find((x) => x.id === m.rentalId), farm = rpState.farms.find((x) => x.id === item?.farmId), hours = Math.min(168, Math.max(1, Number(m.hours) || 1)), renter = rpState.farms.find((x) => x.id === actor?.farmId);
    if (item && !item.bookedBy && renter && farm && renter.id !== farm.id && renter.balance >= item.hourly * hours) { renter.balance -= item.hourly * hours; farm.balance += item.hourly * hours; item.bookedBy = actor.id; item.hours = hours; }
  }
  if (m.action === 'addRate' && managed(actor?.farmId) && actor?.farmId) { const farm = rpState.farms.find((x) => x.id === actor.farmId); (farm.priceList ||= []).unshift({ service: String(m.service || '').slice(0, 80), price: Math.max(0, Number(m.price) || 0), unit: String(m.unit || 'ha').slice(0, 16) }); }
  if (m.action === 'addMarker' && managed(actor?.farmId) && actor?.farmId) rpState.fieldMarkers.unshift({ id: 'field-' + Date.now(), farmId: actor.farmId, field: String(m.field || '').slice(0, 40), crop: String(m.crop || '').slice(0, 50), note: String(m.note || '').slice(0, 140), author: actor.name });
  if (m.action === 'createDelivery' && managed(actor?.farmId) && actor?.farmId) rpState.deliveries.unshift({ id: 'delivery-' + Date.now(), fromFarm: actor.farmId, toFarm: String(m.toFarmId || ''), load: String(m.load || '').slice(0, 120), liters: Math.max(0, Number(m.liters) || 0), amount: Math.max(0, Number(m.amount) || 0), signed: false });
  if (m.action === 'signDelivery') { const d = rpState.deliveries.find((x) => x.id === m.deliveryId), receiver = rpState.farms.find((f) => f.id === d?.toFarm); const sender = rpState.farms.find((f) => f.id === d?.fromFarm); if (d && !d.signed && receiver && sender && managed(receiver.id) && receiver.balance >= d.amount) { receiver.balance -= d.amount; sender.balance += d.amount; d.signed = true; d.signedBy = actor.id; } }
  if (m.action === 'createEvent' && managed(actor?.farmId) && actor?.farmId) rpState.events.unshift({ id: 'event-' + Date.now(), farmId: actor.farmId, title: String(m.title || '').slice(0, 100), startsAt: String(m.startsAt || '').slice(0, 32), signups: [] });
  if (m.action === 'signupEvent') { const event = rpState.events.find((x) => x.id === m.eventId); if (event && !event.signups.some((x) => x.memberId === actor?.id)) event.signups.push({ memberId: actor.id, role: String(m.role || '').slice(0, 50) }); }
  if (m.action === 'applyTask') { const task = rpState.tasks.find((x) => x.id === m.taskId); if (task && task.status === 'Open') { task.assignedTo = conn.peer; task.status = 'In Progress'; } }
  if (m.action === 'createTask' && (managed(m.task?.farmId) || actor?.role === 'Admin')) {
    const raw = m.task || {};
    rpState.tasks.unshift({ id: 'task-' + Date.now(), title: String(raw.title || '').slice(0, 100), farmId: String(raw.farmId || ''), reward: Math.min(100000000, Math.max(0, Number(raw.reward) || 0)), field: String(raw.field || '').slice(0, 40), machinery: String(raw.machinery || '').slice(0, 160), screenshot: String(raw.screenshot || '').slice(0, 255), assignedTo: '', status: 'Open' });
  }
  if (m.action === 'assignTask') { const task = rpState.tasks.find((x) => x.id === m.taskId); if (task && managed(task.farmId) && rpState.members.some((x) => x.id === m.memberId && x.farmId === task.farmId)) { task.assignedTo = m.memberId; task.status = m.memberId ? 'In Progress' : 'Open'; } }
  if (m.action === 'completeTask') {
    const task = rpState.tasks.find((x) => x.id === m.taskId), employer = rpState.farms.find((x) => x.id === task?.farmId), worker = rpState.members.find((x) => x.id === task?.assignedTo), workerFarm = rpState.farms.find((x) => x.id === worker?.farmId);
    if (task && task.status !== 'Completed' && task.assignedTo && managed(task.farmId) && employer && workerFarm && employer.balance >= task.reward) { employer.balance -= task.reward; workerFarm.balance += task.reward; task.status = 'Completed'; }
  }
  if (m.action === 'attachScreenshot') { const task = rpState.tasks.find((x) => x.id === m.taskId); if (task && managed(task.farmId)) task.screenshot = String(m.screenshot || '').slice(0, 255); }
  if (m.action === 'deleteTask') { const task = rpState.tasks.find((x) => x.id === m.taskId); if (task && managed(task.farmId)) rpState.tasks = rpState.tasks.filter((x) => x.id !== m.taskId); }
  rpPublish();
}
function rpHandle(conn, msg) {
  if (msg?.type === 'hello' && rpHost) {
    if (rpState.locked) { rpSend(conn, { type: 'kick', reason: 'Lobby ist gesperrt.' }); conn.close(); return; }
    const member = { id: conn.peer, name: String(msg.name || 'Spieler').slice(0, 32), farmId: '', role: 'Freiberufler', acceptedRules: false, workMinutes: 0, shiftStartedAt: 0 };
    rpState.members = rpState.members.filter((x) => x.id !== conn.peer).concat(member); rpSend(conn, { type: 'snapshot', state: rpState }); rpPublish(); return;
  }
  if (msg?.type === 'action' && rpHost) return rpApplyAction(conn, msg);
  if (msg?.type === 'snapshot' && !rpHost) { rpState = msg.state; renderRP(); return; }
  if (msg?.type === 'notice' && !rpHost) { toast(msg.text || 'Lobby-Aktion nicht erlaubt.', true); return; }
  if (msg?.type === 'kick' && !rpHost) { toast(msg.reason || 'Du wurdest aus der Lobby entfernt.', true); try { rpConn?.close(); rpPeer?.destroy(); } catch {} rpState = null; rpHost = false; renderRP(); return; }
  if (msg?.type === 'sync-mods' && !rpHost) { rpSyncClient(conn, msg.items || []); return; }
  if (msg?.type === 'mod-request' && rpHost) { rpSendMod(conn, msg.name); return; }
  if (msg?.type === 'mod-sync-total' && rpHost) { if (msg.total > 0) rpStartPending.add(conn.peer); else { rpStartPending.delete(conn.peer); if (rpStartPending.size === 0 && rpStarting) rpLaunchSession(); } return; }
  if (msg?.type === 'mod-sync-done' && rpHost) { rpStartPending.delete(conn.peer); if (rpStartPending.size === 0 && rpStarting) rpLaunchSession(); return; }
  if (msg?.type === 'mod-sync-failed' && rpHost) { rpStarting = false; rpStartPending.clear(); toast(`${msg.name || 'Ein Client'}: Mod-Sync fehlgeschlagen. Session nicht gestartet.`, true); return; }
  if (msg?.type === 'mod-start' && !rpHost) { rpStartReceive(msg); return; }
  if (msg?.type === 'mod-chunk' && !rpHost) { rpReceiveChunk(conn, msg); return; }
  if (msg?.type === 'mod-end' && !rpHost) { rpFinishReceive(conn); return; }
  if (msg?.type === 'launch-session' && !rpHost) {
    toast(`RP-Session startet. Server: ${msg.server.ip}:${msg.server.port}. Öffne Multiplayer und suche den Server; ein Direktbeitritt per IP ist nicht verfügbar.`, true);
    api.launch().then((r) => { if (!r.ok) toast(r.error, true); }); return;
  }
}
let rpConn = null, rpReceiveToken = '', rpReceiveSize = 0, rpReceiveName = '';
let rpSyncQueue = [], rpSyncExpected = 0, rpSyncReceived = 0, rpStartPending = new Set(), rpStarting = false;
async function rpSyncClient(conn, hostItems) {
  const local = await api.sync.manifest(), map = new Map(local.items.map((x) => [x.name.toLowerCase(), x]));
  rpSyncQueue = hostItems.filter((x) => !map.has(x.name.toLowerCase()) || map.get(x.name.toLowerCase()).sha256 !== x.sha256);
  rpSyncExpected = rpSyncQueue.length; rpSyncReceived = 0;
  rpSend(conn, { type: 'mod-sync-total', total: rpSyncExpected });
  if (rpSyncQueue.length) rpSend(conn, { type: 'mod-request', name: rpSyncQueue.shift().name });
  else rpSend(conn, { type: 'mod-sync-done' });
  const missing = rpSyncExpected;
  toast(`${missing} Mods werden für die RP-Lobby synchronisiert.`);
}
async function rpSendMod(conn, name) {
  const manifest = await api.sync.manifest(), meta = manifest.items.find((x) => x.name === name); if (!meta) return;
  rpSend(conn, { type: 'mod-start', name, size: meta.size });
  for (let offset = 0; offset < meta.size; offset += 48 * 1024) {
    rpSend(conn, { type: 'mod-chunk', data: await api.sync.read(name, offset, Math.min(48 * 1024, meta.size - offset)) });
    while (conn.dataChannel && conn.dataChannel.bufferedAmount > 1024 * 1024) await new Promise((r) => setTimeout(r, 40));
  }
  rpSend(conn, { type: 'mod-end' });
}
async function rpStartReceive(msg) { rpReceiveName = msg.name; rpReceiveSize = msg.size; rpReceiveToken = await api.sync.begin(msg.name, msg.size); }
async function rpReceiveChunk(conn, msg) { if (rpReceiveToken) await api.sync.chunk(rpReceiveToken, msg.data); }
async function rpFinishReceive(conn) {
  if (!rpReceiveToken) return;
  const r = await api.sync.finish(rpReceiveToken); rpReceiveToken = '';
  if (!r.ok) { toast(r.error, true); rpSend(conn, { type: 'mod-sync-failed', name: rpReceiveName }); return; }
  rpSyncReceived++;
  if (rpSyncQueue.length) rpSend(conn, { type: 'mod-request', name: rpSyncQueue.shift().name });
  else rpSend(conn, { type: 'mod-sync-done' });
  toast(`Synchronisiert: ${r.file}`);
}
async function rpLaunchSession() {
  if (!rpHost || !rpStarting || rpStartPending.size) return;
  rpStarting = false;
  for (const c of rpConnections.values()) rpSend(c, { type: 'launch-session', server: rpState.server });
  const launch = await api.launch(); if (!launch.ok) toast(launch.error, true);
  toast('Spiel gestartet. Der Multiplayer-Server muss im Spielbrowser ausgewählt werden.');
}
function rpCreateConn(conn) {
  conn.on('open', () => { if (!rpHost) rpSend(conn, { type: 'hello', name: rpName }); });
  conn.on('data', (m) => rpHandle(conn, m));
  conn.on('close', () => { rpConnections.delete(conn.peer); rpStartPending.delete(conn.peer); if (rpHost && rpState) { rpState.members = rpState.members.filter((x) => x.id !== conn.peer); rpPublish(); if (rpStarting && rpStartPending.size === 0) rpLaunchSession(); } });
  if (rpHost) rpConnections.set(conn.peer, conn);
}

pages.rp = {
  title: 'RP & Party Network', icon: I.server,
  async render() { await renderRP(); }
};
async function renderRP() {
  if (page !== 'rp') return;
  if (!rpState) {
    view.innerHTML = head('RP & Party Network', 'Lobbys, Hofrollen und Arbeitsverträge für gemeinsame RP-Sessions.') +
      `<div class="card"><h2>Lobby betreten oder hosten</h2><div class="form-row"><div class="field"><label>Dein Spielername</label><input class="input" id="rp-name" maxlength="32" value="${esc(rpName)}"></div><div class="field"><label>Raumcode</label><input class="input mono" id="rp-code" maxlength="6" placeholder="6 Ziffern"></div></div><div class="pc-actions"><button class="btn primary" id="rp-host">Lobby erstellen (Admin)</button><button class="btn" id="rp-join">Lobby beitreten</button></div><p class="note">Verbindungen werden per WebRTC aufgebaut. Ein Host muss für andere Teilnehmer erreichbar sein.</p></div>`;
    q('#rp-name').oninput = (e) => rpName = e.target.value.trim().slice(0, 32) || 'Spieler';
    q('#rp-host').onclick = () => {
      if (typeof Peer === 'undefined') return toast('PeerJS ist nicht geladen. Bitte Agri Nexus neu starten oder den Build aktualisieren.', true);
      rpName = q('#rp-name').value.trim() || 'Host'; rpHost = true; rpState = rpBlank();
      try { rpPeer = new Peer('RPX' + String(Math.floor(100000 + Math.random() * 900000))); }
      catch (err) { rpHost = false; rpState = null; return toast('Lobby konnte nicht erstellt werden: ' + err.message, true); }
      q('#rp-host').disabled = true; rpPeer.on('open', (id) => { rpMemberId = id; rpState.members = [{ id, name: rpName, farmId: '', role: 'Admin', acceptedRules: true, workMinutes: 0, shiftStartedAt: 0 }]; renderRP(); });
      rpPeer.on('connection', (conn) => rpCreateConn(conn)); rpPeer.on('error', (e) => { toast(`Lobby-Fehler (${e.type || 'Verbindung'}): ${e.message || 'PeerJS-Server nicht erreichbar.'}`, true); if (!rpMemberId) { rpHost = false; rpState = null; try { rpPeer.destroy(); } catch {} renderRP(); } });
    };
    q('#rp-join').onclick = () => {
      if (typeof Peer === 'undefined') return toast('PeerJS ist nicht geladen. Bitte Agri Nexus neu starten oder den Build aktualisieren.', true);
      const code = q('#rp-code').value.replace(/\D/g, ''); if (code.length !== 6) return toast('Raumcode muss aus sechs Ziffern bestehen.', true);
      rpName = q('#rp-name').value.trim() || 'Spieler'; rpHost = false; rpPeer = new Peer();
      rpPeer.on('open', (id) => { rpMemberId = id; rpConn = rpPeer.connect('RPX' + code, { reliable: true }); rpCreateConn(rpConn); }); rpPeer.on('error', (e) => toast('Lobby-Fehler: ' + e.type, true));
      view.innerHTML = head('RP & Party Network', 'Verbinde mit der Lobby …');
    };
    return;
  }
  const admin = rpHost;
  const farms = rpState.farms || [], tasks = rpState.tasks || [], members = rpState.members || [];
  const localMember = members.find((m) => m.id === rpMemberId);
  const canManageFarm = (farmId) => admin || (localMember?.role === 'Hofleiter' && localMember.farmId === farmId);
  const manageableFarms = admin ? farms : farms.filter((f) => canManageFarm(f.id));
  const canPostTasks = admin || manageableFarms.length > 0;
  const memberName = (id) => members.find((m) => m.id === id)?.name || 'Unbekannt';
  const gallery = await api.gallery.list();
  const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weeklyHours = (m) => ((m.workSessions || []).filter((x) => x.startedAt >= weekStart.getTime()).reduce((sum, x) => sum + x.minutes, 0) + (m.shiftStartedAt >= weekStart.getTime() ? Math.max(0, (Date.now() - m.shiftStartedAt) / 60000) : 0)) / 60;
  const accepted = admin || !!localMember?.acceptedRules;
  const myFarm = farms.find((f) => f.id === localMember?.farmId);
  view.innerHTML = head('RP & Party Network', `${admin ? 'Admin' : 'Mitglied'} · Raum ${esc(rpPeer?.id?.replace(/^RPX/, '') || '')}`, admin ? `<button class="btn primary" id="rp-start">Start RP Session</button><button class="btn" id="rp-lock">${rpState.locked ? 'Lobby entsperren' : 'Lobby sperren'}</button>` : '') +
   `<div class="g-2"><div class="card"><h2>Lobby &amp; Server</h2><p>${members.length} Spieler · ${rpState.locked ? 'gesperrt' : 'offen'}</p>${admin ? `<div class="form-row"><div class="field"><label>Server-IP / Hostname</label><input class="input" id="rp-ip" value="${esc(rpState.server.ip)}" placeholder="server.example.net"></div><div class="field"><label>Port</label><input class="input" id="rp-port" value="${esc(rpState.server.port)}" placeholder="10823"></div></div><div class="field"><label>Spielpasswort</label><input class="input" id="rp-password" type="password" value="${esc(rpState.server.password)}"></div><button class="btn" id="rp-save-server">Serverdaten speichern</button>` : `<p>Server: ${esc(rpState.server.ip || 'noch nicht gesetzt')}:${esc(rpState.server.port)} · Passwort ${esc(rpState.server.password || 'nicht gesetzt')}</p>`}<div class="status-row"><span class="grow"><b>Mitglieder</b>${members.map((m) => `<small>${esc(m.name)} · ${esc(m.role)}${m.farmId ? ' · ' + esc(farms.find((f) => f.id === m.farmId)?.name || '') : ''}</small>`).join('')}</span>${admin ? members.filter((m) => m.id !== rpMemberId).map((m) => `<button class="btn sm danger" data-rp-kick="${esc(m.id)}">Kick ${esc(m.name)}</button>`).join('') : ''}</div></div>
   <div class="card"><h2>Höfe &amp; Rollen</h2>${admin ? `<div class="toolbar"><input class="input" id="rp-farm-name" placeholder="Hof Erlengrat"><button class="btn" id="rp-add-farm">Hof erstellen</button><input class="input" id="rp-structure" placeholder="Gebäude / Struktur"><button class="btn" id="rp-add-structure">Struktur hinzufügen</button></div>` : ''}${farms.map((f) => `<div class="status-row"><span class="grow"><b>${esc(f.name)}</b><small>${(f.structures || []).map(esc).join(' · ') || 'Keine Strukturen'} · ${members.filter((m) => m.farmId === f.id).length} Spieler</small></span>${!admin ? `<button class="btn sm" data-rp-joinfarm="${esc(f.id)}">Hof beitreten</button>` : `<select class="input" data-rp-farm="${esc(f.id)}"><option value="">Spieler zuweisen …</option>${members.filter((m) => m.id !== rpMemberId).map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}</select>`}</div>`).join('') || emptyBox('Noch keine Höfe', 'Der Admin kann den ersten Hof erstellen.')}${admin ? members.filter((m) => m.id !== rpMemberId && m.farmId).map((m) => `<div class="toolbar"><span>${esc(m.name)} · ${esc(farms.find((f) => f.id === m.farmId)?.name || '')}</span><select class="input" data-rp-role="${esc(m.id)}"><option ${m.role === 'Hofleiter' ? 'selected' : ''}>Hofleiter</option><option ${m.role === 'Mitarbeiter' ? 'selected' : ''}>Mitarbeiter</option><option ${m.role === 'Freiberufler' ? 'selected' : ''}>Freiberufler</option></select></div>`).join('') : ''}</div></div>
   <div class="card" style="margin-top:16px"><h2>Task Board · Arbeitsverträge</h2>${canPostTasks ? `<div class="form-row"><div class="field"><label>Auftrag</label><input class="input" id="rp-task-title" placeholder="Feld-Ernte / Ballentransport"></div><div class="field"><label>Hof</label><select class="input" id="rp-task-farm">${manageableFarms.map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}</select></div><div class="field"><label>Belohnung (€)</label><input class="input" id="rp-task-reward" type="number" min="0" value="500"></div><div class="field"><label>Ziel-Feld</label><input class="input" id="rp-task-field" placeholder="Feld 12"></div><div class="field"><label>Benötigte Maschinen</label><input class="input" id="rp-task-machinery" placeholder="Mähdrescher, Anhänger"></div><div class="field"><label>Abschluss-Screenshot</label><select class="input" id="rp-task-shot"><option value="">Keiner</option>${gallery.items.map((x) => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('')}</select></div></div><button class="btn primary" id="rp-add-task">Vertrag veröffentlichen</button>` : ''}<div class="rp-task-grid">${tasks.map((t) => `<article class="card"><div class="pc-tags"><span class="tag">${esc(t.status)}</span><span class="tag">${esc(farms.find((f) => f.id === t.farmId)?.name || 'Hof')}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.details || '')}</p><div class="pc-info"><dt>Belohnung</dt><dd>${eur(t.reward)}</dd><dt>Feld</dt><dd>${esc(t.field || '–')}</dd><dt>Maschinen</dt><dd>${esc(t.machinery || '–')}</dd><dt>Zugewiesen</dt><dd>${esc(t.assignedTo ? memberName(t.assignedTo) : 'Offen')}</dd></div>${t.screenshot ? `<button class="btn sm" data-rp-shot="${esc(t.screenshot)}">Abschlussbild: ${esc(t.screenshot)}</button>` : ''}${t.status === 'Completed' && canManageFarm(t.farmId) ? `<select class="input" data-rp-shotselect="${esc(t.id)}"><option value="">Screenshot anhängen …</option>${gallery.items.map((x) => `<option value="${esc(x.name)}" ${x.name === t.screenshot ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}${canManageFarm(t.farmId) ? `<div class="pc-actions"><select class="input" data-rp-assign="${esc(t.id)}"><option value="">Spieler zuweisen …</option>${members.filter((m) => m.farmId === t.farmId).map((m) => `<option value="${esc(m.id)}" ${m.id === t.assignedTo ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select><button class="btn sm" data-rp-complete="${esc(t.id)}">Abschließen</button><button class="btn sm danger" data-rp-delete="${esc(t.id)}">Entfernen</button></div>` : t.status === 'Open' ? `<button class="btn sm" data-rp-apply="${esc(t.id)}">Auftrag annehmen</button>` : ''}</article>`).join('') || emptyBox('Keine Verträge', 'Veröffentliche einen Auftrag für die Höfe.')}</div></div>`;
  if (admin && q('#rp-structure')) {
    q('#rp-structure').insertAdjacentHTML('beforebegin', '<select class="input" id="rp-structure-farm"></select>');
    q('#rp-structure-farm').innerHTML = farms.map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
  }
  const rpAct = (action, data = {}) => admin ? rpApplyAction({ peer: rpMemberId }, { action, ...data }) : rpSend(rpConn, { type: 'action', action, ...data });
  const farmOptionList = (exclude = '') => farms.filter((f) => f.id !== exclude).map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
  const showRulesGate = !accepted;
  view.insertAdjacentHTML('beforeend', `<div class="card" style="margin-top:16px"><h2>Whitelist &amp; Schicht</h2><p class="desc-box">${esc(rpState.rules || 'Keine zusätzlichen Regeln hinterlegt.')}</p>${admin ? `<textarea class="input" id="rp-rules" maxlength="2500" placeholder="Serverregeln">${esc(rpState.rules)}</textarea><button class="btn" id="rp-save-rules">Regeln speichern</button>` : showRulesGate ? `<label class="setting"><span>Ich habe die Serverregeln gelesen und akzeptiere sie.</span><input type="checkbox" id="rp-accept-rules"></label><button class="btn primary" id="rp-confirm-rules" disabled>Regeln bestätigen</button>` : '<span class="chip ok"><i></i>Regeln bestätigt</span>'}<p class="note">${localMember?.shiftStartedAt ? 'Schicht läuft seit ' + fmtDate(localMember.shiftStartedAt) : 'Keine aktive Schicht'}</p><button class="btn" id="rp-shift">${localMember?.shiftStartedAt ? 'Schicht beenden' : 'Schicht beginnen'}</button>${myFarm ? `<span class="chip">${esc(myFarm.name)} · Funkkanal-Vorschlag: ${esc(myFarm.voiceChannel || 'Funkkanal ' + myFarm.name)}</span>` : ''}</div>
    <div class="g-2" style="margin-top:16px"><div class="card"><h2>Hofkonten &amp; Überweisungen</h2>${farms.map((f) => `<div class="status-row"><span class="grow"><b>${esc(f.name)}</b><small>Virtuelles Guthaben</small></span><strong>${eur(f.balance || 0)}</strong></div>`).join('') || '<p>Noch keine Höfe.</p>'}${myFarm ? `<div class="form-row"><select class="input" id="rp-pay-to">${farmOptionList(myFarm.id)}</select><input class="input" id="rp-pay-amount" type="number" min="1" placeholder="Betrag €"><input class="input" id="rp-pay-memo" placeholder="Verwendungszweck"><button class="btn" id="rp-transfer">Überweisen</button></div>` : ''}<small>Letzte Transfers: ${(rpState.transfers || []).slice(0, 5).map((x) => `${esc(farms.find((f) => f.id === x.from)?.name || '')} → ${esc(farms.find((f) => f.id === x.to)?.name || '')}: ${eur(x.amount)} ${esc(x.memo)}`).join(' · ') || 'Keine'}</small></div>
    <div class="card"><h2>Fuhrpark &amp; LU-Preisliste</h2>${canManageFarm(myFarm?.id) ? `<div class="form-row"><input class="input" id="rp-rent-machine" placeholder="Drescher Claas Lexion"><input class="input" id="rp-rent-rate" type="number" min="0" placeholder="€/Ingame-Stunde"><button class="btn" id="rp-rent-add">Zur Miete anbieten</button></div><div class="form-row"><input class="input" id="rp-rate-service" placeholder="Gülle ausbringen"><input class="input" id="rp-rate-price" type="number" min="0" placeholder="€/ha"><button class="btn" id="rp-rate-add">Preis veröffentlichen</button></div>` : ''}<h3>Maschinenangebote</h3>${(rpState.rentals || []).map((r) => `<div class="status-row"><span class="grow">${esc(r.machine)} · ${eur(r.hourly)} / Ingame-Stunde · ${esc(farms.find((f) => f.id === r.farmId)?.name || '')}${r.bookedBy ? ' · gebucht' : ''}</span>${!r.bookedBy && myFarm?.id !== r.farmId ? `<input class="input" type="number" min="1" max="168" value="1" data-rent-hours="${esc(r.id)}"><button class="btn sm" data-rent-book="${esc(r.id)}">Buchen</button>` : ''}</div>`).join('') || '<p>Keine Maschinen gelistet.</p>'}<h3>Preisliste</h3>${farms.map((f) => (f.priceList || []).map((x) => `<div class="status-row"><span class="grow">${esc(f.name)} · ${esc(x.service)}</span><strong>${eur(x.price)} / ${esc(x.unit)}</strong></div>`).join('')).join('') || '<p>Noch keine Preise.</p>'}</div>
    <div class="card"><h2>Feldübersicht</h2><p class="note">Gemeinsame Feldliste (keine georeferenzierte Spielkarte).</p>${canManageFarm(myFarm?.id) ? `<div class="form-row"><input class="input" id="rp-field-number" placeholder="Feld 12"><input class="input" id="rp-field-crop" placeholder="Weizen"><input class="input" id="rp-field-note" placeholder="LU Schmidt baut ab"><button class="btn" id="rp-field-add">Markierung setzen</button></div>` : ''}${(rpState.fieldMarkers || []).map((x) => `<div class="status-row"><span class="grow"><b>${esc(x.field)} · ${esc(x.crop)}</b><small>${esc(farms.find((f) => f.id === x.farmId)?.name || '')} · ${esc(x.note)} · ${esc(x.author)}</small></span></div>`).join('') || '<p>Keine Feldmarkierungen.</p>'}</div>
    <div class="card"><h2>Lieferscheine</h2>${canManageFarm(myFarm?.id) ? `<div class="form-row"><select class="input" id="rp-delivery-to">${farmOptionList(myFarm.id)}</select><input class="input" id="rp-delivery-load" placeholder="Silage"><input class="input" id="rp-delivery-liters" type="number" min="0" placeholder="Liter"><input class="input" id="rp-delivery-amount" type="number" min="0" placeholder="Zahlung €"><button class="btn" id="rp-delivery-add">Lieferschein erstellen</button></div>` : ''}${(rpState.deliveries || []).map((d) => `<div class="status-row"><span class="grow">${esc(farms.find((f) => f.id === d.fromFarm)?.name || '')} → ${esc(farms.find((f) => f.id === d.toFarm)?.name || '')}: ${fmtNum(d.liters)} L ${esc(d.load)} · ${eur(d.amount)} · ${d.signed ? 'gegengezeichnet' : 'offen'}</span>${!d.signed && canManageFarm(d.toFarm) ? `<button class="btn sm" data-delivery-sign="${esc(d.id)}">Gegenzeichnen &amp; zahlen</button>` : ''}</div>`).join('') || '<p>Keine Lieferscheine.</p>'}</div>
    <div class="card"><h2>Schichtplan &amp; Mitarbeiter</h2>${admin ? `<div class="form-row"><input class="input" id="rp-event-title" placeholder="Große Häckselkette"><input class="input" id="rp-event-time" type="datetime-local"><button class="btn" id="rp-event-add">Termin erstellen</button></div>` : ''}<div class="rp-task-grid">${(rpState.events || []).map((e) => `<article class="card"><b>${esc(e.title)}</b><small>${esc(e.startsAt)} · ${esc(farms.find((f) => f.id === e.farmId)?.name || '')}</small><div class="pc-actions"><input class="input" placeholder="Rolle, z. B. Walzer" data-event-role="${esc(e.id)}"><button class="btn sm" data-event-sign="${esc(e.id)}">Eintragen</button></div><small>${(e.signups || []).map((x) => `${esc(members.find((m) => m.id === x.memberId)?.name || '')}: ${esc(x.role)}`).join(' · ')}</small></article>`).join('') || '<p>Keine Termine geplant.</p>'}</div>${admin ? `<h3>Wochenstunden (seit Montag)</h3>${members.map((m) => `<div class="status-row"><span class="grow">${esc(m.name)} · ${esc(m.role)}</span><strong>${fmtNum(weeklyHours(m), 1)} h${m.shiftStartedAt ? ' + aktiv' : ''}</strong></div>`).join('')}` : ''}</div></div>`);
  if (!admin) view.insertAdjacentHTML('afterbegin', `<div class="card"><h2>Eigenen Hof gründen</h2><div class="toolbar"><input class="input" id="rp-new-farm" placeholder="LU Schmidt"><button class="btn" id="rp-create-farm">Hof erstellen</button></div></div>`);
  else {
    view.insertAdjacentHTML('afterbegin', `<div class="card"><h2>Admin-Savegame-Sync</h2><p class="note">HTTPS-Link zur aktuellen careerSavegame.xml. Agri Nexus lädt die Datei jetzt und minütlich neu, solange diese RP-Ansicht geöffnet ist.</p><div class="path-row"><input class="input mono" id="rp-save-url" placeholder="https://server.example/savegame.xml" value="${esc(rpSaveSyncUrl)}"><button class="btn" id="rp-save-url-start">URL speichern &amp; abrufen</button></div><small id="rp-save-sync-status"></small></div>`);
    q('#rp-save-url-start').onclick = async () => {
      rpSaveSyncUrl = q('#rp-save-url').value.trim();
      if (!/^https:\/\//i.test(rpSaveSyncUrl)) return toast('Bitte einen HTTPS-Link eintragen.', true);
      if (rpSaveSyncTimer) clearInterval(rpSaveSyncTimer);
      await rpDownloadSavegame(); rpSaveSyncTimer = setInterval(rpDownloadSavegame, 60000);
    };
    if (rpSaveSyncUrl && !rpSaveSyncTimer) rpSaveSyncTimer = setInterval(rpDownloadSavegame, 60000);
  }
  if (admin) {
    q('#rp-save-rules').onclick = () => rpAct('setRules', { rules: q('#rp-rules').value });
  } else {
    q('#rp-create-farm').onclick = () => rpAct('createFarm', { name: q('#rp-new-farm').value });
    q('#rp-accept-rules')?.addEventListener('change', (e) => { q('#rp-confirm-rules').disabled = !e.target.checked; });
    q('#rp-confirm-rules')?.addEventListener('click', () => rpAct('acceptRules'));
  }
  q('#rp-shift').onclick = () => rpAct(localMember?.shiftStartedAt ? 'endShift' : 'startShift');
  q('#rp-transfer')?.addEventListener('click', () => rpAct('transfer', { toFarmId: q('#rp-pay-to').value, amount: q('#rp-pay-amount').value, memo: q('#rp-pay-memo').value }));
  q('#rp-rent-add')?.addEventListener('click', () => rpAct('addRental', { machine: q('#rp-rent-machine').value, hourly: q('#rp-rent-rate').value }));
  q('#rp-rate-add')?.addEventListener('click', () => rpAct('addRate', { service: q('#rp-rate-service').value, price: q('#rp-rate-price').value, unit: 'ha' }));
  q('#rp-field-add')?.addEventListener('click', () => rpAct('addMarker', { field: q('#rp-field-number').value, crop: q('#rp-field-crop').value, note: q('#rp-field-note').value }));
  q('#rp-delivery-add')?.addEventListener('click', () => rpAct('createDelivery', { toFarmId: q('#rp-delivery-to').value, load: q('#rp-delivery-load').value, liters: q('#rp-delivery-liters').value, amount: q('#rp-delivery-amount').value }));
  view.querySelectorAll('[data-rent-book]').forEach((b) => b.onclick = () => rpAct('bookRental', { rentalId: b.dataset.rentBook, hours: view.querySelector(`[data-rent-hours="${b.dataset.rentBook}"]`).value }));
  view.querySelectorAll('[data-delivery-sign]').forEach((b) => b.onclick = () => rpAct('signDelivery', { deliveryId: b.dataset.deliverySign }));
  q('#rp-event-add')?.addEventListener('click', () => rpAct('createEvent', { title: q('#rp-event-title').value, startsAt: q('#rp-event-time').value }));
  view.querySelectorAll('[data-event-sign]').forEach((b) => b.onclick = () => rpAct('signupEvent', { eventId: b.dataset.eventSign, role: view.querySelector(`[data-event-role="${b.dataset.eventSign}"]`).value }));
  if (admin) {
    q('#rp-lock').onclick = () => { rpState.locked = !rpState.locked; rpPublish(); };
    q('#rp-save-server').onclick = () => { rpState.server = { ip: q('#rp-ip').value.trim(), port: q('#rp-port').value.trim() || '10823', password: q('#rp-password').value }; rpPublish(); };
    q('#rp-add-farm').onclick = () => { const name = q('#rp-farm-name').value.trim(); if (!name) return; const id = 'farm-' + Date.now(); rpState.farms.push({ id, name, balance: 100000, priceList: [], structures: [], roles: [] }); const host = rpState.members.find((m) => m.id === rpMemberId); if (host && !host.farmId) host.farmId = id; rpPublish(); };
    q('#rp-add-structure').onclick = () => { const farm = rpState.farms.find((f) => f.id === q('#rp-structure-farm').value), val = q('#rp-structure').value.trim(); if (farm && val) farm.structures.push(val); rpPublish(); };
    view.querySelectorAll('[data-rp-farm]').forEach((s) => s.onchange = () => { const m = rpState.members.find((x) => x.id === s.value); if (m) { m.farmId = s.dataset.rpFarm; m.role = 'Freiberufler'; } rpPublish(); });
    view.querySelectorAll('[data-rp-role]').forEach((s) => s.onchange = () => { const m = rpState.members.find((x) => x.id === s.dataset.rpRole); if (m) m.role = s.value; rpPublish(); });
    view.querySelectorAll('[data-rp-kick]').forEach((b) => b.onclick = () => { const c = rpConnections.get(b.dataset.rpKick); rpSend(c, { type: 'kick', reason: 'Vom Admin entfernt.' }); c?.close(); rpConnections.delete(b.dataset.rpKick); rpState.members = rpState.members.filter((m) => m.id !== b.dataset.rpKick); rpPublish(); });
    q('#rp-add-task')?.addEventListener('click', () => { const title = q('#rp-task-title').value.trim(); if (!title || !rpState.farms.length) return toast('Auftragstitel und mindestens ein Hof sind erforderlich.', true); rpAct('createTask', { task: { title, farmId: q('#rp-task-farm').value, reward: Number(q('#rp-task-reward').value) || 0, field: q('#rp-task-field').value.trim(), machinery: q('#rp-task-machinery').value.trim(), screenshot: q('#rp-task-shot').value } }); });
    view.querySelectorAll('[data-rp-assign]').forEach((s) => s.onchange = () => rpAct('assignTask', { taskId: s.dataset.rpAssign, memberId: s.value }));
    view.querySelectorAll('[data-rp-complete]').forEach((b) => b.onclick = () => rpAct('completeTask', { taskId: b.dataset.rpComplete }));
    view.querySelectorAll('[data-rp-delete]').forEach((b) => b.onclick = () => rpAct('deleteTask', { taskId: b.dataset.rpDelete }));
    view.querySelectorAll('[data-rp-shotselect]').forEach((s) => s.onchange = () => rpAct('attachScreenshot', { taskId: s.dataset.rpShotselect, screenshot: s.value }));
    q('#rp-start').onclick = async () => {
      const waitingRules = rpState.members.filter((m) => m.id !== rpMemberId && !m.acceptedRules);
      if (waitingRules.length) return toast('Warte auf Regelbestätigung von: ' + waitingRules.map((m) => m.name).join(', '), true);
      const manifest = await api.sync.manifest();
      if (!rpState.server.ip) return toast('Bitte zuerst Server-IP und Port eintragen.', true);
      rpStarting = true; rpStartPending = new Set(rpConnections.keys());
      for (const c of rpConnections.values()) rpSend(c, { type: 'sync-mods', items: manifest.items });
      if (!rpStartPending.size) await rpLaunchSession();
      else toast('Mod-Abgleich läuft. Das Spiel startet nach Abschluss auf allen verbundenen Clients.');
    };
  } else {
    view.querySelectorAll('[data-rp-joinfarm]').forEach((b) => b.onclick = () => rpSend(rpConn, { type: 'action', action: 'joinFarm', farmId: b.dataset.rpJoinfarm }));
    view.querySelectorAll('[data-rp-apply]').forEach((b) => b.onclick = () => rpSend(rpConn, { type: 'action', action: 'applyTask', taskId: b.dataset.rpApply }));
    q('#rp-add-task')?.addEventListener('click', () => {
      const title = q('#rp-task-title').value.trim(); if (!title) return toast('Auftragstitel fehlt.', true);
      rpSend(rpConn, { type: 'action', action: 'createTask', task: { title, farmId: q('#rp-task-farm').value, reward: Number(q('#rp-task-reward').value) || 0, field: q('#rp-task-field').value.trim(), machinery: q('#rp-task-machinery').value.trim(), screenshot: q('#rp-task-shot').value } });
    });
    view.querySelectorAll('[data-rp-assign]').forEach((s) => s.onchange = () => rpSend(rpConn, { type: 'action', action: 'assignTask', taskId: s.dataset.rpAssign, memberId: s.value }));
    view.querySelectorAll('[data-rp-complete]').forEach((b) => b.onclick = () => rpSend(rpConn, { type: 'action', action: 'completeTask', taskId: b.dataset.rpComplete }));
    view.querySelectorAll('[data-rp-delete]').forEach((b) => b.onclick = () => rpSend(rpConn, { type: 'action', action: 'deleteTask', taskId: b.dataset.rpDelete }));
    view.querySelectorAll('[data-rp-shotselect]').forEach((s) => s.onchange = () => rpSend(rpConn, { type: 'action', action: 'attachScreenshot', taskId: s.dataset.rpShotselect, screenshot: s.value }));
  }
  view.querySelectorAll('[data-rp-shot]').forEach((b) => b.onclick = () => api.gallery.reveal(b.dataset.rpShot));
}

// ---------------------------------------------------------------------------
// Navigation & Start
// ---------------------------------------------------------------------------

const NAV = [
  ['', ['start', 'profiles', 'mods', 'saves']],
  ['Community', ['rp', 'partners']],
  ['Werkzeuge', ['companion', 'log', 'calc', 'status']],
  ['Medien', ['screenshots']],
  ['System', ['settings', 'about']]
];

function buildNav() {
  nav.innerHTML =
    NAV.map(
      ([label, keys]) =>
        (label ? `<div class="nav-label">${label}</div>` : '') +
        keys.map((k) => `<button class="nav-item" data-page="${k}">${pages[k].icon}<span>${pages[k].title}</span></button>`).join('')
    ).join('') + '<div class="nav-spacer"></div><div class="nav-foot">Version 1.0.3-beta · MIT</div>';
  nav.querySelectorAll('[data-page]').forEach((b) => (b.onclick = () => go(b.dataset.page)));
}

function go(p) {
  if (p !== 'companion' && window._toolMacroHandler) { document.removeEventListener('keydown', window._toolMacroHandler); window._toolMacroHandler = null; }
  clearTimers();
  if (p !== 'rp' && rpSaveSyncTimer) { clearInterval(rpSaveSyncTimer); rpSaveSyncTimer = null; }
  page = p;
  nav.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === p));
  document.querySelector('.content').scrollTop = 0;
  view.style.animation = 'none';
  void view.offsetWidth;
  view.style.animation = '';
  pages[p].render();
}

document.addEventListener('click', (e) => {
  const ext = e.target.closest('[data-ext]');
  if (ext) {
    e.preventDefault();
    api.openExternal(ext.dataset.ext);
    return;
  }
  const goto = e.target.closest('[data-go]');
  if (goto) {
    e.preventDefault();
    go(goto.dataset.go);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const overlays = document.querySelectorAll('#modal-root .overlay');
    if (overlays.length) overlays[overlays.length - 1].remove();
  }
});

document.getElementById('tb-min').onclick = () => api.win.minimize();
document.getElementById('tb-max').onclick = () => api.win.toggleMaximize();
document.getElementById('tb-close').onclick = () => api.win.close();

let updaterUiState = { status: 'idle' };
const updateBanner = document.getElementById('update-banner');
const updateMessage = document.getElementById('update-message');
const updateAction = document.getElementById('update-action');
function renderUpdateBanner(state) {
  updaterUiState = state || { status: 'idle' };
  const visible = ['available', 'downloading', 'downloaded'].includes(updaterUiState.status);
  updateBanner.hidden = !visible;
  document.body.classList.toggle('has-update-banner', visible);
  if (!visible) return;
  const version = esc(updaterUiState.version || 'Neue Version');
  if (updaterUiState.status === 'available') {
    updateMessage.textContent = `Agri Nexus ${version} verfügbar`;
    updateAction.textContent = 'Jetzt aktualisieren & neu starten';
    updateAction.disabled = false;
  } else if (updaterUiState.status === 'downloading') {
    updateMessage.textContent = `Agri Nexus ${version} wird heruntergeladen`;
    updateAction.textContent = `${updaterUiState.percent || 0} %`;
    updateAction.disabled = true;
  } else {
    updateMessage.textContent = `Agri Nexus ${version} ist geladen – Neustart wird ausgeführt`;
    updateAction.textContent = 'Bitte warten …';
    updateAction.disabled = true;
  }
}
api.updates.onState(renderUpdateBanner);
updateAction.onclick = () => {
  if (updaterUiState.status === 'available') api.updates.download();
};

(async function init() {
  api.updates.state().then(renderUpdateBanner).catch(() => {});
  cfg = await api.config.get();
  if (!cfg.gamePath) {
    const g = await api.detectGame();
    if (g) {
      cfg.gamePath = g;
      await persist();
    }
  }
  buildNav();
  go('start');
})();
