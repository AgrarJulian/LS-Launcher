'use strict';

const api = window.launcher;
const view = document.getElementById('view');
const nav = document.getElementById('nav');

let cfg = null;
let page = 'start';
let timers = [];

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
}

function head(title, sub, actions = '') {
  return `<div class="page-head"><div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div class="head-actions">${actions}</div></div>`;
}

function emptyBox(title, text) {
  return `<div class="empty">${I.box}<b>${esc(title)}</b><span>${esc(text)}</span></div>`;
}

const sourceLabel = (s) => (s === 'gameSettings' ? 'aus der gameSettings.xml' : s === 'profile' ? 'vom Hof-Profil' : 'Spiel-Standard');

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
  return `<div class="${cls} ph" style="background:linear-gradient(135deg,hsl(${h} 45% 28%),hsl(${(h + 40) % 360} 50% 18%))">${esc(initials(m.title || m.id))}</div>`;
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
            <button class="btn primary launch" id="btn-launch">${I.play}LS25 STARTEN</button>
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

const M = { items: [], dir: '', source: '', file: '', filter: 'all', sort: 'name', q: '', conflicts: null, conflictMap: {}, hub: {}, hubRun: null, scroll: 0 };

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
  const by = {
    name: (a, b) => a.title.localeCompare(b.title, 'de', { sensitivity: 'base' }),
    author: (a, b) => (a.author || '~').localeCompare(b.author || '~', 'de', { sensitivity: 'base' }) || by.name(a, b),
    size: (a, b) => b.size - a.size,
    date: (a, b) => b.mtime - a.mtime,
    errors: (a, b) => problems(b).errCount - problems(a).errCount || problems(b).warnCount - problems(a).warnCount || by.name(a, b)
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
  el.innerHTML = `<span class="chip"><i></i>${all} Mods</span><span class="chip ok"><i></i>${on} aktiv</span>${all - on ? `<span class="chip mute"><i></i>${all - on} deaktiviert</span>` : ''}
    ${err ? `<span class="chip bad"><i></i>${err} mit Fehlern</span>` : ''}${warn ? `<span class="chip warn"><i></i>${warn} mit Warnungen</span>` : ''}${upd ? `<span class="chip warn"><i></i>${upd} Update${upd > 1 ? 's' : ''}</span>` : ''}
    <span class="chip">${fmtSize(M.items.reduce((a, b) => a + b.size, 0))}</span>`;
}

