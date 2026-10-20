'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../tone-core.js');
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance);

for (const rate of [44100, 48000, 96000, 22050, 16000]) {
  test(`B: ceiling, emission list and reference band at ${rate} Hz`, () => {
    const expected = Math.min(21500, Math.floor(0.45 * rate / 500) * 500);
    assert.equal(core.upperFrequency(rate), expected);
    for (const hearing of [false, true]) {
      const source = hearing ? core.HEARING_FREQUENCIES : core.DEVICE_FREQUENCIES;
      assert.deepEqual(core.ladder(rate, hearing), source.filter(frequency => frequency <= expected));
      for (const frequency of source) assert.equal(core.isReference(frequency, rate), frequency > 0.417 * rate);
    }
  });
}

for (const rate of [44100, 48000]) {
  for (const frequency of [1000, 14000, 19000]) {
    test(`A: one-second integer-period samples at ${rate}/${frequency}`, () => {
      const amplitude = 10 ** (-30 / 20);
      const samples = core.toneSamples(frequency, rate, amplitude);
      assert.ok(samples instanceof Float32Array);
      assert.equal(samples.length, rate);
      let squared = 0;
      for (let i = 0; i < samples.length; i++) {
        near(samples[i], amplitude * Math.sin(2 * Math.PI * frequency * i / rate));
        squared += samples[i] ** 2;
      }
      near(squared / rate, amplitude ** 2 / 2);
      near(samples[0], amplitude * Math.sin(2 * Math.PI * frequency));
      near(samples[rate - 1], -samples[1]);
    });
  }
}

test('A: capped amplitude and 20 ms linear attack/release endpoints', () => {
  assert.equal(core.gain(0), 10 ** (-12 / 20));
  assert.equal(core.gain(-30), 10 ** (-30 / 20));
  const start = 5;
  const duration = 1.5;
  const amplitude = core.gain(-30);
  assert.deepEqual(core.rampPoints(start, duration, amplitude),
    [[start, 0], [start + 0.02, amplitude], [start + duration - 0.02, amplitude], [start + duration, 0]]);
});

test('A: rejects unsupported frequencies and unsafe amplitudes', () => {
  for (const frequency of [-1, 0, 1.5, 22000, 30000]) {
    assert.throws(() => core.toneSamples(frequency, 48000, core.gain(-30)), RangeError);
  }
  assert.throws(() => core.toneSamples(1000, 48000, 1), RangeError);
  assert.throws(() => core.gain(NaN), RangeError);
});

for (const rate of [44100, 48000, 96000, 22050, 16000]) {
  test(`A: timing allows two independent trials at ${rate} Hz`, () => {
    const timing = core.timing(rate, 0.02);
    assert.ok(timing.interval >= core.FFT_SIZE / rate);
    assert.equal(timing.window, 8 * timing.interval);
    assert.ok(timing.burst >= timing.settle + timing.window);
    assert.equal(timing.total, 2 * timing.trial * core.ladder(rate).length);
  });
}

for (const rate of [44100, 48000]) {
  test(`D: frequency bins stay within half a bin at ${rate} Hz`, () => {
    for (const frequency of core.DEVICE_FREQUENCIES) {
      const bin = core.frequencyBin(frequency, rate);
      assert.ok(Math.abs(bin * rate / 8192 - frequency) <= rate / 8192 / 2);
    }
  });
}

for (const [db, expected] of [[0, 'absent'], [3, 'absent'], [6, 'weak'], [12, 'reached']]) {
  test(`C: synthesized spectrum gives ${expected} at +${db} dB`, () => {
    const rate = 48000;
    const frequency = 18000;
    const bin = core.frequencyBin(frequency, rate);
    const background = new Float32Array(4096).fill(-70);
    const signal = background.slice();
    signal[bin] = -70 + db;
    const noise = Array.from({ length: 8 }, () => core.bandPower(background, frequency, rate));
    const tone = Array.from({ length: 8 }, () => core.bandPower(signal, frequency, rate));
    const delta = core.deltaDb(core.meanPower(tone), core.meanPower(noise));
    near(delta, db);
    assert.equal(core.classify([delta, delta]), expected);
  });
}

test('C: both measurements must independently meet +10 dB', () => {
  assert.equal(core.classify([12]), 'weak');
  assert.equal(core.classify([12, 3]), 'weak');
  assert.equal(core.classify([3, 12, 12]), 'reached');
  assert.equal(core.classify([10, 10]), 'reached');
  assert.equal(core.classify([4, 4]), 'weak');
  assert.equal(core.classify([], false), 'unavailable');
  assert.equal(core.classify([]), 'unmeasured');
});

test('C: bin ±2 includes adjacent bins but excludes ±3; spectrum edges are clipped', () => {
  const spectrum = new Float32Array(4096).fill(-70);
  const frequency = 18000;
  const center = core.frequencyBin(frequency, 48000);
  spectrum[center + 3] = -10;
  near(core.bandPower(spectrum, frequency, 48000), 10 ** (-70 / 10));
  spectrum[center - 2] = -30;
  near(core.bandPower(spectrum, frequency, 48000), 10 ** (-30 / 10));
  spectrum[0] = -20;
  near(core.bandPower(spectrum, 0, 48000), 10 ** (-20 / 10));
  spectrum[4095] = -15;
  near(core.bandPower(spectrum, 24000, 48000), 10 ** (-15 / 10));
});

test('C: average linear powers, not decibels; silence is not a detection', () => {
  const values = Array.from({ length: 8 }, (_, index) => 10 ** ((-70 + index) / 10));
  assert.equal(core.meanPower(values), values.reduce((sum, value) => sum + value, 0) / 8);
  assert.throws(() => core.meanPower(values.slice(1)), RangeError);
  assert.equal(core.deltaDb(0, 0), 0);
});

