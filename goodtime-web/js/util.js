/* Shared helpers: namespace, tiny event bus, DOM builder, date/time formatting, icons, dialogs. */
(function () {
  'use strict';
  const GT = (window.GT = window.GT || {});

  /* ---------- event bus ---------- */
  const handlers = {};
  GT.on = (evt, fn) => ((handlers[evt] = handlers[evt] || []).push(fn), fn);
  GT.emit = (evt, ...args) => (handlers[evt] || []).slice().forEach((fn) => {
    try { fn(...args); } catch (e) { console.error(e); }
  });

  /* ---------- DOM ---------- */
  GT.h = function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'disabled') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    GT.append(el, kids);
    return el;
  };
  GT.append = function append(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.append(k.nodeType ? k : document.createTextNode(String(k)));
    }
    return el;
  };
  GT.svg = function svg(tag, attrs, ...kids) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
    GT.append(el, kids);
    return el;
  };
  GT.clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  GT.$ = (sel, root) => (root || document).querySelector(sel);
  GT.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- icons (24px stroke icons) ---------- */
  const ICONS = {
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
    pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
    skip: '<path d="M5 4.5v15l10-7.5zM19 5v14" />',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
  };
  GT.icon = function icon(name, cls) {
    const s = GT.h('span', { class: 'ico' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
    s.innerHTML = '<svg viewBox="0 0 24 24">' + (ICONS[name] || '') + '</svg>';
    return s;
  };
  GT.hydrateIcons = function (root) {
    GT.$$('[data-ico]', root).forEach((el) => {
      el.innerHTML = '<svg viewBox="0 0 24 24">' + (ICONS[el.dataset.ico] || '') + '</svg>';
    });
  };
  GT.setIcon = (el, name) => { el.dataset.ico = name; el.innerHTML = '<svg viewBox="0 0 24 24">' + ICONS[name] + '</svg>'; };

  /* ---------- misc ---------- */
  GT.uid = () => (window.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  GT.clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  GT.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ---------- time ---------- */
  const MIN = 60000, HOUR = 3600000, DAY = 86400000;
  GT.MIN = MIN; GT.HOUR = HOUR; GT.DAY = DAY;
  const pad = (n) => String(n).padStart(2, '0');
  GT.pad = pad;

  GT.clock = function (ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  };
  GT.elapsedClock = function (ms) {   // count-up, floors instead of ceils
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  };
  GT.dur = function (ms) {            // "1h 25m", "45m", "0m"
    const totalMin = Math.round(ms / MIN);
    const h = Math.floor(totalMin / 60), m = totalMin % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  };
  GT.startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  GT.addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
  GT.addMonths = (t, n) => { const d = new Date(t); d.setDate(1); d.setMonth(d.getMonth() + n); return d.getTime(); };
  GT.startOfWeek = (t, weekStart) => {
    const d = new Date(GT.startOfDay(t));
    const diff = (d.getDay() - weekStart + 7) % 7;
    d.setDate(d.getDate() - diff);
    return d.getTime();
  };
  GT.startOfMonth = (t) => { const d = new Date(GT.startOfDay(t)); d.setDate(1); return d.getTime(); };
  GT.startOfYear = (t) => { const d = new Date(GT.startOfDay(t)); d.setMonth(0, 1); return d.getTime(); };
  GT.dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  GT.timeStr = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: GT.store ? GT.store.settings().hour12 : undefined });
  GT.dateStr = (t, opts) => new Date(t).toLocaleDateString([], opts || { weekday: 'short', month: 'short', day: 'numeric' });
  GT.dayTitle = (t) => {
    const today = GT.startOfDay(Date.now());
    const d = GT.startOfDay(t);
    if (d === today) return 'Today';
    if (d === GT.addDays(today, -1)) return 'Yesterday';
    return GT.dateStr(t, { weekday: 'long', month: 'short', day: 'numeric', year: d < GT.addDays(today, -300) ? 'numeric' : undefined });
  };
  GT.toLocalInput = (t) => {
    const d = new Date(t);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  GT.fromLocalInput = (s) => { const t = new Date(s).getTime(); return Number.isFinite(t) ? t : NaN; };

  /* ---------- toast ---------- */
  GT.toast = function (msg, ms) {
    const box = document.getElementById('toasts');
    const el = GT.h('div', { class: 'toast', role: 'status' }, msg);
    box.append(el);
    setTimeout(() => el.remove(), ms || 2600);
  };

  /* ---------- dialogs ---------- */
  // GT.dialog(content) shows a modal; returns { close(value), el, closed: Promise }.
  let activeDialog = null;   // { teardown } of the dialog currently shown
  GT.dialog = function (content) {
    const dlg = document.getElementById('dlg');
    // Replacing an open dialog: settle the old one now. Its 'close' event is dispatched
    // asynchronously and must not be mistaken for the new dialog closing.
    if (activeDialog) activeDialog.teardown('');
    if (dlg.open) dlg.close();
    GT.clear(dlg);
    const body = GT.h('div', { class: 'dlg-body' }, content);
    dlg.append(body);
    let resolve, done = false;
    const closed = new Promise((r) => (resolve = r));
    const teardown = (value) => {
      if (done) return;
      done = true;
      dlg.removeEventListener('close', onClose);
      dlg.removeEventListener('click', backdrop);
      if (activeDialog === me) activeDialog = null;
      resolve(value || null);
    };
    const onClose = () => { if (!dlg.open) teardown(dlg.returnValue); };
    const backdrop = (e) => { if (e.target === dlg) dlg.close(''); };
    const me = { teardown };
    activeDialog = me;
    dlg.returnValue = '';
    dlg.addEventListener('close', onClose);
    dlg.addEventListener('click', backdrop);
    dlg.showModal();
    return { el: body, close: (v) => dlg.close(v == null ? '' : v), closed };
  };
  GT.confirm = async function (title, message, okText, danger) {
    const d = GT.dialog([
      GT.h('h2', {}, title),
      GT.h('p', { class: 'muted', style: { margin: 0 } }, message),
      GT.h('div', { class: 'dlg-actions' },
        GT.h('button', { class: 'btn', onclick: () => d.close('') }, 'Cancel'),
        GT.h('button', { class: 'btn ' + (danger ? 'danger solid' : 'primary'), onclick: () => d.close('ok') }, okText || 'OK')),
    ]);
    return (await d.closed) === 'ok';
  };
  GT.isDialogOpen = () => document.getElementById('dlg').open;

  /* ---------- download / pick file (works everywhere) ---------- */
  GT.download = function (filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    const a = GT.h('a', { href: url, download: filename });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  GT.pickTextFile = function (accept) {
    return new Promise((resolve) => {
      const inp = GT.h('input', { type: 'file', accept: accept || '.json,application/json', style: { display: 'none' } });
      inp.addEventListener('change', async () => {
        const f = inp.files && inp.files[0];
        inp.remove();
        resolve(f ? { name: f.name, text: await f.text() } : null);
      });
      inp.addEventListener('cancel', () => { inp.remove(); resolve(null); });
      document.body.append(inp); inp.click();
    });
  };
})();
