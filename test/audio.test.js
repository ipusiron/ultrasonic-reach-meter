'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../tone-core.js');
const audio = require('../audio-io.js');

function fixture(options = {}) {
  const state = { contexts: [], tracks: [], sources: [], constraints: [], gains: [], timers: new Map() };
  let timerId = 0;
  const track = { stop: () => { track.stopped = true; }, getSettings: () => options.settings || {},
    getCapabilities: () => ({}), addEventListener() {} };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  state.tracks.push(track);
  class Context {
    constructor(...args) {
      assert.deepEqual(args, []);
      this.sampleRate = options.rate || 48000;
      this.currentTime = 0;
      this.state = 'running';
      this.destination = {};
      state.contexts.push(this);
    }
    addEventListener() {}
    resume() { return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createBuffer(channels, length, rate) {
      assert.equal(channels, 1);
      assert.equal(length, rate);
      return { copyToChannel(data) { state.samples = data; } };
    }
    createBufferSource() {
      const node = { connect() {}, disconnect() { node.disconnected = true; },
        start(time) { node.started = time; }, stop(time) { node.stopped = time; }, addEventListener() {} };
      state.sources.push(node);
      return node;
    }
    createGain() {
      const events = [];
      const node = { connect() {}, disconnect() { node.disconnected = true; }, gain: {
        cancelScheduledValues: time => events.push(['cancel', time]),
        setValueAtTime: (value, time) => events.push(['set', value, time]),
        linearRampToValueAtTime: (value, time) => events.push(['ramp', value, time])
      }, events };
      state.gains.push(node);
      return node;
    }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createAnalyser() {
      state.analyser = { disconnect() {}, frequencyBinCount: 4096,
        getFloatFrequencyData(data) { data.fill(-70); } };
      return state.analyser;
    }
  }
  const host = { AudioContext: Context, navigator: { audioSession: {}, mediaDevices: {
    getUserMedia(constraints) { state.constraints.push(constraints); return options.pending || Promise.resolve(stream); }
  } }, performance: { now: () => 0 },
  setTimeout(fn) { const id = ++timerId; state.timers.set(id, fn); return id; },
  clearTimeout(id) { state.timers.delete(id); } };
  return { io: audio.create(host), host, state, stream, track };
}

test('No context or microphone is created before a user action', () => {
  const f = fixture();
  assert.equal(f.io.available(true), true);
  assert.equal(f.state.contexts.length, 0);
  assert.equal(f.state.constraints.length, 0);
  assert.equal(audio.create({}).available(false), false);
});

test('Microphone requests ideal processing flags; reports actual tri-state settings', async () => {
  const f = fixture({ settings: { echoCancellation: false, noiseSuppression: true } });
  const info = await f.io.open('both');
  assert.deepEqual(f.state.constraints[0], { audio: { echoCancellation: { ideal: false },
    noiseSuppression: { ideal: false }, autoGainControl: { ideal: false },
    voiceIsolation: { ideal: false }, channelCount: { ideal: 1 } }, video: false });
  assert.deepEqual(info.processing.values, { echoCancellation: 'off', noiseSuppression: 'on', autoGainControl: 'unreported' });
  assert.equal(info.processing.warn, true);
  assert.equal(f.host.navigator.audioSession.type, 'play-and-record');
  assert.equal(f.state.analyser.fftSize, 8192);
  assert.equal(f.state.analyser.smoothingTimeConstant, 0);
  f.io.stop();
  assert.equal(f.track.stopped, true);
});

for (const role of ['send', 'hearing']) test(`${role}: playback session without microphone`, async () => {
  const f = fixture();
  await f.io.open(role);
  assert.equal(f.host.navigator.audioSession.type, 'playback');
  assert.equal(f.state.constraints.length, 0);
  await f.io.close();
  assert.equal(f.state.contexts[0].state, 'closed');
});

test('Capped samples, 20ms envelope, scheduled end and immediate stop', async () => {
  const f = fixture();
  await f.io.open('send');
  f.io.emit(18000, 0, 1.5);
  assert.ok(Math.max(...f.state.samples) <= core.gain(-12) + 1e-8);
  assert.deepEqual(f.state.gains[0].events, [['cancel', 0], ['set', 0, 0],
    ['ramp', 1, 0.02], ['set', 1, 1.48], ['ramp', 0, 1.5]]);
  assert.equal(f.state.sources[0].loop, true);
  assert.equal(f.state.sources[0].stopped, 1.5);
  f.io.stop();
  assert.equal(f.state.sources[0].disconnected, true);
  assert.equal(f.state.gains[0].disconnected, true);
  assert.deepEqual(f.state.gains[0].events.at(-1), ['set', 0, 0]);
});

test('Never creates an output above the measured ceiling', async () => {
  const f = fixture({ rate: 44100 });
  const info = await f.io.open('send');
  assert.equal(info.upper, Math.min(21500, Math.floor(0.45 * 44100 / 500) * 500));
  assert.throws(() => f.io.emit(info.upper + 500, -30, 1.5), /notSupported/);
  assert.equal(f.state.sources.length, 0);
});

test('Stopping while microphone permission is pending closes the eventual track', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const f = fixture({ pending });
  const opening = f.io.open('receive');
  await Promise.resolve();
  f.io.stop();
  resolve(f.stream);
  await assert.rejects(opening, /cancelled/);
  assert.equal(f.track.stopped, true);
});

