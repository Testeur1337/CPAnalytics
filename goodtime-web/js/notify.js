/* Side effects around the timer: sound, notifications, vibration, wake lock,
 * tab title and theming. Pure browser APIs, all feature-detected. */
(function () {
  'use strict';
  const GT = window.GT;
  const cfg = () => GT.store.settings();

  /* ---------- sound (WebAudio synthesis, no audio files) ---------- */
  let ctx = null;
  /* Browsers block audio and vibration until the user has interacted with the page. */
  const userActive = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  function audio() {
    if (!userActive()) return null;
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(freq, start, len, type, vol) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    const t0 = a.currentTime + start;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(g).connect(a.destination);
    o.start(t0); o.stop(t0 + len + 0.05);
  }
  const SOUNDS = {
    bell: (v) => { [[880, 0], [1320, 0], [880, 0.9], [1320, 0.9]].forEach(([f, s]) => tone(f, s, 1.6, 'sine', v * 0.5)); },
    chime: (v) => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.18, 1.1, 'triangle', v * 0.6)); },
    beep: (v) => { [0, 0.3, 0.6].forEach((s) => tone(880, s, 0.18, 'square', v * 0.25)); },
    digital: (v) => { [1200, 900, 1200, 900].forEach((f, i) => tone(f, i * 0.14, 0.12, 'sawtooth', v * 0.25)); },
  };
  GT.playSound = function (kind, volume) {
    const fn = SOUNDS[kind || cfg().soundKind] || SOUNDS.bell;
    try { fn(volume == null ? cfg().volume : volume); } catch (e) { console.warn(e); }
  };
  /* Browsers only allow audio after a user gesture; unlock on the first one. */
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => audio(), { once: true, passive: true }));

  /* ---------- system notifications ---------- */
  GT.notificationsSupported = () => 'Notification' in window;
  GT.requestNotifications = async function () {
    if (!GT.notificationsSupported()) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try { return await Notification.requestPermission(); } catch (_) { return 'denied'; }
  };
  const PHASE_NAME = { work: 'Focus', short: 'Break', long: 'Long break' };
  GT.phaseName = (p) => PHASE_NAME[p] || p;

  GT.on('finished', ({ phase, natural, next }) => {
    const c = cfg();
    if (natural) {
      if (c.sound) GT.playSound();
      if (c.vibrate && navigator.vibrate && userActive()) navigator.vibrate([250, 120, 250]);
      if (c.notify && GT.notificationsSupported() && Notification.permission === 'granted') {
        try {
          const n = new Notification(phase === 'work' ? 'Focus session complete' : 'Break is over', {
            body: `Up next: ${PHASE_NAME[next].toLowerCase()}.`, tag: 'goodtime-phase', renotify: true,
          });
          n.onclick = () => { window.focus(); n.close(); };
        } catch (_) { /* some browsers only allow notifications from a service worker */ }
      }
      GT.toast(phase === 'work' ? 'Focus session complete' : 'Break is over');
    }
  });

  /* ---------- wake lock ---------- */
  let lock = null;
  async function syncWakeLock() {
    const want = GT.timer.isRunning() && cfg().keepAwake && !document.hidden;
    try {
      if (want && !lock && navigator.wakeLock) {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      } else if (!want && lock) { await lock.release(); lock = null; }
    } catch (_) { lock = null; }
  }
  GT.on('timer', syncWakeLock);
  document.addEventListener('visibilitychange', syncWakeLock);

  /* ---------- tab title ---------- */
  GT.updateTitle = function () {
    const t = GT.store.timerState();
    if (t.status === 'idle') { document.title = 'Goodtime Web'; return; }
    const clock = GT.timer.isCountUp() ? GT.elapsedClock(GT.timer.elapsed()) : GT.clock(GT.timer.remaining());
    document.title = `${clock} · ${PHASE_NAME[t.phase]}${t.status === 'paused' ? ' (paused)' : ''}`;
  };

  /* ---------- theme ---------- */
  GT.applyTheme = function () {
    const c = cfg(), root = document.documentElement;
    if (c.theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', c.theme);
    root.style.setProperty('--accent', c.accent);
    root.style.setProperty('--break', c.breakColor);
    // Pick readable text colour on the accent.
    const n = parseInt(c.accent.slice(1), 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    root.style.setProperty('--accent-ink', lum > 0.72 ? '#111' : '#fff');
  };
})();
