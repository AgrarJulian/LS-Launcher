'use strict';

const api = window.launcher;
const view = document.getElementById('view');
const nav = document.getElementById('nav');

let cfg = null;
let page = 'start';

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
const fmtHours = (h) => {
  const mins = Math.round(h * 60);
  return Math.floor(mins / 60) + ' h ' + String(mins % 60).padStart(2, '0') + ' min';
};

const I = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
  start: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.6 3.6-6 8-6s8 2.4 8 6"/></svg>',
  mods: '<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><path d="M8 20v-6h8v6"/></svg>',
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
  box: '<svg viewBox="0 0 24 24"><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>'
};

function toast(msg, error = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (error ? ' error' : '');
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), error ? 6500 : 3800);
}

function openModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '<div class="overlay"><div class="modal" role="dialog" aria-modal="true">' + html + '</div></div>';
  const overlay = root.firstElementChild;
  const close = () => (root.innerHTML = '');
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

// ---------------------------------------------------------------------------
// Seiten
// ---------------------------------------------------------------------------

const pages = {};

// --- Starten ---------------------------------------------------------------
pages.start = {
  title: 'Starten',
  icon: I.start,
  async render() {
    const p = activeProfile();
    const gameOk = !!cfg.gamePath;
    const [mods, saves, backups] = await Promise.all([api.mods.list(), api.saves.list(), api.backups.list()]);
    const args = [p.skipIntro && '-skipStartVideos', p.devMode && '-cheats -console', p.extraArgs].filter(Boolean).join(' ');

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
            <div class="card stat"><b>${mods.ok ? mods.items.length : '–'}</b><span>Mods installiert</span></div>
            <div class="card stat"><b>${saves.ok ? saves.items.length : '–'}</b><span>Spielstände</span></div>
            <div class="card stat"><b>${backups.items.length}</b><span>Backups</span></div>
          </div>
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
          </div>
        </div>
      </div>`;

    document.getElementById('btn-launch').onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const r = await api.launch();
      btn.disabled = false;
      if (r.ok) toast('Landwirtschafts-Simulator 25 wird gestartet …');
      else toast(r.error, true);
    };
    document.getElementById('sel-profile').onchange = async (e) => {
      cfg.activeProfile = e.target.value;
      await persist();
      pages.start.render();
    };
    view.querySelectorAll('[data-qs]').forEach((cb) => {
      cb.onchange = async () => {
        activeProfile()[cb.dataset.qs] = cb.checked;
        await persist();
        pages.start.render();
      };
    });
  }
};

// --- Hof Profile -----------------------------------------------------------
function profileForm(p) {
  const isNew = !p;
  p = p || { id: 'p' + Date.now(), name: '', farm: '', notes: '', devMode: false, clearShader: false, skipIntro: true, extraArgs: '' };
  const m = openModal(
    `<h2>${isNew ? 'Neues Profil' : 'Profil bearbeiten'}</h2>
     <p class="lead">Jedes Profil hat eigene Startoptionen.</p>
     <div class="field"><label>Profilname</label><input class="input" id="f-name" maxlength="60" value="${esc(p.name)}" placeholder="z. B. Mehrspieler-Hof"></div>
     <div class="field"><label>Hofname</label><input class="input" id="f-farm" maxlength="60" value="${esc(p.farm)}"></div>
     <div class="field"><label>Zusätzliche Startparameter</label><input class="input mono" id="f-args" maxlength="300" value="${esc(p.extraArgs)}" placeholder="-beispiel -noch"><small>Nur Parameter in der Form -name werden übernommen.</small></div>
     <div class="field"><label>Notizen</label><textarea class="input" id="f-notes" maxlength="400">${esc(p.notes)}</textarea></div>
     <div class="setting"><div><b>Dev Mode</b></div><label class="switch"><input type="checkbox" id="f-dev" ${p.devMode ? 'checked' : ''}><span></span></label></div>
     <div class="setting"><div><b>Shader Cache leeren</b></div><label class="switch"><input type="checkbox" id="f-shader" ${p.clearShader ? 'checked' : ''}><span></span></label></div>
     <div class="setting"><div><b>Intro überspringen</b></div><label class="switch"><input type="checkbox" id="f-intro" ${p.skipIntro ? 'checked' : ''}><span></span></label></div>
     <div class="modal-actions" style="margin-top:20px"><button class="btn" data-no>Abbrechen</button><button class="btn primary" data-yes>Speichern</button></div>`
  );
  m.el.querySelector('[data-no]').onclick = m.close;
  m.el.querySelector('[data-yes]').onclick = async () => {
    const name = m.el.querySelector('#f-name').value.trim();
    if (!name) return toast('Bitte einen Profilnamen eingeben.', true);
    const next = {
      id: p.id,
      name,
      farm: m.el.querySelector('#f-farm').value.trim(),
      notes: m.el.querySelector('#f-notes').value.trim(),
      extraArgs: m.el.querySelector('#f-args').value.trim(),
      devMode: m.el.querySelector('#f-dev').checked,
      clearShader: m.el.querySelector('#f-shader').checked,
      skipIntro: m.el.querySelector('#f-intro').checked
    };
    const idx = cfg.profiles.findIndex((x) => x.id === p.id);
    if (idx >= 0) cfg.profiles[idx] = next;
    else cfg.profiles.push(next);
    await persist();
    m.close();
    pages.profiles.render();
  };
  m.el.querySelector('#f-name').focus();
}

pages.profiles = {
  title: 'Hof Profile',
  icon: I.user,
  async render() {
    view.innerHTML =
      head('Hof Profile', 'Startoptionen pro Hof verwalten.', `<button class="btn primary" id="p-new">${I.plus}Neues Profil</button>`) +
      `<div class="grid g-2">
        ${cfg.profiles
          .map((p) => {
            const active = p.id === cfg.activeProfile;
            return `<div class="card profile-card ${active ? 'active' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
                <div><h3>${esc(p.name)}</h3><div class="sub">${esc(p.farm || 'Kein Hofname')}</div></div>
                ${active ? '<span class="chip ok"><i></i>Aktiv</span>' : ''}
              </div>
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
      </div>`;

    document.getElementById('p-new').onclick = () => profileForm(null);
    view.querySelectorAll('[data-use]').forEach((b) => {
      b.onclick = async () => {
        cfg.activeProfile = b.dataset.use;
        await persist();
        pages.profiles.render();
      };
    });
    view.querySelectorAll('[data-edit]').forEach((b) => {
      b.onclick = () => profileForm(cfg.profiles.find((x) => x.id === b.dataset.edit));
    });
    view.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        const p = cfg.profiles.find((x) => x.id === b.dataset.del);
        if (!(await confirmDialog('Profil löschen?', `„${p.name}“ wird aus dem Launcher entfernt. Spielstände bleiben unberührt.`, 'Löschen', true))) return;
        cfg.profiles = cfg.profiles.filter((x) => x.id !== p.id);
        await persist();
        pages.profiles.render();
      };
    });
  }
};

