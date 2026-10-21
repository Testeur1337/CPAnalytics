# Goodtime Web

A focus timer for the browser, inspired by the Goodtime Productivity Android app.
Plain HTML, CSS and JavaScript: no build step, no dependencies, no server, no database.

## Run it

Open `index.html` in a browser. That is all. (Or serve the folder with any static server,
e.g. `python3 -m http.server` and visit `http://localhost:8000`.)

## Features

- **Timer**: focus, break and long break, with a progress ring, pause/resume, +/- 1 minute,
  stop, and finish/skip. A session counter tracks how many focus sessions are left before a long break.
- **Flow mode**: count up instead of down; your break is proportional to how long you focused.
- **Labels**: tag sessions with coloured labels; archive or delete them.
- **History**: every session by day, filterable by label; add, edit (label, time, duration, note) and delete.
- **Stats**: today / week / month / all-time totals, streaks, stacked bar charts by week, month or year
  (with your daily goal line), time per label, time-of-day distribution, 6-month heatmap.
- **Goals**: a daily focus goal shown on the timer and in stats.
- **Alerts**: synthesized sounds (no audio files), system notifications, vibration, keep-screen-awake.
- **Accurate**: the timer is based on wall-clock time, so it stays correct in background tabs and survives
  a page reload; a session that finished while the page was closed is credited when you come back.
- **Themes**: system / light / dark and a custom accent colour. Responsive, works on phones.
- **Keyboard**: `Space` start/pause, `S` stop, `N` finish/next, `+` / `-` add/remove a minute,
  `F` fullscreen, `1`-`5` switch screens.

## Where your data lives

Everything is one JSON document:

```json
{ "app": "goodtime-web", "version": 1, "updatedAt": 0,
  "settings": {}, "labels": [], "sessions": [], "timer": {} }
```

1. **Browser storage** (always on): saved in `localStorage` on every change.
2. **A JSON file on your computer** (optional, Chrome / Edge / other Chromium browsers):
   Settings > Your data > *Save to a new file* or *Use an existing file*. The app then writes the file
   automatically after every change. The browser may ask you to re-allow access after a restart.
3. **Export / Import** (all browsers): download a backup, or load one back with *Merge* or *Replace*.

Nothing is ever sent over the network.

## Files

```
index.html          page shell
css/style.css       all styles (light/dark via CSS variables)
js/util.js          DOM helpers, time formatting, dialogs
js/store.js         data model, localStorage, JSON file sync
js/timer.js         timer engine
js/notify.js        sound, notifications, wake lock, theme
js/charts.js        stats aggregation + SVG charts
js/view-*.js        timer / stats / history / labels / settings screens
js/app.js           navigation, shortcuts, startup
```
