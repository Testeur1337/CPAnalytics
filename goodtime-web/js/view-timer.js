(function () {
  'use strict';
  const GT = window.GT;
  const { h, $ } = GT;
  const CIRC = 2 * Math.PI * 92;

  const el = {};
  let lastClock = '', lastRing = -1;

  /* ---------- label picker (also used from other views) ---------- */
  GT.pickLabel = function (currentId, onPick) {
    const active = GT.store.labels().filter((l) => !l.archived);
    const row = (id, name, color) => h('button', { class: 'item', onclick: () => { d.close(); onPick(id); } },
      h('span', { class: 'dot', style: { background: color } }),
      h('span', { class: 'grow t' }, name),
      id === currentId ? GT.icon('check', 'sm') : null);
    const d = GT.dialog([
      h('h2', {}, 'Choose a label'),
      h('div', { class: 'list' }, row(null, 'Unlabeled', 'var(--muted)'), active.map((l) => row(l.id, l.name, l.color))),
      h('div', { class: 'dlg-actions' },
        h('button', { class: 'btn', onclick: () => { d.close(); GT.editLabel(null, (l) => onPick(l.id)); } }, '+ New label'),
        h('button', { class: 'btn', onclick: () => d.close() }, 'Close')),
    ]);
  };

  function renderTimer() {
    const t = GT.store.timerState(), c = GT.store.settings();
    const idle = t.status === 'idle', running = t.status === 'running';
    document.body.dataset.phase = t.phase;
    document.body.classList.toggle('paused', t.status === 'paused');

    $('.phase-tabs').querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.phase === t.phase));
      b.disabled = !idle && b.dataset.phase !== t.phase;
    });

    GT.setIcon($('.ico', el.main), running ? 'pause' : 'play');
    el.mainText.textContent = running ? 'Pause' : t.status === 'paused' ? 'Resume' : t.phase === 'work' ? 'Start' : 'Start break';
    el.stop.disabled = idle;
    const countUp = GT.timer.isCountUp();
    el.skip.setAttribute('aria-label', idle ? 'Skip to next phase' : t.phase === 'work' ? 'Finish session' : 'Skip break');
    el.skip.title = idle ? 'Skip to next phase (N)' : t.phase === 'work' ? 'Finish this session now (N)' : 'Skip break (N)';
    el.plus.disabled = el.minus.disabled = countUp;

    // sub line
    let sub;
    if (t.status === 'paused') sub = 'Paused';
    else if (t.phase === 'work') sub = running ? (t.labelId ? GT.labelName(t.labelId) : 'Focusing') : countUp ? 'Flow mode · counts up' : 'Ready to focus';
    else sub = running ? (t.phase === 'long' ? 'Long break' : 'Break time') : t.phase === 'long' ? 'Time for a long break' : 'Time for a break';
    el.sub.textContent = sub;

    // label chip
    el.dot.style.background = GT.labelColor(t.labelId);
    el.labelName.textContent = GT.labelName(t.labelId);
    el.chip.style.visibility = t.phase === 'work' ? 'visible' : 'hidden';

    // cycle dots
    GT.clear(el.cycle);
    for (let i = 0; i < c.sessionsBeforeLong; i++) {
      const cls = i < t.cycle ? 'done' : i === t.cycle && t.phase === 'work' && !idle ? 'now' : '';
      el.cycle.append(h('i', { class: cls }));
    }
    el.cycle.title = `${t.cycle} of ${c.sessionsBeforeLong} sessions before a long break`;

    lastClock = ''; lastRing = -1;
    renderClock();
    renderToday();
  }

  function renderClock() {
    const t = GT.store.timerState();
    const now = Date.now();
    const text = GT.timer.isCountUp() && t.status !== 'idle' ? GT.elapsedClock(GT.timer.elapsed(now))
      : GT.timer.isCountUp() ? GT.elapsedClock(0)
      : GT.clock(t.status === 'idle' ? t.planned : GT.timer.remaining(now));
    if (text !== lastClock) {
      lastClock = text; el.clock.textContent = text;
      GT.updateTitle();
    }
    const p = t.status === 'idle' ? 0 : GT.timer.progress(now);
    const q = Math.round(p * 1000);
    if (q !== lastRing) {
      lastRing = q;
      el.ring.style.strokeDasharray = CIRC;
      el.ring.style.strokeDashoffset = CIRC * (1 - (t.status === 'idle' ? 0 : p));
      el.ring.style.opacity = t.status === 'idle' ? 0 : 1;
    }
  }

  function renderToday() {
    const c = GT.store.settings();
    const { ms, count } = GT.stats.today();
    const goal = c.dailyGoalMin * GT.MIN;
    const pct = goal > 0 ? Math.min(100, Math.round((ms / goal) * 100)) : 0;
    GT.clear(el.today).append(
      h('div', {}, h('b', {}, GT.dur(ms)), h('span', { class: 'muted small' }, 'Focus today')),
      h('div', {}, h('b', {}, count), h('span', { class: 'muted small' }, count === 1 ? 'Session' : 'Sessions')),
      h('div', {}, h('b', {}, goal > 0 ? pct + '%' : '–'), h('span', { class: 'muted small' }, goal > 0 ? `of ${GT.dur(goal)} goal` : 'No goal set')),
      goal > 0 ? h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Daily goal' }, h('i', { style: { width: pct + '%' } })) : null,
    );
  }

  function toggleFullscreen() {
    const on = !document.body.classList.contains('fs');
    document.body.classList.toggle('fs', on);
    if (on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  GT.toggleFullscreen = toggleFullscreen;

  GT.initTimerView = function () {
    Object.assign(el, {
      clock: $('#clock'), sub: $('#dial-sub'), ring: $('#ring-fg'), main: $('#btn-main'), mainText: $('#btn-main-text'),
      stop: $('#btn-stop'), skip: $('#btn-skip'), plus: $('#btn-plus'), minus: $('#btn-minus'),
      chip: $('#label-chip'), dot: $('#label-dot'), labelName: $('#label-name'), cycle: $('#cycle'), today: $('#today-card'),
    });
    el.main.addEventListener('click', () => GT.timer.toggle());
    el.stop.addEventListener('click', async () => {
      const t = GT.store.timerState();
      const long = t.phase === 'work' && GT.timer.elapsed() >= 5 * GT.MIN;
      if (long && !(await GT.confirm('Stop this session?', 'The time you have focused so far will be saved to your history.', 'Stop', false))) return;
      GT.timer.stop();
    });
    el.skip.addEventListener('click', () => GT.timer.skip());
    el.plus.addEventListener('click', () => GT.timer.addTime(GT.MIN));
    el.minus.addEventListener('click', () => GT.timer.addTime(-GT.MIN));
    el.chip.addEventListener('click', () => GT.pickLabel(GT.store.timerState().labelId, (id) => GT.timer.setLabel(id)));
    $('.phase-tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) GT.timer.setPhase(b.dataset.phase); });
    $('#btn-fullscreen').addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.body.classList.remove('fs'); });

    GT.on('change', renderTimer);
    GT.on('tick', renderClock);
    renderTimer();
  };
  GT.renderTimerView = renderTimer;
})();
