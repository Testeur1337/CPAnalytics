/* Data model + persistence.
 *
 * Everything lives in one JSON document:
 *   { app, version, updatedAt, settings, labels[], sessions[], timer }
 * It is always mirrored to localStorage, and optionally auto-saved to a real
 * file on disk (File System Access API, Chromium browsers). Export/import of the
 * same JSON works in every browser.
 */
(function () {
  'use strict';
  const GT = window.GT;
  const KEY = 'goodtime-web:v1';
  const VERSION = 1;

  const DEFAULT_SETTINGS = {
    workMin: 25,
    shortMin: 5,
    longMin: 15,
    sessionsBeforeLong: 4,
    countUp: false,          // "flow" mode: focus counts up until you finish
    flowRatio: 5,            // flow break = focus time / ratio
    autoStartBreak: false,
    autoStartWork: false,
    sound: true,
    soundKind: 'bell',
    volume: 0.6,
    notify: false,
    vibrate: true,
    keepAwake: true,
    theme: 'system',         // system | light | dark
    accent: '#14b8a6',
    breakColor: '#3b82f6',
    dailyGoalMin: 120,
    weekStart: 1,            // 0 = Sunday, 1 = Monday
    hour12: false,
    minSaveSec: 60,          // stopped focus sessions shorter than this are discarded
  };
  const DEFAULT_LABEL_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];
  GT.LABEL_COLORS = DEFAULT_LABEL_COLORS;

  const freshTimer = (s) => ({
    phase: 'work', status: 'idle', planned: s.workMin * GT.MIN,
    acc: 0, runStart: 0, firstStart: 0, labelId: null, cycle: 0, flowBreak: 0,
  });

  function blank() {
    const s = Object.assign({}, DEFAULT_SETTINGS);
    return {
      app: 'goodtime-web', version: VERSION, updatedAt: 0,
      settings: s, labels: [], sessions: [], timer: freshTimer(s),
    };
  }

  /* Coerce arbitrary parsed JSON into a valid document (never throws). */
  function normalize(raw) {
    const out = blank();
    if (!raw || typeof raw !== 'object') return out;
    const num = (v, d, lo, hi) => (typeof v === 'number' && isFinite(v) ? GT.clamp(v, lo, hi) : d);
    const bool = (v, d) => (typeof v === 'boolean' ? v : d);
    const str = (v, d) => (typeof v === 'string' ? v : d);
    const rs = raw.settings || {};
    const d = DEFAULT_SETTINGS;
    out.settings = {
      workMin: num(rs.workMin, d.workMin, 1, 600),
      shortMin: num(rs.shortMin, d.shortMin, 1, 240),
      longMin: num(rs.longMin, d.longMin, 1, 240),
      sessionsBeforeLong: Math.round(num(rs.sessionsBeforeLong, d.sessionsBeforeLong, 1, 12)),
      countUp: bool(rs.countUp, d.countUp),
      flowRatio: num(rs.flowRatio, d.flowRatio, 1, 20),
      autoStartBreak: bool(rs.autoStartBreak, d.autoStartBreak),
      autoStartWork: bool(rs.autoStartWork, d.autoStartWork),
      sound: bool(rs.sound, d.sound),
      soundKind: ['bell', 'chime', 'beep', 'digital'].includes(rs.soundKind) ? rs.soundKind : d.soundKind,
      volume: num(rs.volume, d.volume, 0, 1),
      notify: bool(rs.notify, d.notify),
      vibrate: bool(rs.vibrate, d.vibrate),
      keepAwake: bool(rs.keepAwake, d.keepAwake),
      theme: ['system', 'light', 'dark'].includes(rs.theme) ? rs.theme : d.theme,
      accent: /^#[0-9a-f]{6}$/i.test(rs.accent) ? rs.accent : d.accent,
      breakColor: /^#[0-9a-f]{6}$/i.test(rs.breakColor) ? rs.breakColor : d.breakColor,
      dailyGoalMin: num(rs.dailyGoalMin, d.dailyGoalMin, 0, 1440),
      weekStart: rs.weekStart === 0 ? 0 : 1,
      hour12: bool(rs.hour12, d.hour12),
      minSaveSec: num(rs.minSaveSec, d.minSaveSec, 0, 3600),
    };
    const seen = new Set();
    out.labels = (Array.isArray(raw.labels) ? raw.labels : []).filter((l) => l && typeof l.id === 'string' && !seen.has(l.id) && seen.add(l.id)).map((l) => ({
      id: l.id, name: str(l.name, 'Label').slice(0, 60) || 'Label',
      color: /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : DEFAULT_LABEL_COLORS[0],
      archived: !!l.archived,
    }));
    const sids = new Set();
    out.sessions = (Array.isArray(raw.sessions) ? raw.sessions : []).filter((s) => s && typeof s.start === 'number' && typeof s.duration === 'number' && isFinite(s.start) && isFinite(s.duration) && s.duration > 0).map((s) => {
      let id = typeof s.id === 'string' && !sids.has(s.id) ? s.id : GT.uid();
      sids.add(id);
      return {
        id, start: s.start, duration: s.duration,
        end: typeof s.end === 'number' ? s.end : s.start + s.duration,
        labelId: typeof s.labelId === 'string' ? s.labelId : null,
        note: str(s.note, '').slice(0, 1000),
        interrupted: !!s.interrupted,
      };
    }).sort((a, b) => a.start - b.start);
    out.updatedAt = num(raw.updatedAt, 0, 0, 8.64e15);
    const t = raw.timer, ft = freshTimer(out.settings);
    if (t && typeof t === 'object') {
      out.timer = {
        phase: ['work', 'short', 'long'].includes(t.phase) ? t.phase : ft.phase,
        status: ['idle', 'running', 'paused'].includes(t.status) ? t.status : 'idle',
        planned: num(t.planned, ft.planned, 0, 48 * GT.HOUR),
        acc: num(t.acc, 0, 0, 48 * GT.HOUR),
        runStart: num(t.runStart, 0, 0, 8.64e15),
        firstStart: num(t.firstStart, 0, 0, 8.64e15),
        labelId: typeof t.labelId === 'string' ? t.labelId : null,
        cycle: Math.round(num(t.cycle, 0, 0, 100)),
        flowBreak: num(t.flowBreak, 0, 0, 48 * GT.HOUR),
      };
    } else out.timer = ft;
    return out;
  }

  let data = blank();
  let storageOk = true;

  function loadLocal() {
    try {
      const txt = localStorage.getItem(KEY);
      if (txt) return normalize(JSON.parse(txt));
    } catch (e) { storageOk = false; console.warn('localStorage unavailable or corrupt', e); }
    return null;
  }

  function writeLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); storageOk = true; }
    catch (e) { storageOk = false; GT.emit('storage-error', e); }
  }

  const store = (GT.store = {
    data: () => data,
    settings: () => data.settings,
    labels: () => data.labels,
    sessions: () => data.sessions,
    timerState: () => data.timer,
    storageOk: () => storageOk,
    normalize,

    /* Persist and notify. `silent` skips the change event (used by the timer tick). */
    save(silent) {
      data.updatedAt = Date.now();
      writeLocal();
      if (GT.file) GT.file.schedule();
      if (!silent) GT.emit('change');
    },

    replaceAll(raw, keepTimer) {
      const next = normalize(raw);
      if (keepTimer) next.timer = data.timer;
      data = next;
      store.save();
    },

    reset() {
      data = blank();
      store.save();
    },

    /* ----- labels ----- */
    label: (id) => data.labels.find((l) => l.id === id) || null,
    addLabel(name, color) {
      const l = { id: GT.uid(), name: name.trim().slice(0, 60) || 'Label', color, archived: false };
      data.labels.push(l); store.save(); return l;
    },
    updateLabel(id, patch) {
      const l = store.label(id); if (!l) return;
      if (patch.name != null) l.name = patch.name.trim().slice(0, 60) || l.name;
      if (patch.color) l.color = patch.color;
      if (patch.archived != null) l.archived = !!patch.archived;
      if (l.archived && data.timer.labelId === l.id && data.timer.status === 'idle') data.timer.labelId = null;
      store.save();
    },
    deleteLabel(id) {
      data.labels = data.labels.filter((l) => l.id !== id);
      data.sessions.forEach((s) => { if (s.labelId === id) s.labelId = null; });
      if (data.timer.labelId === id) data.timer.labelId = null;
      store.save();
    },
    labelStats(id) {
      let n = 0, ms = 0;
      for (const s of data.sessions) if (s.labelId === id) { n++; ms += s.duration; }
      return { count: n, ms };
    },

    /* ----- sessions ----- */
    addSession(s) {
      const rec = {
        id: GT.uid(), start: s.start, duration: s.duration, end: s.end || s.start + s.duration,
        labelId: s.labelId || null, note: s.note || '', interrupted: !!s.interrupted,
      };
      data.sessions.push(rec);
      data.sessions.sort((a, b) => a.start - b.start);
      store.save(); return rec;
    },
    updateSession(id, patch) {
      const s = data.sessions.find((x) => x.id === id); if (!s) return;
      Object.assign(s, patch);
      s.end = s.start + s.duration;
      data.sessions.sort((a, b) => a.start - b.start);
      store.save();
    },
    deleteSession(id) {
      data.sessions = data.sessions.filter((s) => s.id !== id);
      store.save();
    },

    /* ----- export / import ----- */
    toJSON: () => JSON.stringify(data, null, 2),
    parseImport(text) {
      let raw;
      try { raw = JSON.parse(text); } catch (e) { throw new Error('That file is not valid JSON.'); }
      if (!raw || typeof raw !== 'object' || (!Array.isArray(raw.sessions) && !raw.settings && !Array.isArray(raw.labels))) {
        throw new Error('That JSON does not look like Goodtime Web data.');
      }
      return raw;
    },
    /* Merge sessions + labels from another document (ids already present are skipped). */
    mergeIn(raw) {
      const inc = normalize(raw);
      const labelIds = new Set(data.labels.map((l) => l.id));
      let nl = 0, ns = 0;
      for (const l of inc.labels) if (!labelIds.has(l.id)) { data.labels.push(l); nl++; }
      const sIds = new Set(data.sessions.map((s) => s.id));
      for (const s of inc.sessions) if (!sIds.has(s.id)) { data.sessions.push(s); ns++; }
      data.sessions.sort((a, b) => a.start - b.start);
      store.save();
      return { labels: nl, sessions: ns };
    },
  });

  /* ---------- initial load ---------- */
  const local = loadLocal();
  if (local) data = local;
  else data.updatedAt = 0;

  /* Another tab changed the data: adopt it. */
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try { data = normalize(JSON.parse(e.newValue)); GT.emit('external-change'); GT.emit('change'); } catch (_) { /* ignore */ }
  });

  /* ======================================================================
   * Optional file on disk (File System Access API)
   * ==================================================================== */
  const IDB = 'goodtime-web-handles';
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(IDB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('h');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbGet(k) { const db = await idb(); return new Promise((res, rej) => { const q = db.transaction('h').objectStore('h').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
  async function idbSet(k, v) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('h', 'readwrite'); tx.objectStore('h').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
  async function idbDel(k) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('h', 'readwrite'); tx.objectStore('h').delete(k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }

  const FILE_TYPES = [{ description: 'Goodtime data (JSON)', accept: { 'application/json': ['.json'] } }];
  let handle = null;
  let writing = false, dirty = false;

  /* Remember the handle across reloads. Not fatal if IndexedDB is unavailable (e.g. private mode):
   * the link then simply lasts until the page is closed. */
  async function remember(h) {
    try { await idbSet('main', h); } catch (e) { console.info('Could not persist file handle:', e.message); }
  }

  const file = (GT.file = {
    supported: !!(window.showSaveFilePicker && window.showOpenFilePicker),
    status: 'none',     // none | ok | needs-permission | error
    name: '',
    lastSaved: 0,
    error: '',

    setStatus(s, err) {
      const changed = file.status !== s || file.error !== (err || '');
      file.status = s; file.error = err || '';
      if (changed) GT.emit('file-status');
    },

    async init() {
      if (!file.supported) return;
      try {
        handle = (await idbGet('main')) || null;
        if (!handle) return;
        file.name = handle.name;
        const p = await handle.queryPermission({ mode: 'readwrite' });
        if (p === 'granted') await file.sync();
        else file.setStatus('needs-permission');
      } catch (e) { file.setStatus('error', e.message); }
    },

    /* Reconcile on connect: newer side wins. */
    async sync() {
      try {
        const f = await handle.getFile();
        const text = await f.text();
        if (text.trim()) {
          let raw = null;
          try { raw = store.parseImport(text); } catch (_) { /* unreadable file: overwrite it below */ }
          if (raw && (raw.updatedAt || 0) > data.updatedAt) {
            data = normalize(raw);
            writeLocal();
            file.setStatus('ok');
            GT.emit('external-change'); GT.emit('change');
            return;
          }
        }
        await file.write();
      } catch (e) { file.setStatus('error', e.message); }
    },

    async reconnect() {
      if (!handle) return;
      try {
        const p = await handle.requestPermission({ mode: 'readwrite' });
        if (p === 'granted') await file.sync(); else file.setStatus('needs-permission');
      } catch (e) { file.setStatus('error', e.message); }
    },

    /* Pick/create a file and start auto-saving the current data into it. */
    async createAndLink() {
      const h = await window.showSaveFilePicker({ suggestedName: 'goodtime-data.json', types: FILE_TYPES });
      handle = h; file.name = h.name;
      await remember(h);
      await file.write();
    },

    /* Pick an existing file, load it (replacing current data) and keep it linked. */
    async openAndLink() {
      const [h] = await window.showOpenFilePicker({ types: FILE_TYPES, multiple: false });
      const text = await (await h.getFile()).text();
      let raw = null;
      if (text.trim()) raw = store.parseImport(text);
      handle = h; file.name = h.name;
      await remember(h);
      return raw;       // caller decides whether to replace/merge, then calls file.write()
    },

    async unlink() {
      handle = null; file.name = '';
      try { await idbDel('main'); } catch (_) { /* ignore */ }
      file.setStatus('none');
    },

    schedule: GT.debounce(() => { if (handle && file.status === 'ok') file.write(); }, 700),

    async write() {
      if (!handle) return;
      if (writing) { dirty = true; return; }
      writing = true;
      try {
        const w = await handle.createWritable();
        await w.write(store.toJSON());
        await w.close();
        file.lastSaved = Date.now();
        file.setStatus('ok');
      } catch (e) {
        const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
        file.setStatus(denied ? 'needs-permission' : 'error', e.message);
      } finally {
        writing = false;
        if (dirty) { dirty = false; file.write(); }
      }
    },
  });
})();
