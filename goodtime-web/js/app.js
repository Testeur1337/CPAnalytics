/* Bootstrap: navigation, keyboard shortcuts, startup. */
(function () {
  'use strict';
  const GT = window.GT;
  const { $, $$ } = GT;

  const VIEWS = ['timer', 'stats', 'history', 'labels', 'settings'];
  const RENDER = { stats: 'renderStats', history: 'renderHistory', labels: 'renderLabels', settings: 'renderSettings', timer: 'renderTimerView' };
  let current = 'timer';

  GT.showView = function (name, fromHash) {
    if (!VIEWS.includes(name)) name = 'timer';
    current = name;
    VIEWS.forEach((v) => { $('#view-' + v).hidden = v !== name; });
    $$('.nav-btn').forEach((b) => { if (b.dataset.view === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (GT[RENDER[name]]) GT[RENDER[name]]();
    if (!fromHash && location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
    window.scrollTo(0, 0);
  };

  function typing(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e) || GT.isDialogOpen()) return;
    const onTimer = current === 'timer';
    switch (e.key) {
      case ' ': case 'Spacebar':
        // A focused control button handles its own Space; the sidebar buttons should not swallow it.
        if (!onTimer || e.target.closest('#main button')) return;
        e.preventDefault(); GT.timer.toggle(); break;
      case 's': case 'S': if (onTimer) GT.timer.stop(); break;
      case 'n': case 'N': if (onTimer) GT.timer.skip(); break;
      case '+': case '=': if (onTimer) GT.timer.addTime(GT.MIN); break;
      case '-': case '_': if (onTimer) GT.timer.addTime(-GT.MIN); break;
      case 'f': case 'F': if (onTimer) GT.toggleFullscreen(); break;
      case 'Escape': if (document.body.classList.contains('fs')) GT.toggleFullscreen(); break;
      default:
        if (/^[1-5]$/.test(e.key)) GT.showView(VIEWS[Number(e.key) - 1]);
    }
  });

  function init() {
    GT.hydrateIcons(document);
    GT.applyTheme();
    GT.timer.refreshPlanned();
    GT.initTimerView();
    $$('.nav-btn').forEach((b) => b.addEventListener('click', () => GT.showView(b.dataset.view)));
    window.addEventListener('hashchange', () => GT.showView(location.hash.slice(1), true));
    GT.showView(location.hash.slice(1) || 'timer', true);
    GT.on('change', GT.applyTheme);
    GT.on('external-change', () => { GT.applyTheme(); GT.timer.tick(); });
    GT.timer.tick();
    GT.file.init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