test('Stop cancels waits without allowing the next tone', async () => {
  const f = fixture();
  await f.io.open('send');
  const measure = f.io.staircase('send', () => -30, () => {});
  assert.equal(f.state.timers.size, 1);
  f.io.stop();
  await assert.rejects(measure, /cancelled/);
  assert.equal(f.state.timers.size, 0);
  assert.equal(f.state.sources.length, 0);
});

// Advancing audio clock and synthetic spectra; no physical microphone or output.
function clockFixture(options = {}) {
  const state = { time: 0, phase: 'quiet', trial: 1, reads: [], sources: [], handlers: new Map(), rows: [], notices: [] };
  const track = { muted: Boolean(options.muted), readyState: 'live', enabled: true,
    stop() { this.readyState = 'ended'; }, getSettings: () => ({}),
    addEventListener(name, handler) { state.handlers.set(name, handler); },
    removeEventListener(name) { state.handlers.delete(name); } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  class Context {
    constructor() { this.sampleRate = options.rate || 48000; this.outputLatency = 0; this.state = 'running'; this.destination = {}; }
    get currentTime() { return state.time; }
    addEventListener() {}
    async resume() {}
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createBuffer() { return { copyToChannel() {} }; }
    createBufferSource() {
      const node = { connect() {}, disconnect() {}, addEventListener() {},
        start(time) { this.startTime = time; },
        stop(time) { if (time !== undefined) this.endTime = time; else this.stopped = true; } };
      state.sources.push(node);
      return node;
    }
    createGain() {
      return { connect() {}, disconnect() {}, gain: {
        cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} } };
    }
    createAnalyser() {
      return { frequencyBinCount: 4096, disconnect() {}, getFloatFrequencyData(data) {
        state.reads.push({ time: state.time, phase: state.phase, trial: state.trial, source: state.sources.at(-1) });
        data.fill(-Infinity);
        const delta = (options.deltas || [12, 12])[state.trial - 1];
        // One target bin, with unrelated nearby bins silent.
        data[core.frequencyBin(1000, options.rate || 48000)] = state.phase === 'tone' ? -70 + delta : -70;
        if (options.readDelay && state.phase === 'tone') state.time += options.readDelay;
      } };
    }
  }
  const host = { AudioContext: Context, navigator: { mediaDevices: { async getUserMedia() { return stream; } } },
    performance: { now: () => state.time * 1000 },
    setTimeout(fn, ms) {
      return setImmediate(() => {
        if (!options.frozen) state.time += (ms + (state.phase === (options.latePhase || 'tone') ? options.late || 0 : 0)) / 1000;
        if (options.beforeTimer) options.beforeTimer({ state, track, io });
        fn();
      });
    }, clearTimeout: clearImmediate };
  const io = audio.create(host);
  io.onInterrupted(reason => state.notices.push(reason));
  function step(value) {
    if (value.phase === 'row') { state.rows.push(value.row); throw new Error('firstRowComplete'); }
    Object.assign(state, { phase: value.phase, trial: value.trial });
  }
  return { io, state, track, step };
}