// --- Mods & Assets ---------------------------------------------------------
pages.mods = {
  title: 'Mods & Assets',
  icon: I.mods,
  async render() {
    const r = await api.mods.list();
    view.innerHTML =
      head('Mods & Assets', 'Dein Mod-Ordner im Überblick.', `<button class="btn" id="m-open">${I.folder}Ordner öffnen</button><button class="btn" id="m-ref">${I.refresh}Aktualisieren</button>`) +
      `<div class="card">${
        !r.ok
          ? emptyBox('Mod-Ordner nicht gefunden', 'Prüfe den Profil-Ordner in den Einstellungen.')
          : `<div class="toolbar"><input class="input" id="m-search" placeholder="Mods durchsuchen …"><span class="grow"></span><span class="chip">${r.items.length} Einträge · ${fmtSize(r.items.reduce((a, b) => a + b.size, 0))}</span></div>
             <div id="m-list"></div>`
      }</div>
      ${r.ok ? `<p class="note mono">${esc(r.dir)}</p>` : ''}`;

    document.getElementById('m-open').onclick = async () => {
      const o = await api.openFolder('mods');
      if (!o.ok) toast(o.error, true);
    };
    document.getElementById('m-ref').onclick = () => pages.mods.render();
    if (!r.ok) return;

    const draw = () => {
      const q = document.getElementById('m-search').value.trim().toLowerCase();
      const items = r.items.filter((m) => m.name.toLowerCase().includes(q));
      document.getElementById('m-list').innerHTML = items.length
        ? `<table class="table"><thead><tr><th>Name</th><th>Typ</th><th class="num">Größe</th><th>Geändert</th><th></th></tr></thead><tbody>
            ${items
              .map(
                (m) => `<tr><td><div class="name-cell"><span>${esc(m.name)}</span></div></td>
                <td><span class="tag ${m.type === 'zip' ? 'zip' : ''}">${m.type === 'zip' ? 'ZIP' : 'ORDNER'}</span></td>
                <td class="num">${fmtSize(m.size)}</td><td>${fmtDate(m.mtime)}</td>
                <td class="act"><button class="btn sm danger" data-trash="${esc(m.name)}" title="In den Papierkorb">${I.trash}</button></td></tr>`
              )
              .join('')}</tbody></table>`
        : emptyBox('Keine Mods gefunden', q ? 'Keine Treffer für deine Suche.' : 'Der Mod-Ordner ist leer.');
      document.querySelectorAll('[data-trash]').forEach((b) => {
        b.onclick = async () => {
          if (!(await confirmDialog('Mod entfernen?', `„${b.dataset.trash}“ wird in den Papierkorb verschoben.`, 'In den Papierkorb', true))) return;
          const res = await api.mods.trash(b.dataset.trash);
          if (res.ok) {
            toast('Mod in den Papierkorb verschoben.');
            pages.mods.render();
          } else toast(res.error, true);
        };
      });
    };
    document.getElementById('m-search').oninput = draw;
    draw();
  }
};

