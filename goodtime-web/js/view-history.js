(function () {
  'use strict';
  const GT = window.GT;
  const { h } = GT;

  const state = { filter: 'all', shown: 100 };

  function labelSelect(current) {
    const sel = h('select', { id: 'f-label' }, h('option', { value: '' }, 'Unlabeled'));
    GT.store.labels().filter((l) => !l.archived || l.id === current).forEach((l) => sel.append(h('option', { value: l.id, selected: l.id === current }, l.name + (l.archived ? ' (archived)' : ''))));
    return sel;
  }

  /* Add (session == null) or edit a session. */
  GT.editSession = function (session) {
    const isNew = !session;
    const now = Date.now();
    const base = session || { start: now - 25 * GT.MIN, duration: 25 * GT.MIN, labelId: null, note: '' };
    const sel = labelSelect(base.labelId);
    const start = h('input', { type: 'datetime-local', id: 'f-start', value: GT.toLocalInput(base.start), max: GT.toLocalInput(now) });
    const mins = h('input', { type: 'number', id: 'f-dur', min: 1, max: 1440, step: 1, value: Math.max(1, Math.round(base.duration / GT.MIN)) });
    const note = h('textarea', { id: 'f-note', maxlength: 1000, placeholder: 'What did you work on?' });
    note.value = base.note || '';
    const err = h('div', { class: 'small', style: { color: 'var(--danger)', minHeight: '1.2em' }, role: 'alert' });

    const save = () => {
      const st = GT.fromLocalInput(start.value);
      const du = Math.round(Number(mins.value));
      if (!Number.isFinite(st)) { err.textContent = 'Enter a valid start time.'; return; }
      if (!(du >= 1 && du <= 1440)) { err.textContent = 'Duration must be between 1 and 1440 minutes.'; return; }
      if (st + du * GT.MIN > Date.now() + GT.MIN) { err.textContent = 'A session cannot end in the future.'; return; }
      const rec = { start: st, duration: du * GT.MIN, labelId: sel.value || null, note: note.value.trim() };
      if (isNew) GT.store.addSession(rec); else GT.store.updateSession(session.id, rec);
      d.close('saved');
      GT.toast(isNew ? 'Session added' : 'Session updated');
    };
    const d = GT.dialog([
      h('h2', {}, isNew ? 'Add session' : 'Edit session'),
      h('div', { class: 'field' }, h('label', { for: 'f-label' }, 'Label'), sel),
      h('div', { class: 'row2' },
        h('div', { class: 'field' }, h('label', { for: 'f-start' }, 'Started'), start),
        h('div', { class: 'field' }, h('label', { for: 'f-dur' }, 'Duration (minutes)'), mins)),
      h('div', { class: 'field' }, h('label', { for: 'f-note' }, 'Note'), note),
      err,
      h('div', { class: 'dlg-actions' },
        isNew ? null : h('button', { class: 'btn danger spacer', onclick: async () => {
          if (await GT.confirm('Delete this session?', 'It will be removed from your history and stats.', 'Delete', true)) {
            GT.store.deleteSession(session.id); GT.toast('Session deleted');
          } else GT.editSession(session);
        } }, 'Delete'),
        h('button', { class: 'btn', onclick: () => d.close() }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: save }, 'Save')),
    ]);
    d.el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); save(); } });
    setTimeout(() => mins.focus(), 30);
  };

  GT.renderHistory = function () {
    const root = GT.$('#view-history');
    if (root.hidden) return;
    GT.clear(root);

    const filterSel = h('select', { 'aria-label': 'Filter by label', style: { width: 'auto' }, onchange: (e) => { state.filter = e.target.value; state.shown = 100; GT.renderHistory(); } },
      h('option', { value: 'all' }, 'All labels'),
      h('option', { value: 'none', selected: state.filter === 'none' }, 'Unlabeled'),
      GT.store.labels().map((l) => h('option', { value: l.id, selected: state.filter === l.id }, l.name)));
    if (state.filter === 'all') filterSel.value = 'all';

    root.append(h('div', { class: 'view-head' }, h('h1', {}, 'History'),
      h('div', { class: 'toolbar' }, filterSel, h('button', { class: 'btn primary', onclick: () => GT.editSession(null) }, GT.icon('plus', 'sm'), 'Add session'))));

    let list = GT.store.sessions().slice().reverse();
    if (state.filter === 'none') list = list.filter((s) => !s.labelId);
    else if (state.filter !== 'all') list = list.filter((s) => s.labelId === state.filter);

    if (!list.length) {
      root.append(h('div', { class: 'card empty' },
        h('p', { style: { fontSize: '1.1rem', margin: '0 0 6px' } }, GT.store.sessions().length ? 'No sessions match this filter' : 'Your history is empty'),
        h('p', { class: 'small', style: { margin: 0 } }, 'Completed focus sessions appear here. You can also add one manually.')));
      return;
    }

    const card = h('div', { class: 'card', style: { paddingTop: '4px' } });
    let day = null, dayMs = 0, head = null, count = 0;
    const flush = () => { if (head) head.lastChild.textContent = GT.dur(dayMs); };
    for (const s of list.slice(0, state.shown)) {
      const k = GT.dayKey(s.start);
      if (k !== day) {
        flush(); day = k; dayMs = 0;
        head = h('div', { class: 'day-head' }, h('span', {}, GT.dayTitle(s.start)), h('span', {}));
        card.append(head);
      }
      dayMs += s.duration; count++;
      card.append(h('button', { class: 'item', onclick: () => GT.editSession(s), 'aria-label': `Edit session ${GT.labelName(s.labelId)} ${GT.dur(s.duration)}` },
        h('span', { class: 'dot', style: { background: GT.labelColor(s.labelId) } }),
        h('span', { class: 'grow' },
          h('div', { class: 't' }, GT.labelName(s.labelId), s.interrupted ? h('span', { class: 'badge', style: { marginLeft: '8px' } }, 'stopped early') : null),
          h('div', { class: 'note' }, `${GT.timeStr(s.start)} – ${GT.timeStr(s.start + s.duration)}`, s.note ? ' · ' + s.note : '')),
        h('span', { class: 'tnum', style: { fontWeight: 600 } }, GT.dur(s.duration))));
    }
    flush();
    root.append(card);
    if (list.length > state.shown) {
      root.append(h('div', { style: { textAlign: 'center', marginTop: '14px' } },
        h('button', { class: 'btn', onclick: () => { state.shown += 100; GT.renderHistory(); } }, `Show more (${list.length - state.shown} left)`)));
    }
  };

  GT.on('change', () => GT.renderHistory && GT.renderHistory());
})();
