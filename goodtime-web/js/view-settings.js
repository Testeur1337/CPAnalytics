(function () {
  'use strict';
  const GT = window.GT;
  const { h } = GT;

  const cfg = () => GT.store.settings();
  function set(key, value) {
    cfg()[key] = value;
    GT.timer.refreshPlanned();
    GT.applyTheme();
    GT.store.save();
    GT.renderTimerView();
    if (key === 'countUp') GT.renderSettings();   // shows/hides the flow ratio row
  }

  /* ----- row builders ----- */
  function row(name, desc, control) {
    return h('div', { class: 'setting' }, h('div', { class: 'txt' }, h('div', { class: 'name' }, name), desc ? h('div', { class: 'desc' }, desc) : null), control);
  }
  function toggle(name, desc, key, after) {
    const inp = h('input', { type: 'checkbox', checked: !!cfg()[key], 'aria-label': name, onchange: async (e) => {
      const v = e.target.checked;
      if (after) { const ok = await after(v); if (ok === false) { e.target.checked = !v; return; } }
      set(key, v);
    } });
    return row(name, desc, h('label', { class: 'switch' }, inp, h('span', {})));
  }
  function number(name, desc, key, min, max, step, unit) {
    const inp = h('input', { type: 'number', min, max, step: step || 1, value: cfg()[key], 'aria-label': name, onchange: (e) => {
      let v = Number(e.target.value);
      if (!Number.isFinite(v)) v = cfg()[key];
      v = GT.clamp(step && step < 1 ? v : Math.round(v), min, max);
      e.target.value = v; set(key, v);
    } });
    return row(name, desc, unit ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, inp, h('span', { class: 'muted small' }, unit)) : inp);
  }
  function select(name, desc, key, options, parse) {
    const sel = h('select', { 'aria-label': name, onchange: (e) => set(key, parse ? parse(e.target.value) : e.target.value) },
      options.map(([v, label]) => h('option', { value: v, selected: String(cfg()[key]) === String(v) }, label)));
    return row(name, desc, sel);
  }
  function colorRow(name, key) {
    const wrap = h('div', { class: 'swatches', style: { justifyContent: 'flex-end' } });
    const draw = () => {
      GT.clear(wrap);
      GT.LABEL_COLORS.concat(key === 'accent' ? ['#0ea5e9'] : []).forEach((c) => wrap.append(h('button', { class: 'swatch', style: { background: c }, 'aria-label': c, 'aria-pressed': String(cfg()[key].toLowerCase() === c), onclick: () => { set(key, c); draw(); } })));
      wrap.append(h('input', { type: 'color', value: cfg()[key], 'aria-label': 'Custom ' + name, onchange: (e) => { set(key, e.target.value); draw(); } }));
    };
    draw();
    return h('div', { class: 'setting', style: { flexWrap: 'wrap' } }, h('div', { class: 'txt' }, h('div', { class: 'name' }, name)), wrap);
  }

  /* ----- data section ----- */
  function fileStatusLine() {
    const f = GT.file;
    if (!f.supported) {
      return h('div', { class: 'status warn' }, 'This browser cannot write to files directly. Use Export and Import below, or open the app in Chrome or Edge to auto-save to a file.');
    }
    if (f.status === 'ok') return h('div', { class: 'status ok' }, `Auto-saving to “${f.name}”${f.lastSaved ? ' · last saved ' + GT.timeStr(f.lastSaved) : ''}`);
    if (f.status === 'needs-permission') return h('div', { class: 'status warn' }, `“${f.name}” is linked, but the browser needs your permission again to write to it.`);
    if (f.status === 'error') return h('div', { class: 'status bad' }, 'File error: ' + (f.error || 'unknown'));
    return h('div', { class: 'status' }, 'No file linked. Data is stored only in this browser.');
  }

  async function chooseImport(raw, fileName) {
    const inc = GT.store.normalize(raw);
    const hasLocal = GT.store.sessions().length || GT.store.labels().length;
    return new Promise((resolve) => {
      const d = GT.dialog([
        h('h2', {}, 'Import data'),
        h('p', { style: { marginTop: 0 } }, `${fileName ? '“' + fileName + '” contains' : 'This file contains'} ${inc.sessions.length} session${inc.sessions.length === 1 ? '' : 's'} and ${inc.labels.length} label${inc.labels.length === 1 ? '' : 's'}.`),
        hasLocal ? h('p', { class: 'muted small' }, `You currently have ${GT.store.sessions().length} session${GT.store.sessions().length === 1 ? '' : 's'}. Merge keeps both and skips duplicates. Replace overwrites everything, including settings.`) : null,
        h('div', { class: 'dlg-actions' },
          h('button', { class: 'btn', onclick: () => d.close('cancel') }, 'Cancel'),
          hasLocal ? h('button', { class: 'btn', onclick: () => d.close('merge') }, 'Merge') : null,
          h('button', { class: 'btn primary', onclick: () => d.close('replace') }, 'Replace')),
      ]);
      d.closed.then((v) => resolve(v || 'cancel'));
    });
  }

  async function importFrom(raw, fileName) {
    const choice = await chooseImport(raw, fileName);
    if (choice === 'replace') { GT.store.replaceAll(raw); GT.toast('Data replaced'); }
    else if (choice === 'merge') { const r = GT.store.mergeIn(raw); GT.toast(`Added ${r.sessions} session${r.sessions === 1 ? '' : 's'} and ${r.labels} label${r.labels === 1 ? '' : 's'}`); }
    else return false;
    GT.applyTheme(); GT.timer.refreshPlanned();
    return true;
  }

  function dataCard() {
    const f = GT.file;
    const bytes = new Blob([GT.store.toJSON()]).size;
    const btns = h('div', { class: 'btn-row' });
    if (f.supported) {
      if (f.status === 'needs-permission') btns.append(h('button', { class: 'btn primary', onclick: () => f.reconnect() }, 'Allow access again'));
      if (f.status === 'none' || f.status === 'error') {
        btns.append(
          h('button', { class: 'btn primary', onclick: async () => {
            try { await f.createAndLink(); GT.toast('Auto-save to file is on'); } catch (e) { if (e.name !== 'AbortError') GT.toast('Could not link file: ' + e.message); }
          } }, 'Save to a new file…'),
          h('button', { class: 'btn', onclick: async () => {
            try {
              const raw = await f.openAndLink();
              if (raw) {
                const ok = await importFrom(raw, f.name);
                if (!ok) { await f.unlink(); return; }
              }
              await f.write(); GT.toast('Auto-save to file is on');
            } catch (e) { if (e.name !== 'AbortError') GT.toast('Could not open file: ' + e.message); }
          } }, 'Use an existing file…'));
      } else {
        btns.append(h('button', { class: 'btn', onclick: () => f.write().then(() => GT.toast('Saved')) }, 'Save now'),
          h('button', { class: 'btn', onclick: async () => { await f.unlink(); GT.toast('File unlinked'); } }, 'Stop syncing'));
      }
    }
    return h('div', { class: 'card' }, h('h2', {}, 'Your data'),
      h('p', { class: 'muted small', style: { marginTop: 0 } }, `Everything is stored as JSON on your device, nothing is sent anywhere. ${GT.store.sessions().length} sessions · ${GT.store.labels().length} labels · ${(bytes / 1024).toFixed(1)} KB.`),
      h('div', { class: 'setting' }, h('div', { class: 'txt' }, h('div', { class: 'name' }, 'Browser storage'), h('div', { class: 'desc' }, 'Always on. Stored in this browser’s local storage.')),
        h('div', { class: 'status ' + (GT.store.storageOk() ? 'ok' : 'bad') }, GT.store.storageOk() ? 'Working' : 'Unavailable')),
      h('div', { class: 'setting', style: { display: 'block' } }, h('div', { class: 'name', style: { marginBottom: '6px' } }, 'File on your computer'), fileStatusLine(), btns),
      h('div', { class: 'setting', style: { display: 'block' } }, h('div', { class: 'name' }, 'Backup'),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', onclick: () => GT.download(`goodtime-${GT.dayKey(Date.now())}.json`, GT.store.toJSON()) }, 'Export JSON'),
          h('button', { class: 'btn', onclick: async () => {
            const picked = await GT.pickTextFile();
            if (!picked) return;
            try { await importFrom(GT.store.parseImport(picked.text), picked.name); } catch (e) { GT.toast(e.message, 4000); }
          } }, 'Import JSON…'))),
      h('div', { class: 'setting', style: { display: 'block' } }, h('div', { class: 'name' }, 'Danger zone'),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', onclick: async () => {
            if (await GT.confirm('Reset settings?', 'Durations, sounds and appearance go back to defaults. Your sessions and labels are kept.', 'Reset', false)) {
              const fresh = GT.store.normalize({}).settings;
              Object.keys(fresh).forEach((k) => { cfg()[k] = fresh[k]; });
              GT.timer.refreshPlanned(); GT.applyTheme(); GT.store.save(); GT.toast('Settings reset');
            }
          } }, 'Reset settings'),
          h('button', { class: 'btn danger', onclick: async () => {
            if (await GT.confirm('Delete all data?', 'This removes every session, label and setting from this browser (and from the linked file, if any). Export a backup first if you might need it.', 'Delete everything', true)) {
              GT.store.reset(); GT.applyTheme(); GT.toast('All data deleted');
            }
          } }, 'Delete all data…'))));
  }

  GT.renderSettings = function () {
    const root = GT.$('#view-settings');
    if (root.hidden) return;
    const keepScroll = window.scrollY;
    GT.clear(root);
    const c = cfg();
    root.append(h('div', { class: 'view-head' }, h('h1', {}, 'Settings')));

    root.append(h('div', { class: 'card' }, h('h2', {}, 'Timer'),
      number('Focus length', null, 'workMin', 1, 600, 1, 'min'),
      number('Break length', null, 'shortMin', 1, 240, 1, 'min'),
      number('Long break length', null, 'longMin', 1, 240, 1, 'min'),
      number('Sessions before long break', null, 'sessionsBeforeLong', 1, 12, 1),
      toggle('Flow mode', 'Count up instead of down. Finish when you are done; your break is proportional to your focus time.', 'countUp'),
      c.countUp ? number('Flow break ratio', `Break = focus time ÷ ${c.flowRatio}`, 'flowRatio', 1, 20, 1) : null,
      toggle('Auto-start breaks', 'Begin the break as soon as a focus session ends.', 'autoStartBreak'),
      toggle('Auto-start focus', 'Begin the next focus session as soon as a break ends.', 'autoStartWork'),
      toggle('Keep screen awake', 'While the timer is running (where the browser supports it).', 'keepAwake'),
      number('Discard stopped sessions shorter than', 'Sessions you stop early are saved only if they reach this length.', 'minSaveSec', 0, 3600, 5, 'sec')));

    const soundRow = h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
      h('select', { 'aria-label': 'Sound', style: { width: '120px' }, onchange: (e) => { set('soundKind', e.target.value); GT.playSound(); } },
        [['bell', 'Bell'], ['chime', 'Chime'], ['beep', 'Beep'], ['digital', 'Digital']].map(([v, l]) => h('option', { value: v, selected: c.soundKind === v }, l))),
      h('button', { class: 'btn sm', onclick: () => GT.playSound() }, 'Test'));
    root.append(h('div', { class: 'card' }, h('h2', {}, 'Alerts'),
      toggle('Sound alert', 'Play a tone when a phase ends.', 'sound'),
      row('Sound type', null, soundRow),
      row('Volume', null, h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: c.volume, 'aria-label': 'Volume', onchange: (e) => { set('volume', Number(e.target.value)); GT.playSound(); } })),
      toggle('Notifications', GT.notificationsSupported() ? 'Show a system notification when a phase ends.' : 'Not supported in this browser.', 'notify', async (on) => {
        if (!on) return true;
        const r = await GT.requestNotifications();
        if (r !== 'granted') { GT.toast(r === 'denied' ? 'Notifications are blocked in your browser settings' : 'Notifications are not available'); return false; }
        return true;
      }),
      toggle('Vibration', 'On devices that support it.', 'vibrate')));

    root.append(h('div', { class: 'card' }, h('h2', {}, 'Goals & calendar'),
      number('Daily goal', 'Shown on the timer and in stats. Set 0 to hide it.', 'dailyGoalMin', 0, 1440, 5, 'min'),
      select('Week starts on', null, 'weekStart', [[1, 'Monday'], [0, 'Sunday']], Number),
      select('Time format', null, 'hour12', [['false', '24-hour'], ['true', '12-hour']], (v) => v === 'true')));

    root.append(h('div', { class: 'card' }, h('h2', {}, 'Appearance'),
      select('Theme', null, 'theme', [['system', 'Match system'], ['light', 'Light'], ['dark', 'Dark']]),
      colorRow('Accent colour', 'accent'),
      colorRow('Break colour', 'breakColor')));

    root.append(dataCard());

    root.append(h('div', { class: 'card' }, h('h2', {}, 'Keyboard shortcuts'),
      h('div', { class: 'small muted', style: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px' } },
        [['Space', 'Start / pause'], ['S', 'Stop'], ['N', 'Finish / next phase'], ['+  /  −', 'Add / remove a minute'], ['F', 'Fullscreen focus view'], ['1 – 5', 'Switch between screens']].flatMap(([k, d]) => [h('kbd', { style: { fontFamily: 'inherit', fontWeight: 600, color: 'var(--text)' } }, k), d])),
      h('p', { class: 'muted small', style: { margin: '14px 0 0' } }, 'Goodtime Web is an independent web take on the Goodtime Productivity app. It runs entirely in your browser.')));

    window.scrollTo(0, keepScroll);
  };

  GT.on('external-change', () => GT.renderSettings && GT.renderSettings());
  GT.on('file-status', () => GT.renderSettings && GT.renderSettings());
  GT.on('storage-error', () => GT.toast('Browser storage is full or blocked. Export your data!', 5000));
})();
