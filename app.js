/* Ultrasonic Reach Meter - MIT (c) 2026 ipusiron */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const messages = window.UltrasonicReachMessages;
  const prefix = 'ultrasonic-reach-meter.';
  function stored(key) { try { return localStorage.getItem(prefix + key); } catch (_) { return null; } }
  function save(key, value) { try { localStorage.setItem(prefix + key, value); } catch (_) { /* Optional preference. */ } }
  let language = stored('lang') || (navigator.language.startsWith('ja') ? 'ja' : 'en');
  if (!messages[language]) language = 'ja';
  let theme = stored('theme') === 'light' ? 'light' : 'dark';
  function render() {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll('[data-i18n]').forEach(element => {
      element.textContent = messages[language][element.dataset.i18n];
    });
    document.querySelectorAll('[data-label]').forEach(element => {
      element.setAttribute('aria-label', messages[language][element.dataset.label]);
    });
  }
  $('theme-toggle').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; save('theme', theme); render(); });
  $('lang-toggle').addEventListener('click', () => { language = language === 'ja' ? 'en' : 'ja'; save('lang', language); render(); });
  $('help-toggle').addEventListener('click', () => $('help-dialog').showModal());
  $('help-close').addEventListener('click', () => $('help-dialog').close());
  $('gain').addEventListener('input', () => { $('gain-value').textContent = `${$('gain').value}dBFS`; });
  $('help-dialog').addEventListener('close', () => $('help-toggle').focus());
  render();
}());
