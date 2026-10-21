/* Timer engine.
 *
 * State is wall-clock based (elapsed = acc + now - runStart), so it stays correct
 * when the tab is throttled, the computer sleeps or the page is reloaded. The
 * state lives in the store document, so a running timer survives a refresh.
 *
 * phase:  work | short | long
 * status: idle | running | paused
 */
(function () {
  'use strict';
  const GT = window.GT;
  const S = () => GT.store.timerState();
  const cfg = () => GT.store.settings();

  const timer = (GT.timer = {
    isRunning: () => S().status === 'running',
    isPaused: () => S().status === 'paused',
    isIdle: () => S().status === 'idle',
    phase: () => S().phase,
    /* Focus phase in "flow" mode counts up with no fixed end. */
    isCountUp: () => S().phase === 'work' && cfg().countUp,

    elapsed(now) {
      const t = S();
      return t.acc + (t.status === 'running' ? Math.max(0, (now || Date.now()) - t.runStart) : 0);
    },
    remaining(now) { return S().planned - timer.elapsed(now); },

    plannedFor(phase) {
      const c = cfg(), t = S();
      if (phase === 'work') return c.workMin * GT.MIN;
      if (phase === 'long') return c.longMin * GT.MIN;
      return t.flowBreak > 0 ? t.flowBreak : c.shortMin * GT.MIN;
    },

    /* Fraction 0..1 of the ring that is filled. */
    progress(now) {
      if (timer.isCountUp()) return (timer.elapsed(now) % (cfg().workMin * GT.MIN)) / (cfg().workMin * GT.MIN);
      const p = S().planned;
      return p > 0 ? GT.clamp(timer.elapsed(now) / p, 0, 1) : 0;
    },

    /* ----- user actions ----- */
    start() {
      const t = S(), now = Date.now();
      if (t.status === 'running') return;
      if (t.status === 'idle') { t.acc = 0; t.firstStart = now; t.planned = timer.plannedFor(t.phase); }
      t.status = 'running'; t.runStart = now;
      commit('start');
    },
    pause() {
      const t = S(); if (t.status !== 'running') return;
      t.acc = timer.elapsed(); t.status = 'paused'; t.runStart = 0;
      commit('pause');
    },
    toggle() { timer.isRunning() ? timer.pause() : timer.start(); },

    /* Abort and reset. A partly done focus session is kept if long enough. */
    stop() {
      const t = S();
      if (t.status === 'idle') return;
      if (t.phase === 'work') recordWork(timer.elapsed(), Date.now(), true);
      toIdle(t.phase);
      commit('stop');
    },

    /* Finish the current phase now and move on to the next one. */
    skip() {
      const t = S();
      if (t.status === 'idle') { advance(t.phase, 0, false); commit('skip'); return; }
      finish(false);
    },

    addTime(ms) {
      const t = S();
      if (timer.isCountUp()) return;
      t.planned = Math.max(GT.MIN, t.planned + ms);
      if (t.status !== 'idle' && t.planned <= timer.elapsed()) t.planned = timer.elapsed() + 1000;
      commit('time');
    },

    /* Pick the phase while idle. */
    setPhase(p) {
      const t = S();
      if (t.status !== 'idle' || t.phase === p) return;
      t.phase = p; t.planned = timer.plannedFor(p);
      commit('phase');
    },

    setLabel(id) {
      S().labelId = id || null;
      commit('label');
    },

    /* Re-read durations from settings when idle. */
    refreshPlanned() {
      const t = S();
      if (t.status === 'idle') { t.planned = timer.plannedFor(t.phase); }
    },

    resetCycle() { S().cycle = 0; commit('cycle'); },

    /* ----- clock ----- */
    tick() {
      const t = S();
      if (t.status === 'running' && !timer.isCountUp() && timer.remaining() <= 0) finish(true);
      GT.emit('tick');
    },
  });

  function commit(why) {
    GT.store.save();
    GT.emit('timer', why);
    GT.emit('tick');
  }

  function toIdle(phase) {
    const t = S();
    t.status = 'idle'; t.acc = 0; t.runStart = 0; t.firstStart = 0;
    t.phase = phase; t.planned = timer.plannedFor(phase);
  }

  function recordWork(elapsed, endTs, interrupted) {
    const t = S();
    if (elapsed < Math.max(1000, cfg().minSaveSec * 1000)) return null;
    return GT.store.addSession({
      start: t.firstStart || endTs - elapsed,
      duration: Math.round(elapsed),
      end: endTs,
      labelId: t.labelId,
      interrupted,
    });
  }

  /* Move to the phase that follows `phase`. */
  function advance(phase, workElapsed, completedWork) {
    const t = S(), c = cfg();
    let next;
    if (phase === 'work') {
      if (completedWork) t.cycle += 1;
      next = t.cycle >= c.sessionsBeforeLong ? 'long' : 'short';
      // Flow mode: break length is proportional to the time actually focused.
      t.flowBreak = (c.countUp && completedWork && next === 'short')
        ? Math.max(GT.MIN, Math.round(workElapsed / c.flowRatio / GT.MIN) * GT.MIN) : 0;
    } else {
      if (phase === 'long') t.cycle = 0;
      t.flowBreak = 0;
      next = 'work';
    }
    toIdle(next);
  }

  /* End the running/paused phase. natural = the countdown reached zero. */
  function finish(natural) {
    const t = S(), c = cfg();
    const phase = t.phase;
    let elapsed = timer.elapsed();
    let endTs = Date.now();
    if (natural) {                       // credit exactly the planned time, timestamped when it really ended
      endTs = t.runStart + (t.planned - t.acc);
      elapsed = t.planned;
    }
    let completedWork = false;
    if (phase === 'work') {
      const rec = recordWork(elapsed, endTs, !natural && !timer.isCountUp());
      completedWork = !!rec || natural;
    }
    advance(phase, elapsed, completedWork);
    const auto = phase === 'work' ? c.autoStartBreak : c.autoStartWork;
    GT.emit('finished', { phase, natural, next: S().phase, auto });
    if (auto) { const now = Date.now(); t.status = 'running'; t.firstStart = now; t.runStart = now; }
    commit('finish');
  }

  /* Run the loop. 250ms keeps the displayed second accurate without being costly. */
  setInterval(() => timer.tick(), 250);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) timer.tick(); });

  /* A timer left running across a reload may have run out in the meantime. */
  GT.on('external-change', () => timer.tick());
})();