function drawGrid() {
  const el = document.getElementById('m-grid');
  if (!el) return;
  const list = filteredMods();
  el.innerHTML = list.length
    ? `<div class="mod-grid">${list.map(modCard).join('')}</div>`
    : `<div class="card">${emptyBox('Keine Mods gefunden', M.q || M.filter !== 'all' ? 'Keine Treffer für Suche/Filter.' : 'Der Mod-Ordner ist leer. Ziehe .zip-Dateien in dieses Fenster, um Mods zu installieren.')}</div>`;
  el.querySelectorAll('[data-open]').forEach((c) => {
    c.onclick = (e) => {
      if (e.target.closest('[data-stop]')) return;
      modDetails(c.dataset.open);
    };
  });
  el.querySelectorAll('[data-toggle]').forEach((cb) => {
    cb.onchange = () => toggleMod(cb.dataset.toggle);
  });
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
       <div id="m-hub"></div><div id="m-conflicts"></div>
       <div class="chips" id="m-chips"></div>
       <div class="toolbar">
         <input class="input" id="m-search" placeholder="Mods durchsuchen …" value="${esc(M.q)}">
         <select class="input" id="m-filter">
           <option value="all">Alle</option><option value="on">Aktiv</option><option value="off">Deaktiviert</option>
           <option value="err">Mit Fehlern</option><option value="warn">Mit Warnungen</option><option value="update">Update verfügbar</option><option value="conflict">Mit Konflikten</option></select>
         <select class="input" id="m-sort">
           <option value="name">Sortiert nach Name</option><option value="author">nach Modder</option><option value="errors">nach Fehlern</option><option value="size">nach Größe</option><option value="date">nach Datum</option></select>
         <span class="grow"></span><span class="note" style="margin:0">Tipp: .zip-Dateien einfach ins Fenster ziehen</span>
       </div>
       <div id="m-grid"><div class="card"><span class="spin"></span></div></div>`;

    document.getElementById('m-filter').value = M.filter;
    document.getElementById('m-sort').value = M.sort;
    document.getElementById('m-search').oninput = (e) => ((M.q = e.target.value), drawGrid());
    document.getElementById('m-filter').onchange = (e) => ((M.filter = e.target.value), drawGrid());
    document.getElementById('m-sort').onchange = (e) => ((M.sort = e.target.value), drawGrid());
    document.getElementById('m-open').onclick = async () => {
      const o = await api.openFolder('mods');
      if (!o.ok) toast(o.error, true);
    };
    document.getElementById('m-ref').onclick = () => loadMods();
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
          ${row('st-backup', 'Backup-Ordner', 'Hier werden die ZIP-Sicherungen gespeichert.', cfg.backupPath, 'dir')}
          ${row('st-log', 'Log-Datei (optional)', 'Leer lassen für automatische Suche (log.txt bzw. game.log.txt im Profil-Ordner).', cfg.logPath, 'log')}
        </div>
        <div class="card"><h2>Mod-Ordner</h2>
          <dl class="kv"><dt>Aktuell verwendet</dt><dd class="mono">${esc(mf.dir)}</dd><dt>Quelle</dt><dd>${esc(sourceLabel(mf.source))}</dd>
          <dt>gameSettings.xml</dt><dd class="mono">${esc(mf.gameSettings.file)}${mf.gameSettings.exists ? '' : ' (nicht gefunden)'}</dd></dl>
          <p class="note">Der Launcher liest den Mod-Ordner aus dem Eintrag <span class="mono">modsDirectoryOverride</span> der gameSettings.xml. Ist dort nichts aktiv, wird der Ordner „mods“ im Profil-Ordner verwendet.</p>
        </div>
        <div class="card"><h2>Verhalten</h2>
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
      cfg.backupPath = document.getElementById('st-backup').value.trim();
      cfg.logPath = document.getElementById('st-log').value.trim();
      cfg.closeOnLaunch = document.getElementById('st-close').checked;
      cfg.autoBackup = document.getElementById('st-auto').checked;
      cfg.autoBackupKeep = parseInt(document.getElementById('st-keep').value, 10) || 10;
      await persist();
      L.sig = '';
      toast('Einstellungen gespeichert.');
      pages.settings.render();
    };
  }
};

// ---------------------------------------------------------------------------
// Über uns
// ---------------------------------------------------------------------------

pages.about = {
  title: 'Über uns',
  icon: I.info,
  async render() {
    const link = (u) => `<a data-ext="https://${u}">${u}</a>`;
    view.innerHTML = `<div class="card about">
      <div class="about-head"><img src="../assets/icon.png" alt="">
        <div><h2>LS25 Launcher v1.0.0</h2><p>Freies Open-Source-Verwaltungstool für den Landwirtschafts-Simulator 25</p></div></div>
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
        <p>LS25 Launcher ist ein inoffizielles Community-Projekt und steht in keinerlei Verbindung mit der GIANTS Software GmbH. "Landwirtschafts-Simulator" und "GIANTS Software" sind eingetragene Marken der GIANTS Software GmbH.</p></section>
      <section style="margin-bottom:0"><ul><li>Datenschutzbestimmungen: ${link('github.com/AgrarJulian/LS-Launcher/blob/main/PRIVACY.md')}</li></ul></section>
    </div>`;
  }
};

// ---------------------------------------------------------------------------
// Navigation & Start
// ---------------------------------------------------------------------------

const NAV = [
  ['', ['start', 'profiles', 'mods', 'saves']],
  ['Werkzeuge', ['log', 'calc', 'status']],
  ['System', ['settings', 'about']]
];

function buildNav() {
  nav.innerHTML =
    NAV.map(
      ([label, keys]) =>
        (label ? `<div class="nav-label">${label}</div>` : '') +
        keys.map((k) => `<button class="nav-item" data-page="${k}">${pages[k].icon}<span>${pages[k].title}</span></button>`).join('')
    ).join('') + '<div class="nav-spacer"></div><div class="nav-foot">Version 1.0.0 · MIT</div>';
  nav.querySelectorAll('[data-page]').forEach((b) => (b.onclick = () => go(b.dataset.page)));
}

function go(p) {
  clearTimers();
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

(async function init() {
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