for (const rate of [44100, 48000]) {
  for (const late of [0, 20, 80, 200]) {
    for (const latePhase of ['quiet', 'tone']) {
      test(`F1: valid independent windows at ${rate} Hz, ${late} ms delay during ${latePhase}`, async () => {
        const f = clockFixture({ rate, late, latePhase });
        const info = await f.io.open('both');
        await assert.rejects(f.io.staircase('both', () => -30, f.step),
          late <= 20 ? /firstRowComplete/ : /conditionsInsufficient/);
        assert.equal(f.state.rows.length, late <= 20 ? 1 : 0);
        if (f.state.rows.length) {
          assert.equal(f.state.rows[0].status, 'reached');
          assert.equal(f.state.reads.length, 32);
        }
        const tones = f.state.reads.filter(read => read.phase === 'tone');
        for (let i = 0; i < tones.length; i++) {
          const read = tones[i];
          assert.ok(read.time - 8192 / rate >= read.source.startTime + info.timing.settle - 1e-9);
          assert.ok(read.time <= read.source.endTime - 0.02 + 1e-9);
          if (i && tones[i - 1].trial === read.trial) {
            assert.ok(read.time - tones[i - 1].time >= 8192 / rate);
          }
        }
        for (const source of f.state.sources) {
          assert.ok(Math.abs(source.endTime - source.startTime - info.timing.burst) < 1e-9);
        }
        f.io.stop();
      });
    }
    test(`F1: stop during signal at ${rate} Hz with ${late} ms delay`, async () => {
      let stopped = false;
      const f = clockFixture({ rate, late, beforeTimer({ state, io }) {
        if (state.phase === 'tone' && !stopped) { stopped = true; io.stop(); }
      } });
      await f.io.open('both');
      await assert.rejects(f.io.staircase('both', () => -30, f.step), /cancelled/);
      assert.equal(f.state.rows.length, 0);
      assert.equal(f.state.sources.length, 1);
      assert.equal(f.state.sources[0].stopped, true);
    });
  }
}

test('F1: a frozen audio clock terminates without a tone or a classification', async () => {
  const f = clockFixture({ frozen: true });
  await f.io.open('both');
  await assert.rejects(f.io.staircase('both', () => -30, f.step), /conditionsInsufficient/);
  assert.equal(f.state.rows.length, 0);
  assert.equal(f.state.sources.length, 0);
  f.io.stop();
});

test('F1: a read crossing the stable end cannot produce a classification', async () => {
  const f = clockFixture({ readDelay: 0.5 });
  await f.io.open('both');
  await assert.rejects(f.io.staircase('both', () => -30, f.step), /conditionsInsufficient/);
  assert.equal(f.state.rows.length, 0);
  f.io.stop();
});

for (const role of ['both', 'receive']) test(`F2: initially muted ${role} input is interrupted`, async () => {
  const f = clockFixture({ muted: true });
  await assert.rejects(f.io.open(role), /inputInterrupted/);
  assert.equal(f.track.readyState, 'ended');
  assert.equal(f.state.reads.length, 0);
});

for (const phase of ['quiet', 'tone', 'receive']) {
  for (const event of ['mute', 'ended', 'mutedWithoutEvent']) {
    test(`F2: ${event} during ${phase} rejects input and never resumes automatically`, async () => {
      let interrupted = false;
      const f = clockFixture({ beforeTimer({ state, track }) {
        if (interrupted || state.phase !== phase || (phase === 'receive' && state.time < 30)) return;
        interrupted = true;
        if (event === 'ended') track.readyState = 'ended';
        else track.muted = true;
        if (event !== 'mutedWithoutEvent') state.handlers.get(event)();
      } });
      await f.io.open(phase === 'receive' ? 'receive' : 'both');
      f.state.phase = phase === 'receive' ? 'receive' : 'quiet';
      const running = phase === 'receive' ? f.io.receive(() => {}) : f.io.staircase('both', () => -30, f.step);
      await assert.rejects(running, /inputInterrupted/);
      const reads = f.state.reads.length;
      f.track.muted = false;
      assert.equal(f.state.handlers.has('unmute'), false);
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(f.state.reads.length, reads);
      assert.equal(f.state.rows.length, 0);
      f.io.stop();
      assert.equal(f.state.handlers.size, 0);
    });
  }
}

test('F1: receive rejects overdue frames at the 60 second deadline', async () => {
  const f = clockFixture({ late: 200, latePhase: 'receive' });
  await f.io.open('receive');
  f.state.phase = 'receive';
  await f.io.receive(() => {});
  assert.ok(f.state.reads.length >= 8);
  assert.ok(f.state.reads.every(read => read.time <= 60));
  for (let i = 1; i < f.state.reads.length; i++) {
    assert.ok(f.state.reads[i].time - f.state.reads[i - 1].time >= 8192 / 48000);
  }
  f.io.stop();
});

test('F3: audio info reports adopted latency and microphone settings independently of context rate', async () => {
  const f = fixture({ settings: { sampleRate: 44100, channelCount: 1 } });
  const device = await f.io.open('both');
  assert.equal(device.sampleRate, 48000);
  assert.equal(device.inputSampleRate, 44100);
  assert.equal(device.channelCount, 1);
  assert.equal(device.outputLatency, 0);
  const hearing = await f.io.open('hearing');
  assert.equal(hearing.channelCount, null);
  assert.equal(hearing.inputSampleRate, null);
  assert.equal(device.channelCount, 1);
  f.io.stop();
});