test('E: actual true, false and unreported settings remain distinct', () => {
  for (const value of [true, false, undefined, null, 'false']) {
    const result = core.processing({ echoCancellation: value, noiseSuppression: value, autoGainControl: value });
    const expected = value === true ? 'on' : value === false ? 'off' : 'unreported';
    assert.deepEqual(Object.values(result.values), [expected, expected, expected]);
    assert.equal(result.warn, value === true);
  }
  assert.equal(core.processing({ autoGainControl: true }).warn, false);
  assert.equal(core.processing({ noiseSuppression: true }).warn, true);
  assert.deepEqual(core.processing({ echoCancellation: false }).values,
    { echoCancellation: 'off', noiseSuppression: 'unreported', autoGainControl: 'unreported' });
});

test('F: two misses end ascent and highest heard step must be confirmed', () => {
  let state = core.hearingStart(48000);
  state = core.hearingAnswer(state, true);
  state = core.hearingAnswer(state, false);
  state = core.hearingAnswer(state, false);
  assert.equal(state.phase, 'confirm');
  assert.equal(state.highest, core.HEARING_FREQUENCIES[0]);
  const confirmed = core.hearingAnswer(state, true);
  assert.equal(confirmed.phase, 'done');
  assert.equal(confirmed.confirmed, true);
  const rejected = core.hearingAnswer(state, false);
  assert.equal(rejected.highest, null);
  assert.equal(rejected.reference, true);
});

test('F: no heard step, top step, replay and level changes', () => {
  let state = core.hearingStart(48000);
  assert.equal(core.hearingReplay(core.hearingReplay(state)), null);
  assert.equal(core.hearingVolumeChanged(state).reference, true);
  assert.equal(state.reference, false);
  assert.equal(core.hearingAnswer(core.hearingAnswer(state, false), false).phase, 'done');
  for (const frequency of state.frequencies) {
    assert.equal(state.frequencies[state.index], frequency);
    state = core.hearingAnswer(state, true);
  }
  assert.equal(state.phase, 'confirm');
  assert.equal(state.highest, core.upperFrequency(48000));
  assert.equal(core.hearingStart(16000).phase, 'done');
});

test('F: interpretations distinguish device, hearing, role and changed conditions', () => {
  assert.equal(core.interpretation('reached', false, 'both', false), 'beyondHearing');
  assert.equal(core.interpretation('reached', true, 'both', false), 'bothConfirmed');
  assert.equal(core.interpretation('absent', false, 'both', false), 'deviceUnknown');
  assert.equal(core.interpretation('reached', false, 'receive', false), 'separateDevice');
  assert.equal(core.interpretation('reached', false, 'both', true), 'reference');
});

for (const fraction of [0.1, 0.2, 0.3]) {
  for (const [delta, expected] of [[3, 'absent'], [6, 'weak'], [12, 'reached']]) {
    test(`F2: one burst occupying ${fraction} of frames at +${delta} dB`, () => {
      const background = 10 ** (-70 / 10);
      const powers = Array.from({ length: 100 }, (_, index) =>
        index >= 20 && index < 20 + 100 * fraction ? background * 10 ** (delta / 10) : background);
      const result = core.receive(powers, powers.map((_, index) => index * 8192 / 48000));
      near(result.background, background);
      near(result.delta, delta);
      assert.equal(result.status, expected);
    });
  }
}

test('F2: threshold needs two evaluated times at least half a second apart', () => {
  const powers = Array(8).fill(1e-7).concat(Array(8).fill(1e-3), Array(24).fill(1e-7));
  assert.equal(core.receive(powers, powers.map((_, index) => index * 0.01)).status, 'weak');
  assert.equal(core.receive(powers, powers.map((_, index) => index * 0.171)).status, 'reached');
  assert.equal(core.receive(Array(40).fill(1e-7), Array.from({ length: 40 }, (_, i) => i * 0.171)).status, 'absent');
  assert.equal(core.receive([], [], false).status, 'unavailable');
  assert.equal(core.receive([], []).status, 'unmeasured');
});

test('F2: receiver rejects tiny relative peaks below its explicit power floor', () => {
  assert.equal(core.RECEIVE_POWER_FLOOR, 10 ** (-120 / 10));
  const powers = Array.from({ length: 100 }, (_, index) => index >= 20 && index < 40 ? 1e-16 : 1e-18);
  const result = core.receive(powers, powers.map((_, index) => index * 0.171));
  assert.equal(result.status, 'absent');
  assert.equal(result.delta, 0);
  assert.equal(result.background, 1e-18);
});

test('F2: receiver floor also limits sensitivity when background is very low', () => {
  for (const [aboveFloor, expected] of [[3, 'absent'], [6, 'weak'], [12, 'reached']]) {
    const floor = 10 ** (-120 / 10);
    const powers = Array.from({ length: 100 }, (_, index) =>
      index >= 20 && index < 40 ? floor * 10 ** (aboveFloor / 10) : floor / 100);
    const result = core.receive(powers, powers.map((_, index) => index * 0.171));
    near(result.delta, aboveFloor);
    assert.equal(result.status, expected);
  }
});

test('F2: receiver requires strictly more than ten decibels at its boundary', () => {
  for (const delta of [10 - 1e-6, 10, 10 + 1e-6]) {
    const powers = Array.from({ length: 100 }, (_, index) =>
      index >= 20 && index < 40 ? 10 ** (delta / 10) : 1);
    const result = core.receive(powers, powers.map((_, index) => index * .171));
    assert.equal(result.status, delta > 10 ? 'reached' : 'weak');
  }
});
