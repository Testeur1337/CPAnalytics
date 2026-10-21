(function () {
  'use strict';
  const GT = window.GT;
  const { h } = GT;

  /* Create (label == null) or edit a label. onDone(label) runs after creation. */
  GT.editLabel = function (label, onDone) {
    const isNew = !label;
    let color = label ? label.color : GT.LABEL_COLORS[GT.store.labels().length % GT.LABEL_COLORS.length];
    const name = h('input', { type: 'text', id: 'l-name', maxlength: 60, placeholder: 'e.g. Study, Writing, Code', value: label ? label.name : '', autocomplete: 'off' });
    const custom = h('input', { type: 'color', 'aria-label': 'Custom colour', value: color, oninput: (e) => pick(e.target.value) });
    const sw = h('div', { class: 'swatches', role: 'group', 'aria-label': 'Colour' });
    const draw = () => {
      GT.clear(sw);
      GT.LABEL_COLORS.forEach((c) => sw.append(h('button', { class: 'swatch', style: { background: c }, 'aria-label': c, 'aria-pressed': String(c.toLowerCase() === color.toLowerCase()), onclick: () => pick(c) })));
      sw.append(custom);
    };
    const pick = (c) => { color = c; custom.value = c; draw(); };
    draw();
    const err = h('div', { class: 'small', style: { color: 'var(--danger)', minHeight: '1.2em' }, role: 'alert' });
    const save = () => {
      const n = name.value.trim();
      if (!n) { err.textContent = 'Give the label a name.'; name.focus(); return; }
      const dup = GT.store.labels().some((l) => l.name.toLowerCase() === n.toLowerCase() && (!label || l.id !== label.id));
      if (dup) { err.textContent = 'A label with that name already exists.'; return; }
      if (isNew) { const l = GT.store.addLabel(n, color); d.close('saved'); if (onDone) onDone(l); }
      else { GT.store.updateLabel(label.id, { name: n, color }); d.close('saved'); }
    };
    const d = GT.dialog([
      h('h2', {}, isNew ? 'New label' : 'Edit label'),
      h('div', { class: 'field' }, h('label', { for: 'l-name' }, 'Name'), name),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Colour'), sw),
      err,
      h('div', { class: 'dlg-actions' },
        h('button', { class: 'btn', onclick: () => d.close() }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: save }, 'Save')),
    ]);
    d.el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === name) { e.preventDefault(); save(); } });
    setTimeout(() => name.focus(), 30);
  };

  GT.renderLabels = function () {
    const root = GT.$('#view-labels');
    if (root.hidden) return;
    GT.clear(root);
    root.append(h('div', { class: 'view-head' }, h('h1', {}, 'Labels'),
      h('button', { class: 'btn primary', onclick: () => GT.editLabel(null) }, GT.icon('plus', 'sm'), 'New label')));

    const labels = GT.store.labels();
    const unl = GT.store.labelStats(null);
    const row = (l) => {
      const st = GT.store.labelStats(l.id);
      return h('div', { class: 'item', style: l.archived ? { opacity: .6 } : {} },
        h('span', { class: 'dot', style: { background: l.color } }),
        h('span', { class: 'grow' }, h('div', { class: 't' }, l.name, l.archived ? h('span', { class: 'badge', style: { marginLeft: '8px' } }, 'archived') : null),
          h('div', { class: 'note' }, `${st.count} session${st.count === 1 ? '' : 's'} · ${GT.dur(st.ms)}`)),
        h('button', { class: 'btn sm', onclick: () => GT.editLabel(l) }, 'Edit'),
        h('button', { class: 'btn sm', onclick: () => { GT.store.updateLabel(l.id, { archived: !l.archived }); GT.toast(l.archived ? 'Label restored' : 'Label archived'); } }, l.archived ? 'Restore' : 'Archive'),
        h('button', { class: 'btn sm danger', onclick: async () => {
          const st2 = GT.store.labelStats(l.id);
          const msg = st2.count ? `${st2.count} session${st2.count === 1 ? '' : 's'} will keep their time but become unlabeled. Consider archiving instead.` : 'This label has no sessions.';
          if (await GT.confirm(`Delete “${l.name}”?`, msg, 'Delete', true)) GT.store.deleteLabel(l.id);
        } }, 'Delete'));
    };

    const card = h('div', { class: 'card', style: { paddingTop: '6px', paddingBottom: '6px' } });
    card.append(h('div', { class: 'item' },
      h('span', { class: 'dot', style: { background: GT.labelColor(null) } }),
      h('span', { class: 'grow' }, h('div', { class: 't' }, 'Unlabeled'), h('div', { class: 'note' }, `${unl.count} session${unl.count === 1 ? '' : 's'} · ${GT.dur(unl.ms)}`))));
    labels.filter((l) => !l.archived).forEach((l) => card.append(row(l)));
    labels.filter((l) => l.archived).forEach((l) => card.append(row(l)));
    root.append(card);
    if (!labels.length) root.append(h('p', { class: 'muted', style: { textAlign: 'center' } }, 'Labels let you tag what you worked on, then see where your time goes in Stats.'));
  };

  GT.on('change', () => GT.renderLabels && GT.renderLabels());
})();
