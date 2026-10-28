/* Ultrasonic Reach Meter - MIT (c) 2026 ipusiron
 * Decides the theme before the first paint. index.html loads this file in <head> right after style.css, without defer.
 * The saved choice (ultrasonic-reach-meter.theme) of "light" opens the light theme; anything else, or no storage, opens
 * the dark (blueprint) theme. app.js reads data-theme back at start-up and saves the choice when the toggle is pressed. */
(function (global) {
  'use strict';
  let saved = null;
  try { saved = global.localStorage.getItem('ultrasonic-reach-meter.theme'); } catch (_) { /* Optional preference. */ }
  global.document.documentElement.dataset.theme = saved === 'light' ? 'light' : 'dark';
})(typeof window !== 'undefined' ? window : globalThis);
