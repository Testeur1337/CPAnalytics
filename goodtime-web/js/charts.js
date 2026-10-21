/* Stats aggregation and tiny SVG chart helpers (no chart library). */
(function () {
  'use strict';
  const GT = window.GT;
  const { h, svg } = GT;

  const NONE_COLOR = '#94a3b8';
  GT.labelColor = (id) => { const l = id && GT.store.label(id); return l ? l.color : NONE_COLOR; };
  GT.labelName = (id) => { const l = id && GT.store.label(id); return l ? l.name : 'Unlabeled'; };

  const stats = (GT.stats = {
    /* Total focus time and session count whose start lies in [from, to). */
    sum(from, to, labelId) {
      let ms = 0, count = 0;
      for (const s of GT.store.sessions()) {
        if (s.start >= from && s.start < to && (labelId === undefined || (s.labelId || null) === labelId)) { ms += s.duration; count++; }
      }
      return { ms, count };
    },
    today() { const a = GT.startOfDay(Date.now()); return stats.sum(a, GT.addDays(a, 1)); },

    /* Fill buckets [{start,end}] with totals, split per label. */
    fill(buckets) {
      buckets.forEach((b) => { b.total = 0; b.count = 0; b.byLabel = {}; });
      const sessions = GT.store.sessions();
      for (const s of sessions) {
        const b = buckets.find((x) => s.start >= x.start && s.start < x.end);
        if (!b) continue;
        const k = s.labelId || '';
        b.byLabel[k] = (b.byLabel[k] || 0) + s.duration;
        b.total += s.duration; b.count++;
      }
      return buckets;
    },

    /* A period of the given kind ('week' | 'month' | 'year') shifted by `offset` periods. */
    period(kind, offset) {
      const ws = GT.store.settings().weekStart;
      const now = Date.now();
      let start, end, buckets = [], title;
      if (kind === 'week') {
        start = GT.addDays(GT.startOfWeek(now, ws), offset * 7);
        end = GT.addDays(start, 7);
        for (let i = 0; i < 7; i++) {
          const a = GT.addDays(start, i);
          buckets.push({ start: a, end: GT.addDays(a, 1), label: GT.dateStr(a, { weekday: 'short' }), tip: GT.dateStr(a, { weekday: 'long', month: 'short', day: 'numeric' }) });
        }
        title = `${GT.dateStr(start, { month: 'short', day: 'numeric' })} – ${GT.dateStr(GT.addDays(end, -1), { month: 'short', day: 'numeric' })}`;
        if (offset === 0) title = 'This week';
      } else if (kind === 'month') {
        start = GT.addMonths(GT.startOfMonth(now), offset);
        end = GT.addMonths(start, 1);
        const n = Math.round((end - start) / GT.DAY);
        for (let i = 0; i < n; i++) {
          const a = GT.addDays(start, i);
          buckets.push({ start: a, end: GT.addDays(a, 1), label: String(new Date(a).getDate()), tip: GT.dateStr(a, { weekday: 'short', month: 'short', day: 'numeric' }) });
        }
        title = offset === 0 ? 'This month' : GT.dateStr(start, { month: 'long', year: 'numeric' });
      } else {
        start = GT.addMonths(GT.startOfYear(now), offset * 12);
        end = GT.addMonths(start, 12);
        for (let i = 0; i < 12; i++) {
          const a = GT.addMonths(start, i);
          buckets.push({ start: a, end: GT.addMonths(a, 1), label: GT.dateStr(a, { month: 'short' }), tip: GT.dateStr(a, { month: 'long', year: 'numeric' }) });
        }
        title = offset === 0 ? 'This year' : String(new Date(start).getFullYear());
      }
      return { kind, offset, start, end, buckets: stats.fill(buckets), title };
    },

    /* Per-label totals inside [from, to), sorted by time, biggest first. */
    byLabel(from, to) {
      const m = new Map();
      for (const s of GT.store.sessions()) {
        if (s.start < from || s.start >= to) continue;
        const k = s.labelId || '';
        const cur = m.get(k) || { id: k || null, ms: 0, count: 0 };
        cur.ms += s.duration; cur.count++; m.set(k, cur);
      }
      return [...m.values()].sort((a, b) => b.ms - a.ms);
    },

    /* Minutes per day, keyed by dayKey, plus streak info. */
    perDay() {
      const m = new Map();
      for (const s of GT.store.sessions()) {
        const k = GT.dayKey(s.start);
        m.set(k, (m.get(k) || 0) + s.duration);
      }
      return m;
    },
    streaks(perDay) {
      const today = GT.startOfDay(Date.now());
      let current = 0;
      let d = today;
      if (!perDay.has(GT.dayKey(d))) d = GT.addDays(d, -1);   // today not done yet: streak continues from yesterday
      while (perDay.has(GT.dayKey(d))) { current++; d = GT.addDays(d, -1); }
      let best = 0, run = 0;
      const keys = [...perDay.keys()].sort();
      let prev = null;
      for (const k of keys) {
        const t = new Date(k + 'T00:00:00').getTime();
        run = prev !== null && GT.addDays(prev, 1) === t ? run + 1 : 1;
        best = Math.max(best, run); prev = t;
      }
      return { current, best };
    },

    /* Focus ms per hour of day (0..23), splitting sessions across hour boundaries. */
    hourOfDay(from, to) {
      const hours = new Array(24).fill(0);
      for (const s of GT.store.sessions()) {
        if (s.start < from || s.start >= to) continue;
        let t = s.start; const end = s.start + s.duration;
        while (t < end) {
          const d = new Date(t);
          const nextHour = new Date(t); nextHour.setMinutes(0, 0, 0); nextHour.setHours(d.getHours() + 1);
          const stop = Math.min(end, nextHour.getTime());
          hours[d.getHours()] += stop - t; t = stop;
        }
      }
      return hours;
    },
  });

  /* ---------- charts ---------- */

  /* Pick a "nice" axis maximum (in minutes) and tick step. */
  function niceScale(maxMs) {
    const maxMin = Math.max(30, maxMs / GT.MIN);
    const steps = [10, 15, 30, 60, 120, 180, 240, 360, 480, 720, 1440, 2880, 5760, 11520, 23040, 46080];
    let step = steps[steps.length - 1];
    for (const s of steps) if (maxMin / s <= 5) { step = s; break; }
    const top = Math.ceil(maxMin / step) * step;
    return { step, top };
  }
  const axisLabel = (min) => (min === 0 ? '0' : min % 60 === 0 ? `${min / 60}h` : min >= 60 ? `${Math.floor(min / 60)}h${min % 60}` : `${min}m`);

  /* Stacked-by-label bar chart for stats.period() buckets. */
  GT.barChart = function (buckets, goalMin) {
    const W = 620, H = 230, L = 38, R = 8, T = 10, B = 26;
    const { step, top } = niceScale(Math.max(...buckets.map((b) => b.total), (goalMin || 0) * GT.MIN));
    const iw = W - L - R, ih = H - T - B;
    const y = (min) => T + ih - (min / top) * ih;
    const n = buckets.length, slot = iw / n, bw = Math.max(3, Math.min(34, slot * 0.66));
    const root = svg('svg', { class: 'bc', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Focus time chart' });
    for (let m = 0; m <= top; m += step) {
      root.append(svg('line', { class: 'grid', x1: L, x2: W - R, y1: y(m), y2: y(m) }));
      root.append(svg('text', { x: L - 6, y: y(m) + 4, 'text-anchor': 'end' }, axisLabel(m)));
    }
    const every = n > 20 ? 3 : 1;
    buckets.forEach((b, i) => {
      const cx = L + slot * i + slot / 2;
      let acc = 0;
      const order = Object.entries(b.byLabel).sort((a, c) => c[1] - a[1]);
      const g = svg('g', {});
      g.append(svg('title', {}, `${b.tip}: ${b.total ? GT.dur(b.total) : 'no focus'}${b.count ? ` · ${b.count} session${b.count > 1 ? 's' : ''}` : ''}`));
      // transparent hit area keeps tooltips usable on empty bars
      g.append(svg('rect', { x: cx - slot / 2, y: T, width: slot, height: ih, fill: 'transparent' }));
      for (const [k, ms] of order) {
        const min = ms / GT.MIN, y0 = y(acc), y1 = y(acc + min);
        g.append(svg('rect', { class: 'bar', x: cx - bw / 2, y: y1, width: bw, height: Math.max(1, y0 - y1), rx: 3, fill: GT.labelColor(k || null) }));
        acc += min;
      }
      root.append(g);
      if (i % every === 0) root.append(svg('text', { x: cx, y: H - 7, 'text-anchor': 'middle' }, b.label));
    });
    if (goalMin > 0 && goalMin <= top) {
      root.append(svg('line', { x1: L, x2: W - R, y1: y(goalMin), y2: y(goalMin), stroke: 'var(--accent)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
    }
    return root;
  };

  GT.hourChart = function (hours) {
    const W = 360, H = 150, L = 6, R = 6, T = 8, B = 22;
    const max = Math.max(...hours, 1);
    const iw = W - L - R, ih = H - T - B, slot = iw / 24, bw = slot * 0.72;
    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Focus by hour of day' });
    hours.forEach((ms, i) => {
      const hh = (ms / max) * ih, x = L + slot * i + (slot - bw) / 2;
      const g = svg('g', {});
      g.append(svg('title', {}, `${GT.pad(i)}:00 – ${GT.pad((i + 1) % 24)}:00 · ${GT.dur(ms)}`));
      g.append(svg('rect', { x: L + slot * i, y: T, width: slot, height: ih, fill: 'transparent' }));
      g.append(svg('rect', { class: 'bar', x, y: T + ih - Math.max(hh, ms ? 2 : 0), width: bw, height: Math.max(hh, ms ? 2 : 0), rx: 2, fill: 'var(--accent)' }));
      root.append(g);
      if (i % 3 === 0) root.append(svg('text', { x: L + slot * i + slot / 2, y: H - 6, 'text-anchor': 'middle' }, String(i)));
    });
    return root;
  };

  /* GitHub-style heatmap of the last ~26 weeks. */
  GT.heatmap = function (perDay, goalMin) {
    const ws = GT.store.settings().weekStart;
    const weeks = 26;
    const startWeek = GT.addDays(GT.startOfWeek(Date.now(), ws), -(weeks - 1) * 7);
    const todayStart = GT.startOfDay(Date.now());
    const scale = Math.max(goalMin > 0 ? goalMin : 60, 30) * GT.MIN;
    const box = h('div', { class: 'heat', role: 'img', 'aria-label': 'Daily focus heatmap' });
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const t = GT.addDays(startWeek, w * 7 + d);
        const cell = h('i', {});
        if (t > todayStart) { cell.style.visibility = 'hidden'; box.append(cell); continue; }
        const ms = perDay.get(GT.dayKey(t)) || 0;
        if (ms > 0) {
          const pct = Math.round(25 + 75 * Math.min(1, ms / scale));
          cell.style.background = `color-mix(in srgb, var(--accent) ${pct}%, var(--surface2))`;
        }
        cell.title = `${GT.dateStr(t, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}: ${ms ? GT.dur(ms) : 'no focus'}`;
        box.append(cell);
      }
    }
    queueMicrotask(() => { box.scrollLeft = box.scrollWidth; });
    return box;
  };
})();
