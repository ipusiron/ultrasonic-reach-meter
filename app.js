/* Ultrasonic Reach Meter - MIT (c) 2026 ipusiron */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const core = window.UltrasonicReachCore;
  const audio = window.UltrasonicReachAudio.create();
  const messages = window.UltrasonicReachMessages;
  const prefix = 'ultrasonic-reach-meter.';
  function stored(key) { try { return localStorage.getItem(prefix + key); } catch (_) { return null; } }
  function save(key, value) { try { localStorage.setItem(prefix + key, value); } catch (_) { /* Optional preference. */ } }
  let language = stored('lang') || (navigator.language.startsWith('ja') ? 'ja' : 'en');
  if (!messages[language]) language = 'ja';
  let theme = stored('theme') === 'light' ? 'light' : 'dark';
  let busy = false;
  let role = 'both';
  let measuredRole = 'both';
  let environment = null;
  let rows = [];
  let hearing = null;
  let measuredGain = null;
  let hearingGain = null;
  let changedLevel = false;
  let current = null;
  let statusKey = 'idle';
  let errorKey = '';
  let operation = 0;
  let decision = null;
  const t = key => messages[language][key] || key;
  const hz = frequency => `${(frequency / 1000).toLocaleString(language, { maximumFractionDigits: 1 })}kHz`;
  const level = () => Number($('gain').value);
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };

  function controls() {
    $('measure').disabled = busy || !audio.available(role !== 'send');
    $('stop').disabled = !busy;
    document.querySelectorAll('input[name="role"]').forEach(input => { input.disabled = busy; });
    // Hearing interaction is enabled in the next layer of this page.
  }

  function renderEnvironment() {
    if (!environment) return;
    $('env-sampleRate').textContent = `${environment.sampleRate}Hz`;
    $('env-upper').textContent = hz(environment.upper);
    for (const [key, value] of Object.entries(environment.processing.values)) $('env-' + key).textContent = t(value);
    $('env-session').textContent = environment.session === 'unreported' ? t('unreported') : environment.session;
    $('processing-note').textContent = environment.processing.warn ? t('processingWarning') : '';
    const seconds = role === 'receive' ? 60 : environment.timing.total / (role === 'send' ? 2 : 1);
    $('duration').textContent = `${t('duration')}：${Math.ceil(seconds)}${t('seconds')}`;
  }

  function renderBars() {
    $('reach-bars').replaceChildren();
    for (const row of rows) {
      const box = element('div', undefined, 'reach-row');
      box.dataset.frequency = row.frequency;
      box.dataset.status = row.status;
      if (row.delta !== null) box.dataset.delta = row.delta;
      const label = element('div', undefined, 'reach-label');
      label.append(element('span', hz(row.frequency) + (row.reference ? ` · ${t('reference')}` : '')));
      const key = row.status === 'unavailable' && measuredRole === 'receive' ? 'receiveUnavailable' : row.status;
      label.append(element('span', t(key), 'status-' + row.status));
      box.append(label);
      if (row.delta !== null && row.delta !== undefined) {
        const meter = element('progress');
        meter.max = 60;
        meter.value = Math.max(0, Math.min(60, row.delta));
        meter.setAttribute('aria-label', `${hz(row.frequency)} ${t('difference')}`);
        box.append(meter, element('span', `${t('difference')} ${row.delta >= 0 ? '+' : ''}${row.delta.toFixed(1)}dB`));
      }
      $('reach-bars').append(box);
    }
  }

  function renderResults() {
    const answers = hearing ? hearing.answers : [];
    const frequencies = [...new Set([...rows.map(row => row.frequency), ...answers.map(answer => answer.frequency)])].sort((a, b) => a - b);
    $('results-table').hidden = !frequencies.length;
    $('device-column').textContent = t(measuredRole === 'receive' ? 'receiveColumn' : 'deviceColumn');
    $('results-body').replaceChildren();
    for (const frequency of frequencies) {
      const row = rows.find(item => item.frequency === frequency);
      const answer = answers.find(item => item.frequency === frequency);
      const status = row ? row.status : 'unmeasured';
      const reference = changedLevel || Boolean(hearing && hearing.reference) ||
        (measuredGain !== null && hearingGain !== null && measuredGain !== hearingGain);
      const reading = answer ? core.interpretation(status, answer.heard, measuredRole, reference) : null;
      const tr = element('tr');
      tr.dataset.frequency = frequency;
      const deviceKey = status === 'unavailable' && measuredRole === 'receive' ? 'receiveUnavailable' : status;
      tr.append(element('th', hz(frequency)), element('td', t(deviceKey)),
        element('td', answer ? t(answer.heard ? 'heard' : 'notHeard') : t('unmeasured')),
        element('td', reading ? t(reading === 'reference' ? 'comparisonReference' : reading) : '—'));
      $('results-body').append(tr);
    }
    $('result-summary').textContent = frequencies.length ? (changedLevel ? t('changedLevel') : t(statusKey)) : t('empty');
  }

  function render() {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
    document.body.dataset.busy = busy ? 'true' : 'false';
    document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
    document.querySelectorAll('[data-label]').forEach(node => { node.setAttribute('aria-label', t(node.dataset.label)); });
    $('gain-value').textContent = `${level()}dBFS`;
    $('status').textContent = t(statusKey);
    $('error').textContent = errorKey ? t(errorKey) : '';
    $('current-frequency').textContent = current ? hz(current) : '—';
    renderEnvironment();
    renderBars();
    renderResults();
    controls();
  }

  function stop() {
    operation++;
    busy = false;
    current = null;
    statusKey = 'stopped';
    if (decision) decision(false);
    audio.stop();
    render();
  }

  function confirmProcessing() {
    return new Promise(resolve => {
      decision = value => {
        decision = null;
        $('processing-dialog').close();
        resolve(value);
      };
      $('processing-dialog').showModal();
    });
  }

  async function measure() {
    const token = ++operation;
    busy = true;
    measuredRole = role;
    rows = [];
    measuredGain = level();
    changedLevel = false;
    statusKey = role === 'receive' ? 'listening' : 'selfCheck';
    errorKey = '';
    try {
      const opened = audio.open(role);
      render();
      environment = await opened;
      if (token !== operation) return;
      rows = core.DEVICE_FREQUENCIES.map(frequency => ({ frequency,
        status: frequency > environment.upper ? 'unavailable' : 'unmeasured', delta: null,
        reference: core.isReference(frequency, environment.sampleRate) }));
      render();
      if (environment.processing.warn && !(await confirmProcessing())) { stop(); return; }
      if (token !== operation) return;
      if (role === 'receive') {
        await audio.receive(updated => {
          for (const row of updated) rows[rows.findIndex(item => item.frequency === row.frequency)] = row;
          renderBars();
          renderResults();
        });
      } else {
        await audio.staircase(role, level, step => {
          if (step.phase === 'row') rows[rows.findIndex(row => row.frequency === step.row.frequency)] = step.row;
          else { current = step.frequency; statusKey = step.phase; }
          render();
        });
      }
      if (token === operation) statusKey = 'complete';
    } catch (error) {
      if (token === operation && error.message !== 'cancelled') {
        errorKey = messages[language][error.message] ? error.message : 'microphoneError';
        statusKey = 'stopped';
      }
    } finally {
      if (token === operation) {
        busy = false;
        current = null;
        audio.stop();
        render();
      }
    }
  }

  $('theme-toggle').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark'; save('theme', theme); render();
  });
  $('lang-toggle').addEventListener('click', () => {
    language = language === 'ja' ? 'en' : 'ja'; save('lang', language); render();
  });
  $('help-toggle').addEventListener('click', () => $('help-dialog').showModal());
  $('help-close').addEventListener('click', () => $('help-dialog').close());
  $('help-dialog').addEventListener('close', () => $('help-toggle').focus());
  $('processing-continue').addEventListener('click', () => { if (decision) decision(true); });
  $('processing-cancel').addEventListener('click', () => { if (decision) decision(false); });
  $('processing-dialog').addEventListener('cancel', event => {
    event.preventDefault();
    if (decision) decision(false);
  });
  $('measure').addEventListener('click', measure);
  $('stop').addEventListener('click', stop);
  document.querySelectorAll('input[name="role"]').forEach(input => input.addEventListener('change', () => {
    role = input.value;
    render();
  }));
  $('gain').addEventListener('input', () => {
    if (busy) changedLevel = true;
    render();
  });
  audio.onInterrupted(() => { if (busy) stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && busy) stop(); });
  window.addEventListener('pagehide', () => { stop(); void audio.close(); });
  if (!audio.available(false)) errorKey = 'notSupported';
  render();
}());
