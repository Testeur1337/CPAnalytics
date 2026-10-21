(function () {
  'use strict';
  const GT = window.GT;
  const { h } = GT;

  const state = { kind: 'week', offset: 0 };

  function kpi(label, value, sub) {
    return h('div', { class: 'kpi' }, h('div', { class: 'l' }, label), h('div', { class: 'v tnum' }, value), sub ? h('div', { class: 's' }, sub) : null);
  }

  GT.renderStats = function () {
    const root = GT.$('#view-stats');
    if (root.hidden) return;
    GT.clear(root);
    const c = GT.store.settings();
    const sessions = GT.store.sessions();
    const now = Date.now();

    root.append(h('div', { class: 'view-head' }, h('h1', {}, 'Stats')));

    if (!sessions.length) {
      root.append(h('div', { class: 'card empty' },
        h('p', { style: { fontSize: '1.1rem', margin: '0 0 6px' } }, 'No focus sessions yet'),
        h('p', { class: 'small', style: { margin: '0 0 14px' } }, 'Finish a session on the timer and your stats will show up here.'),
        h('button', { class: 'btn primary', onclick: () => GT.showView('timer') }, 'Go to the timer')));
      return;
    }

    /* KPIs */
    const today = GT.startOfDay(now);
    const wk = GT.startOfWeek(now, c.weekStart);
    const mo = GT.startOfMonth(now);
    const tD = GT.stats.sum(today, GT.addDays(today, 1));
    const tW = GT.stats.sum(wk, GT.addDays(wk, 7));
    const tM = GT.stats.sum(mo, GT.addMonths(mo, 1));
    const tA = GT.stats.sum(0, Infinity);
    const perDay = GT.stats.perDay();
    const streak = GT.stats.streaks(perDay);
    root.append(h('div', { class: 'kpis' },
      kpi('Today', GT.dur(tD.ms), `${tD.count} session${tD.count === 1 ? '' : 's'}`),
      kpi('This week', GT.dur(tW.ms), `${tW.count} session${tW.count === 1 ? '' : 's'}`),
      kpi('This month', GT.dur(tM.ms), `${tM.count} session${tM.count === 1 ? '' : 's'}`),
      kpi('All time', GT.dur(tA.ms), `${tA.count} session${tA.count === 1 ? '' : 's'}`),
      kpi('Current streak', `${streak.current} day${streak.current === 1 ? '' : 's'}`, `Best: ${streak.best}`),
      kpi('Avg. session', GT.dur(tA.ms / tA.count), 'all time')));

    /* Overview chart */
    const per = GT.stats.period(state.kind, state.offset);
    const totalMs = per.buckets.reduce((s, b) => s + b.total, 0);
    const totalN = per.buckets.reduce((s, b) => s + b.count, 0);
    const canNext = state.offset < 0;
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Range' },
      [['week', 'Week'], ['month', 'Month'], ['year', 'Year']].map(([k, label]) => h('button', {
        'aria-pressed': String(state.kind === k), onclick: () => { state.kind = k; state.offset = 0; GT.renderStats(); },
      }, label)));
    const nav = h('div', { class: 'period-nav' },
      h('button', { class: 'icon-btn', 'aria-label': 'Previous period', onclick: () => { state.offset--; GT.renderStats(); } }, GT.icon('left')),
      h('div', { class: 'title' }, per.title),
      h('button', { class: 'icon-btn', 'aria-label': 'Next period', disabled: !canNext, style: { opacity: canNext ? 1 : .35 }, onclick: () => { state.offset++; GT.renderStats(); } }, GT.icon('right')));

    const usedLabels = [...new Set(per.buckets.flatMap((b) => Object.keys(b.byLabel)))];
    const goalLine = state.kind === 'year' ? 0 : c.dailyGoalMin;
    root.append(h('div', { class: 'card' },
      h('div', { class: 'view-head', style: { marginBottom: '8px' } }, seg, nav),
      h('div', { class: 'muted small', style: { marginBottom: '8px' } }, totalN ? `${GT.dur(totalMs)} across ${totalN} session${totalN === 1 ? '' : 's'}` : 'No sessions in this period'),
      h('div', { class: 'chart' }, GT.barChart(per.buckets, goalLine)),
      h('div', { class: 'legend' },
        usedLabels.map((k) => h('span', {}, h('span', { class: 'dot', style: { background: GT.labelColor(k || null) } }), GT.labelName(k || null))),
        goalLine > 0 ? h('span', {}, h('span', { style: { width: '16px', borderTop: '2px dashed var(--accent)', display: 'inline-block' } }), 'Daily goal') : null)));

    /* Labels + hour of day */
    const byLabel = GT.stats.byLabel(per.start, per.end);
    const maxMs = Math.max(...byLabel.map((x) => x.ms), 1);
    const totalLabelMs = byLabel.reduce((s, x) => s + x.ms, 0) || 1;
    const labelsCard = h('div', { class: 'card' }, h('h2', {}, 'By label'),
      byLabel.length ? h('div', { class: 'hbars' }, byLabel.map((x) => h('div', { class: 'hbar' },
        h('div', { class: 'row' },
          h('span', { style: { display: 'inline-flex', gap: '8px', alignItems: 'center' } }, h('span', { class: 'dot', style: { background: GT.labelColor(x.id) } }), GT.labelName(x.id)),
          h('span', { class: 'muted tnum' }, `${GT.dur(x.ms)} · ${Math.round((x.ms / totalLabelMs) * 100)}%`)),
        h('div', { class: 'track' }, h('i', { style: { width: (x.ms / maxMs) * 100 + '%', background: GT.labelColor(x.id) } })))))
        : h('p', { class: 'muted small' }, 'Nothing to show for this period.'));
    const hourCard = h('div', { class: 'card' }, h('h2', {}, 'Time of day'),
      per.buckets.some((b) => b.total) ? h('div', { class: 'chart' }, GT.hourChart(GT.stats.hourOfDay(per.start, per.end))) : h('p', { class: 'muted small' }, 'Nothing to show for this period.'));
    root.append(h('div', { class: 'two', style: { marginTop: '16px' } }, labelsCard, hourCard));

    /* Heatmap */
    root.append(h('div', { class: 'card' }, h('h2', {}, 'Last 6 months'), GT.heatmap(perDay, c.dailyGoalMin),
      h('p', { class: 'muted small', style: { margin: '10px 0 0' } }, 'Darker squares mean more focus time that day.')));
  };

  GT.on('change', () => GT.renderStats && GT.renderStats());
})();
