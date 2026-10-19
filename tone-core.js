/* Ultrasonic Reach Meter - MIT (c) 2026 ipusiron */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UltrasonicReachCore = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FFT_SIZE = 8192;
  const FRAME_COUNT = 8;
  const DEFAULT_DB = -30;
  const MAX_DB = -12;
  const DEVICE_FREQUENCIES = Object.freeze([
    1000, 14000, 15000, 16000, 17000, 18000, 18500,
    19000, 19500, 20000, 20500, 21000, 21500
  ]);
  const HEARING_FREQUENCIES = Object.freeze([
    8000, 10000, 12000, 13000, 14000, 15000, 16000, 17000,
    17500, 18000, 18500, 19000, 19500, 20000, 20500, 21000, 21500
  ]);

  function validRate(rate) {
    if (!Number.isFinite(rate) || rate <= 0) throw new RangeError('Invalid sample rate');
    return rate;
  }

  function upperFrequency(rate) {
    return Math.min(21500, Math.floor(0.45 * validRate(rate) / 500) * 500);
  }

  function isReference(frequency, rate) {
    return frequency > 0.417 * validRate(rate);
  }

  function ladder(rate, hearing) {
    const frequencies = hearing ? HEARING_FREQUENCIES : DEVICE_FREQUENCIES;
    return frequencies.filter(frequency => frequency <= upperFrequency(rate));
  }

  function gain(db) {
    if (!Number.isFinite(db)) throw new RangeError('Invalid level');
    return 10 ** (Math.max(-60, Math.min(MAX_DB, db)) / 20);
  }

  function toneSamples(frequency, rate, amplitude) {
    validRate(rate);
    if (!Number.isInteger(frequency) || frequency <= 0 || frequency > upperFrequency(rate)) {
      throw new RangeError('Frequency outside the supported band');
    }
    if (!Number.isInteger(rate) || !Number.isFinite(amplitude) || amplitude < 0 || amplitude > gain(MAX_DB)) {
      throw new RangeError('Invalid amplitude or sample rate');
    }
    return Float32Array.from({ length: rate }, (_, index) => amplitude * Math.sin(2 * Math.PI * frequency * index / rate));
  }

  function rampPoints(start, duration, amplitude) {
    if (duration < 0.04 || amplitude < 0 || amplitude > gain(MAX_DB)) throw new RangeError('Invalid envelope');
    return [[start, 0], [start + 0.02, amplitude], [start + duration - 0.02, amplitude], [start + duration, 0]];
  }

  function frameInterval(rate) {
    return Math.max(0.171, Math.ceil(FFT_SIZE / validRate(rate) * 1000) / 1000);
  }

  function timing(rate, outputLatency) {
    const interval = frameInterval(rate);
    const latency = Number.isFinite(outputLatency) ? Math.max(0, outputLatency) : 0;
    const settle = latency + 0.15;
    const window = FRAME_COUNT * interval;
    // Two separate quiet/tone pairs; the final FFT window finishes before release.
    const burst = settle + window + 0.02;
    const trial = window + burst + 0.02;
    return { interval, window, settle, burst, trial, total: 2 * trial * ladder(rate).length };
  }

  function frequencyBin(frequency, rate, size = FFT_SIZE) {
    return Math.round(frequency * size / validRate(rate));
  }

  function bandPower(spectrum, frequency, rate) {
    const center = frequencyBin(frequency, rate);
    let maximum = 0;
    for (let bin = Math.max(0, center - 2); bin <= Math.min(spectrum.length - 1, center + 2); bin++) {
      const db = spectrum[bin];
      if (Number.isFinite(db)) maximum = Math.max(maximum, 10 ** (db / 10));
    }
    return maximum;
  }

  function meanPower(values) {
    if (values.length !== FRAME_COUNT) throw new RangeError('Eight frames are required');
    if (values.some(value => !Number.isFinite(value) || value < 0)) throw new RangeError('Invalid power');
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function deltaDb(signal, background) {
    if (signal === 0 && background === 0) return 0;
    return 10 * Math.log10(Math.max(signal, 1e-24) / Math.max(background, 1e-24));
  }

  function classify(deltas, eligible = true) {
    if (!eligible) return 'unavailable';
    if (!deltas.length) return 'unmeasured';
    if (deltas.length >= 2 && deltas.slice(-2).every(value => value >= 10)) return 'reached';
    return Math.max(...deltas) >= 4 ? 'weak' : 'absent';
  }

  function receive(powers, times, eligible = true) {
    if (!eligible) return { status: 'unavailable', delta: null, background: null };
    if (powers.length < FRAME_COUNT) return { status: 'unmeasured', delta: null, background: null };
    if (powers.length !== times.length || powers.some(value => !Number.isFinite(value) || value < 0)) {
      throw new RangeError('Invalid receiver frames');
    }
    if (times.some((value, index) => !Number.isFinite(value) || (index > 0 && value <= times[index - 1]))) {
      throw new RangeError('Receiver times must increase');
    }
    const sorted = [...powers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const background = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    let maximum = -Infinity;
    let firstHigh = null;
    let repeated = false;
    for (let end = FRAME_COUNT - 1; end < powers.length; end++) {
      const signal = meanPower(powers.slice(end - FRAME_COUNT + 1, end + 1));
      const delta = deltaDb(signal, background);
      maximum = Math.max(maximum, delta);
      if (delta >= 10) {
        if (firstHigh === null) firstHigh = times[end];
        if (times[end] - firstHigh >= 0.5) repeated = true;
      }
    }
    return { status: repeated ? 'reached' : maximum >= 4 ? 'weak' : 'absent', delta: maximum, background };
  }

  function processing(settings = {}) {
    const values = {};
    for (const key of ['echoCancellation', 'noiseSuppression', 'autoGainControl']) {
      values[key] = settings[key] === true ? 'on' : settings[key] === false ? 'off' : 'unreported';
    }
    return { values, warn: values.echoCancellation === 'on' || values.noiseSuppression === 'on' };
  }

  function hearingStart(rate) {
    const frequencies = ladder(rate, true);
    return { frequencies, index: 0, answers: [], misses: 0, highest: null, candidate: null,
      phase: frequencies.length ? 'asking' : 'done', reference: false, replayUsed: false };
  }

  function hearingAnswer(state, heard) {
    if (state.phase === 'done') return state;
    if (typeof heard !== 'boolean') throw new TypeError('Boolean answer required');
    if (state.phase === 'confirm') {
      return { ...state, phase: 'done', confirmed: heard, highest: heard ? state.highest : null,
        reference: state.reference || !heard };
    }
    const frequency = state.frequencies[state.index];
    const answers = [...state.answers, { frequency, heard }];
    const highest = heard ? frequency : state.highest;
    const misses = heard ? 0 : state.misses + 1;
    const finished = misses >= 2 || state.index + 1 >= state.frequencies.length;
    return { ...state, answers, highest, candidate: highest, misses, index: state.index + 1,
      phase: finished ? highest === null ? 'done' : 'confirm' : 'asking', replayUsed: false };
  }

  function hearingReplay(state) {
    if (state.replayUsed || state.phase === 'done') return null;
    return { ...state, replayUsed: true };
  }

  function hearingVolumeChanged(state) {
    return { ...state, reference: true };
  }

  function interpretation(deviceStatus, heard, role, reference) {
    if (reference) return 'reference';
    if (role === 'receive' || role === 'send') return 'separateDevice';
    if (deviceStatus === 'reached' && heard === false) return 'beyondHearing';
    if (deviceStatus === 'reached' && heard === true) return 'bothConfirmed';
    return 'deviceUnknown';
  }

  return Object.freeze({ FFT_SIZE, FRAME_COUNT, DEFAULT_DB, MAX_DB, DEVICE_FREQUENCIES, HEARING_FREQUENCIES,
    upperFrequency, isReference, ladder, gain, toneSamples, rampPoints, frameInterval, timing,
    frequencyBin, bandPower, meanPower, deltaDb, classify, receive, processing,
    hearingStart, hearingAnswer, hearingReplay, hearingVolumeChanged, interpretation });
}));
