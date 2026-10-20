/* Ultrasonic Reach Meter - MIT (c) 2026 ipusiron */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tone-core.js'));
  else root.UltrasonicReachAudio = factory(root.UltrasonicReachCore);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';

  function create(host = globalThis) {
    let context = null;
    let stream = null;
    let input = null;
    let analyser = null;
    let source = null;
    let outputGain = null;
    let settings = {};
    let session = 'unreported';
    let generation = 0;
    let stateHandler = null;
    let inputTrack = null;
    let trackHandler = null;
    const pending = new Set();
    const nav = host.navigator || {};

    function available(microphone) {
      return Boolean((host.AudioContext || host.webkitAudioContext) &&
        (!microphone || (nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === 'function')));
    }

    function stopTone() {
      if (source) {
        const active = source;
        source = null;
        try { active.stop(); } catch (_) { /* Already ended. */ }
        active.disconnect();
      }
      if (outputGain) {
        const param = outputGain.gain;
        param.cancelScheduledValues(context.currentTime);
        param.setValueAtTime(0, context.currentTime);
        outputGain.disconnect();
        outputGain = null;
      }
    }

    function stop(reason = 'cancelled') {
      generation++;
      for (const cancel of [...pending]) cancel(reason);
      pending.clear();
      stopTone();
      if (inputTrack && typeof inputTrack.removeEventListener === 'function') {
        inputTrack.removeEventListener('mute', trackHandler);
        inputTrack.removeEventListener('ended', trackHandler);
      }
      inputTrack = trackHandler = null;
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (input) input.disconnect();
      if (analyser) analyser.disconnect();
      stream = input = analyser = null;
    }

    async function close() {
      stop();
      const previous = context;
      context = null;
      if (previous && previous.state !== 'closed') {
        try { await previous.close(); } catch (_) { /* Page may already be leaving. */ }
      }
    }

    function wait(seconds, token = generation) {
      return new Promise((resolve, reject) => {
        if (token !== generation) { reject(new Error('cancelled')); return; }
        const cancel = (reason = 'cancelled') => {
          host.clearTimeout(timer);
          pending.delete(cancel);
          reject(new Error(reason));
        };
        const timer = host.setTimeout(() => {
          pending.delete(cancel);
          if (token !== generation) reject(new Error('cancelled'));
          else resolve();
        }, seconds * 1000);
        pending.add(cancel);
      });
    }

    function checkInput() {
      if (inputTrack && (inputTrack.muted || inputTrack.readyState === 'ended' || inputTrack.enabled === false)) {
        throw new Error('inputInterrupted');
      }
    }

    async function until(time, token) {
      for (let attempt = 0; context && context.currentTime < time - 1e-9; attempt++) {
        if (token !== generation) throw new Error('cancelled');
        checkInput();
        if (attempt >= 10 || context.state !== 'running') throw new Error('conditionsInsufficient');
        await wait(Math.max(0.001, time - context.currentTime), token);
      }
      if (token !== generation || !context) throw new Error('cancelled');
      checkInput();
    }

    async function open(role) {
      stop();
      const token = generation;
      const microphone = role === 'both' || role === 'receive';
      if (!available(microphone)) throw new Error('notSupported');
      // Called synchronously from the user gesture, with no sampleRate override.
      if (!context || context.state === 'closed') {
        const Audio = host.AudioContext || host.webkitAudioContext;
        context = new Audio();
        context.addEventListener('statechange', () => {
          if (context && context.state !== 'running' && stateHandler) stateHandler();
        });
      }
      session = 'unreported';
      if (nav.audioSession) {
        try {
          nav.audioSession.type = microphone ? 'play-and-record' : 'playback';
          session = nav.audioSession.type;
        } catch (_) { session = 'unreported'; }
      }
      await context.resume();
      if (token !== generation) throw new Error('cancelled');
      settings = {};
      if (microphone) {
        const wanted = { echoCancellation: false, noiseSuppression: false,
          autoGainControl: false, voiceIsolation: false, channelCount: 1 };
        const supported = typeof nav.mediaDevices.getSupportedConstraints === 'function'
          ? nav.mediaDevices.getSupportedConstraints() : null;
        const audio = {};
        for (const [key, value] of Object.entries(wanted)) {
          if (!supported || supported[key]) audio[key] = { ideal: value };
        }
        let opened;
        try { opened = await nav.mediaDevices.getUserMedia({ audio, video: false }); }
        catch (_) { throw new Error('microphoneError'); }
        if (token !== generation) {
          opened.getTracks().forEach(track => track.stop());
          throw new Error('cancelled');
        }
        stream = opened;
        const track = stream.getAudioTracks()[0];
        if (!track) { stop(); throw new Error('microphoneError'); }
        if (typeof track.getSettings === 'function') settings = track.getSettings() || {};
        // Inspect capability availability without treating requested values as measured settings.
        if (typeof track.getCapabilities === 'function') {
          try { track.getCapabilities(); } catch (_) { /* Optional introspection. */ }
        }
        inputTrack = track;
        trackHandler = () => {
          if (token !== generation) return;
          stop('inputInterrupted');
          if (stateHandler) stateHandler('inputInterrupted');
        };
        track.addEventListener('ended', trackHandler);
        track.addEventListener('mute', trackHandler);
        try { checkInput(); } catch (error) { stop(); throw error; }
        try {
          input = context.createMediaStreamSource(stream);
          analyser = context.createAnalyser();
          analyser.fftSize = core.FFT_SIZE;
          analyser.smoothingTimeConstant = 0;
          input.connect(analyser);
        } catch (_) { stop(); throw new Error('microphoneError'); }
      }
      return info();
    }

    function info() {
      const rate = context ? context.sampleRate : null;
      return { sampleRate: rate, upper: rate ? core.upperFrequency(rate) : null,
        processing: core.processing(settings), session,
        outputLatency: context && Number.isFinite(context.outputLatency) ? Math.max(0, context.outputLatency) : 0,
        channelCount: Number.isFinite(settings.channelCount) ? settings.channelCount : null,
        inputSampleRate: Number.isFinite(settings.sampleRate) ? settings.sampleRate : null,
        timing: rate ? core.timing(rate, context.outputLatency) : null };
    }

    function emit(frequency, db, duration) {
      if (!context || frequency > core.upperFrequency(context.sampleRate)) throw new Error('notSupported');
      stopTone();
      const amplitude = core.gain(db);
      const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      // The buffer already carries its capped amplitude; the envelope never exceeds one.
      buffer.copyToChannel(core.toneSamples(frequency, context.sampleRate, amplitude), 0);
      const node = context.createBufferSource();
      const envelope = context.createGain();
      node.buffer = buffer;
      node.loop = true;
      node.connect(envelope);
      envelope.connect(context.destination);
      const start = context.currentTime;
      const parameter = envelope.gain;
      parameter.cancelScheduledValues(start);
      parameter.setValueAtTime(0, start);
      parameter.linearRampToValueAtTime(1, start + 0.02);
      parameter.setValueAtTime(1, start + duration - 0.02);
      parameter.linearRampToValueAtTime(0, start + duration);
      node.start(start);
      node.stop(start + duration);
      source = node;
      outputGain = envelope;
      node.addEventListener('ended', () => {
        node.disconnect();
        envelope.disconnect();
        if (source === node) { source = null; outputGain = null; }
      });
      return { start, end: start + duration, stableEnd: start + duration - 0.02 };
    }

    function readPowers(frequencies) {
      checkInput();
      if (!analyser || !context) throw new Error('cancelled');
      const spectrum = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(spectrum);
      return frequencies.map(frequency => core.bandPower(spectrum, frequency, context.sampleRate));
    }

    async function eight(frequency, token, start, end) {
      const powers = [];
      const interval = core.frameInterval(context.sampleRate);
      let previous = null;
      for (let i = 0; i < core.FRAME_COUNT; i++) {
        await until(previous === null ? start + interval : previous + interval, token);
        const before = context.currentTime;
        if (!core.validFrame(before, previous, start, end, context.sampleRate)) throw new Error('conditionsInsufficient');
        const power = readPowers([frequency])[0];
        const after = context.currentTime;
        if (after > end + 1e-9) throw new Error('conditionsInsufficient');
        powers.push(power);
        previous = after;
      }
      return core.meanPower(powers);
    }

    async function staircase(role, level, onStep) {
      const token = generation;
      const details = info();
      const schedule = details.timing;
      const rows = [];
      // Emit only retains one pass so a 60-second receiver can capture the full ladder.
      const repeats = role === 'both' ? 2 : 1;
      for (const frequency of core.ladder(details.sampleRate)) {
        const deltas = [];
        for (let trial = 0; trial < repeats; trial++) {
          onStep({ phase: 'quiet', frequency, trial: trial + 1, repeats });
          let background = null;
          if (role === 'both') {
            const quietStart = context.currentTime;
            background = await eight(frequency, token, quietStart, quietStart + schedule.window + schedule.allowance);
          }
          else await wait(schedule.window, token);
          onStep({ phase: 'tone', frequency, trial: trial + 1, repeats });
          const tone = emit(frequency, level(), schedule.burst);
          if (role === 'both') {
            const signal = await eight(frequency, token, tone.start + schedule.settle, tone.stableEnd);
            deltas.push(core.deltaDb(signal, background));
          }
          await until(tone.end, token);
          await wait(0.04, token);
          stopTone();
        }
        const status = role === 'both' ? core.classify(deltas) : 'emitted';
        const row = { frequency, status, delta: deltas.length ? Math.min(...deltas) : null, deltas,
          reference: core.isReference(frequency, details.sampleRate) };
        rows.push(row);
        onStep({ phase: 'row', row });
        if (role === 'both' && frequency === 1000 && status === 'absent') throw new Error('selfCheckFailed');
      }
      return rows;
    }

    async function receive(onUpdate) {
      const token = generation;
      const details = info();
      const frequencies = core.ladder(details.sampleRate);
      const values = frequencies.map(() => []);
      const times = [];
      const started = host.performance.now();
      const deadline = started + 60000;
      let previous = context.currentTime;
      while (host.performance.now() + details.timing.interval * 1000 <= deadline) {
        await until(previous + details.timing.interval, token);
        if (host.performance.now() > deadline) break;
        const powers = readPowers(frequencies);
        previous = context.currentTime;
        times.push(previous);
        powers.forEach((power, index) => values[index].push(power));
        const rows = frequencies.map((frequency, index) => ({ frequency,
          ...core.receive(values[index], times), reference: core.isReference(frequency, details.sampleRate) }));
        onUpdate(rows);
      }
    }

    async function burst(frequency, db) {
      const token = generation;
      emit(frequency, db, 1.5);
      await wait(1.52, token);
      stopTone();
    }

    return { available, open, info, emit, staircase, receive, burst, stop, close,
      onInterrupted: handler => { stateHandler = handler; } };
  }

  return Object.freeze({ create });
}));