// --- Saves & Backups -------------------------------------------------------
pages.saves = {
  title: 'Saves & Backups',
  icon: I.save,
  async render() {
    const [saves, backups] = await Promise.all([api.saves.list(), api.backups.list()]);
    view.innerHTML =
      head('Saves & Backups', 'Spielstände sichern und wiederherstellen.', `<button class="btn" id="b-open">${I.folder}Backup-Ordner</button><button class="btn" id="b-ref">${I.refresh}Aktualisieren</button>`) +
      `<div class="stack">
        <div class="card"><h2>Spielstände</h2>${
          !saves.ok
            ? emptyBox('Profil-Ordner nicht gefunden', 'Prüfe den Pfad in den Einstellungen.')
            : saves.items.length
            ? `<table class="table"><thead><tr><th>Slot</th><th>Name / Karte</th><th>Spielzeit</th><th class="num">Größe</th><th></th></tr></thead><tbody>
                ${saves.items
                  .map(
                    (s) => `<tr><td><span class="tag">${esc(s.slot.replace('savegame', 'SLOT '))}</span></td>
                    <td><b>${esc(s.name)}</b>${s.map ? `<div style="color:var(--text-3);font-size:12.5px">${esc(s.map)}${s.saveDate ? ' · ' + esc(s.saveDate) : ''}</div>` : ''}</td>
                    <td>${s.playTime ? fmtHours(s.playTime) : '–'}</td><td class="num">${fmtSize(s.size)}</td>
                    <td class="act"><button class="btn sm primary" data-bk="${esc(s.slot)}">${I.save}Backup erstellen</button></td></tr>`
                  )
                  .join('')}</tbody></table>`
            : emptyBox('Keine Spielstände', 'Es wurden keine savegame-Ordner gefunden.')
        }</div>
        <div class="card"><h2>Backups</h2>${
          backups.items.length
            ? `<table class="table"><thead><tr><th>Datei</th><th>Erstellt</th><th class="num">Größe</th><th></th></tr></thead><tbody>
                ${backups.items
                  .map(
                    (b) => `<tr><td><div class="name-cell"><span class="mono">${esc(b.file)}</span></div></td><td>${fmtDate(b.mtime)}</td><td class="num">${fmtSize(b.size)}</td>
                    <td class="act"><button class="btn sm" data-rs="${esc(b.file)}">${I.restore}Wiederherstellen</button><button class="btn sm danger" data-rm="${esc(b.file)}">${I.trash}</button></td></tr>`
                  )
                  .join('')}</tbody></table>`
            : emptyBox('Noch keine Backups', 'Erstelle oben dein erstes Backup.')
        }</div>
      </div>
      <p class="note mono">${esc(backups.dir || '')}</p>`;

    document.getElementById('b-open').onclick = async () => {
      const o = await api.openFolder('backups');
      if (!o.ok) toast(o.error, true);
    };
    document.getElementById('b-ref').onclick = () => pages.saves.render();
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
        if (!(await confirmDialog('Backup wiederherstellen?', 'Der aktuelle Stand des Slots wird vorher automatisch gesichert und dann ersetzt. Das Spiel sollte nicht laufen.', 'Wiederherstellen'))) return;
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

// --- Server Status ---------------------------------------------------------
function serverForm() {
  const m = openModal(
    `<h2>Eigenen Server hinzufügen</h2><p class="lead">Es wird geprüft, ob der Port erreichbar ist.</p>
     <div class="field"><label>Name</label><input class="input" id="s-name" maxlength="60" placeholder="Mein Server"></div>
     <div class="field"><label>Host / IP</label><input class="input" id="s-host" maxlength="200" placeholder="beispiel.de"></div>
     <div class="field"><label>Port</label><input class="input" id="s-port" type="number" min="1" max="65535" value="10823"></div>
     <div class="modal-actions"><button class="btn" data-no>Abbrechen</button><button class="btn primary" data-yes>Hinzufügen</button></div>`
  );
  m.el.querySelector('[data-no]').onclick = m.close;
  m.el.querySelector('[data-yes]').onclick = async () => {
    const host = m.el.querySelector('#s-host').value.trim();
    if (!host) return toast('Bitte einen Host eingeben.', true);
    cfg.servers.push({
      name: m.el.querySelector('#s-name').value.trim() || host,
      host,
      port: parseInt(m.el.querySelector('#s-port').value, 10) || 10823
    });
    await persist();
    m.close();
    pages.status.render();
  };
}

pages.status = {
  title: 'Server Status',
  icon: I.server,
  async render() {
    view.innerHTML =
      head('Server Status', 'Erreichbarkeit der GIANTS-Dienste und eigener Server.', `<button class="btn" id="s-add">${I.plus}Server hinzufügen</button><button class="btn primary" id="s-ref">${I.refresh}Prüfen</button>`) +
      `<div class="stack"><div class="card"><h2>Offizielle Dienste</h2><div id="s-off"><span class="spin"></span></div></div>
       <div class="card"><h2>Eigene Server</h2><div id="s-cus">${cfg.servers.length ? '<span class="spin"></span>' : emptyBox('Keine eigenen Server', 'Füge einen Server hinzu, um seinen Port zu prüfen.')}</div></div></div>
       <p class="note" id="s-time"></p>`;
    document.getElementById('s-add').onclick = serverForm;
    document.getElementById('s-ref').onclick = () => pages.status.render();

    const row = (r, removeIdx) => `<div class="status-row"><i class="dot ${r.online ? 'ok' : 'bad'}"></i>
      <div class="grow"><b>${esc(r.name)}</b><small>${esc(r.target)} · ${esc(r.detail)}</small></div>
      <span class="ms">${r.ms != null ? r.ms + ' ms' : '–'}</span>
      <span class="chip ${r.online ? 'ok' : 'bad'}"><i></i>${r.online ? 'Online' : 'Offline'}</span>
      ${removeIdx != null ? `<button class="btn sm danger" data-srv="${removeIdx}">${I.trash}</button>` : ''}</div>`;

    const res = await api.status.check();
    if (page !== 'status') return;
    document.getElementById('s-off').innerHTML = res.official.map((r) => row(r)).join('');
    if (cfg.servers.length) {
      document.getElementById('s-cus').innerHTML = res.custom.map((r, i) => row(r, i)).join('');
      view.querySelectorAll('[data-srv]').forEach((b) => {
        b.onclick = async () => {
          cfg.servers.splice(parseInt(b.dataset.srv, 10), 1);
          await persist();
          pages.status.render();
        };
      });
    }
    document.getElementById('s-time').textContent = 'Zuletzt geprüft: ' + fmtDate(res.checkedAt);
  }
};

// --- Einstellungen ---------------------------------------------------------
pages.settings = {
  title: 'Einstellungen',
  icon: I.gear,
  async render() {
    const row = (id, label, hint, val, kind) => `<div class="field"><label>${label}</label>
      <div class="path-row"><input class="input mono" id="${id}" value="${esc(val)}" spellcheck="false">
      <button class="btn" data-pick="${id}" data-kind="${kind}">${I.folder}Wählen</button>
      ${id === 'st-game' ? `<button class="btn" id="st-detect">Erkennen</button>` : ''}</div><small>${hint}</small></div>`;

    view.innerHTML =
      head('Einstellungen', 'Pfade und Verhalten des Launchers.') +
      `<div class="stack">
        <div class="card"><h2>Pfade</h2>
          ${row('st-game', 'Spiel (FarmingSimulator2025.exe)', 'Wird beim Start ausgeführt.', cfg.gamePath, 'file')}
          ${row('st-profile', 'Profil-Ordner', 'Enthält savegame-Ordner, mods und shader_cache – meist Dokumente\\My Games\\FarmingSimulator2025.', cfg.profilePath, 'dir')}
          ${row('st-backup', 'Backup-Ordner', 'Hier werden die ZIP-Sicherungen gespeichert.', cfg.backupPath, 'dir')}
        </div>
        <div class="card"><h2>Verhalten</h2>
          <div class="setting"><div><b>Launcher nach dem Spielstart schließen</b><small>Beendet den Launcher, sobald das Spiel läuft.</small></div>
            <label class="switch"><input type="checkbox" id="st-close" ${cfg.closeOnLaunch ? 'checked' : ''}><span></span></label></div>
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
      cfg.closeOnLaunch = document.getElementById('st-close').checked;
      await persist();
      toast('Einstellungen gespeichert.');
    };
  }
};

// --- Über uns --------------------------------------------------------------
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
  ['System', ['status', 'settings', 'about']]
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
  page = p;
  nav.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === p));
  view.scrollTop = 0;
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
  if (e.key === 'Escape') document.getElementById('modal-root').innerHTML = '';
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
