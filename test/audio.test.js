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
