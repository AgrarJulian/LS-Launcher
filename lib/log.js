'use strict';

// Liest das Spiel-Log (log.txt) und übersetzt Fehler/Warnungen in verständliches Deutsch.

const HEADER_RE = /^\s*(?:\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?\s+)?(Error|Warning)\b\s*:?\s*(.*)$/i;
const FILE_RE = /([\w\-./\\:() ]*?[\w\-]+\.(dds|png|jpe?g|tga|tif|i3d|shapes|ogg|wav|mp3|xml|lua|gdm|cache|gls|gsc|xsd))\b/i;
const FAIL_RE = /(can'?t|cannot|could not|couldn'?t|failed|unable|missing|not found|no such|does not exist|doesn'?t exist|invalid)/i;

function shortFile(f) {
  const s = f.replace(/\\/g, '/').trim();
  const parts = s.split('/');
  return parts.length > 3 ? '…/' + parts.slice(-3).join('/') : s;
}

function attributeMod(text) {
  let m = /mods[\\/]+([A-Za-z_][\w]*)(?:\.zip)?[\\/]/i.exec(text);
  if (m) return m[1];
  m = /\b(FS\d{2}_[A-Za-z0-9_]+)/.exec(text);
  if (m) return m[1];
  m = /\bmod\s+'([A-Za-z_][\w]*)'/i.exec(text);
  if (m) return m[1];
  return '';
}

function luaDetail(text) {
  let m;
  if ((m = /attempt to index (?:a )?nil value(?: \((?:field|local|global|upvalue) '([^']+)'\))?/i.exec(text))) {
    return `Das Skript greift auf etwas zu, das es nicht gibt${m[1] ? ` („${m[1]}“ ist leer)` : ''}. Meist fehlt eine Abhängigkeit oder zwei Mods vertragen sich nicht.`;
  }
  if ((m = /attempt to call (?:a )?nil value(?: \((?:method|field|global|local|upvalue) '([^']+)'\))?/i.exec(text))) {
    return `Das Skript ruft eine Funktion auf, die nicht existiert${m[1] ? ` („${m[1]}“)` : ''}. Häufig ist der Mod für eine andere Spielversion gebaut.`;
  }
  if (/attempt to (?:compare|perform arithmetic|concatenate)/i.test(text)) {
    return 'Das Skript rechnet oder vergleicht mit einem leeren oder falschen Wert (Programmierfehler im Mod oder fehlende Daten).';
  }
  if ((m = /bad argument #(\d+) to '([^']+)'/i.exec(text))) {
    return `Der Funktion „${m[2]}“ wurde ein falscher Wert übergeben (Argument ${m[1]}).`;
  }
  if (/stack overflow/i.test(text)) return 'Endlosschleife im Skript (Stack-Überlauf).';
  return '';
}

function translate(header, full) {
  let m;

  // Datei fehlt / nicht ladbar
  if (FAIL_RE.test(header) && (m = FILE_RE.exec(header))) {
    const f = shortFile(m[1]);
    const ext = m[2].toLowerCase();
    if (/^(dds|png|jpe?g|tga|tif)$/.test(ext)) return `Textur „${f}“ fehlt oder lässt sich nicht laden.`;
    if (/^(i3d|shapes|gls|gsc)$/.test(ext)) return `3D-Modell „${f}“ fehlt oder ist beschädigt.`;
    if (/^(ogg|wav|mp3)$/.test(ext)) return `Sounddatei „${f}“ fehlt oder ist beschädigt.`;
    if (ext === 'xml') return `XML-Datei „${f}“ fehlt oder ist fehlerhaft.`;
    if (ext === 'lua') return `Skript „${f}“ konnte nicht geladen werden.`;
    return `Datei „${f}“ fehlt oder ist beschädigt.`;
  }

  if ((m = /Running LUA method '([^']+)'/i.exec(header))) {
    const d = luaDetail(full);
    return `Skript-Fehler in „${m[1]}“.${d ? ' ' + d : ''}`;
  }

  const d = luaDetail(full);
  if (d) return 'Skript-Fehler: ' + d;

  if (/requires|depends on|dependency|required mod/i.test(header) && /mod/i.test(header)) {
    return 'Eine Abhängigkeit fehlt – ein benötigter Mod ist nicht installiert oder deaktiviert.';
  }
  if (/descVersion|not compatible|incompatible|wrong version/i.test(header)) {
    return 'Der Mod ist nicht kompatibel (gebaut für eine andere Spielversion).';
  }
  if (/invalid mod (?:file ?)?name|mod name .*invalid/i.test(header)) {
    return 'Ungültiger Mod-Dateiname – erlaubt sind nur Buchstaben, Zahlen und _ (keine Leerzeichen, nicht mit Zahl beginnen).';
  }
  if (/already (?:registered|exists|defined|loaded|added)|duplicate/i.test(header)) {
    return 'Doppelt registriert – ein Mod ist vermutlich zweimal installiert oder überschneidet sich mit einem anderen.';
  }
  if ((m = /unknown (?:vehicle ?type|specialization|spec|type|fill ?type|crop|brand|category)\s*'?"?([\w.\-]*)/i.exec(header))) {
    return `Unbekannter Typ${m[1] ? ` „${m[1]}“` : ''} – der dazugehörige Mod fehlt oder wurde nicht geladen.`;
  }
  if (/out of memory|not enough memory/i.test(header)) return 'Zu wenig Arbeitsspeicher – weniger/kleinere Mods oder Grafikeinstellungen senken.';
  if (/shader/i.test(header)) return 'Grafik-/Shader-Problem – hilft oft: Shader Cache leeren.';
  if (/savegame|career/i.test(header) && FAIL_RE.test(header)) return 'Der Spielstand konnte nicht (vollständig) geladen werden.';
  return '';
}

function parseLog(text) {
  const lines = text.split(/\r?\n/);
  const map = new Map();
  const counts = { errors: 0, warnings: 0 };
  const byMod = {};

  for (let i = 0; i < lines.length; i++) {
    const hm = HEADER_RE.exec(lines[i]);
    if (!hm) continue;
    const sev = hm[1].toLowerCase() === 'error' ? 'error' : 'warn';
    const header = hm[2].trim();

    const cont = [];
    let j = i + 1;
    while (j < lines.length && cont.length < 8) {
      const l = lines[j];
      if (!l.trim()) break;
      if (HEADER_RE.test(l)) break;
      if (/^\s/.test(l) || /\.lua:\d+/.test(l) || /^stack traceback/i.test(l)) {
        cont.push(l.trim());
        j++;
      } else break;
    }
    i = j - 1;

    const full = [header, ...cont].join(' ');
    const mod = attributeMod(full);
    const nice = translate(header, full);
    const text2 = nice || (header || 'Unbekannter Eintrag');
    const key = sev + '|' + text2 + '|' + mod + (nice ? '' : '|' + header);

    const e = map.get(key);
    if (e) e.count++;
    else {
      map.set(key, {
        sev,
        text: text2,
        translated: !!nice,
        raw: [lines[i - cont.length] || header, ...cont].join('\n').trim() || header,
        mod,
        count: 1,
        line: i - cont.length + 1
      });
    }
    if (sev === 'error') counts.errors++;
    else counts.warnings++;
    if (mod) {
      const k = mod.toLowerCase();
      byMod[k] = byMod[k] || { errors: 0, warnings: 0 };
      if (sev === 'error') byMod[k].errors++;
      else byMod[k].warnings++;
    }
  }

  const entries = Array.from(map.values());
  return { entries, counts, byMod, lineCount: lines.length };
}

module.exports = { parseLog };
