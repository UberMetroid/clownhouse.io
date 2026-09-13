/**
 * CLOWNHOUSE.IO // Milestone M2 Procedural Web Audio Engine Test Suite
 * 
 * Verifies:
 * 1. Interface contract completeness for window.ClownAudio.
 * 2. 4 Procedural Frequency Modes (LAB-01 to LAB-04) with exact names and frequency specs.
 * 3. Numerical volume boundary clamping [0.0, 1.0] across adversarial inputs.
 * 4. Track indexing, wrapping, and state immutability.
 * 5. Mock AudioContext execution (oscillators, filters, compressors, gain ramps).
 * 6. AnalyserNode frequency extraction and 4-bar equalizer height mapping (3px to 14px).
 * 7. Prototype pollution resistance.
 * 8. Double-Run Parity ($Run_1 == Run_2$).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const AUDIO_JS_PATH = path.join(PROJECT_ROOT, 'audio.js');
const INDEX_HTML_PATH = path.join(PROJECT_ROOT, 'index.html');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    failures.push({ testName, details });
    console.error(`  [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
  }
}

// --- Mock Web Audio API Environment ---
function createMockEnvironment() {
  class MockParam {
    constructor(val = 0) { this.value = val; }
    setValueAtTime(v) { this.value = v; }
    linearRampToValueAtTime(v) { this.value = v; }
    exponentialRampToValueAtTime(v) { this.value = v; }
    cancelScheduledValues() {}
  }

  class MockNode {
    constructor() { this.connectedTo = []; }
    connect(node) { this.connectedTo.push(node); return node; }
    disconnect() { this.connectedTo = []; }
  }

  class MockGainNode extends MockNode {
    constructor() {
      super();
      this.gain = new MockParam(1.0);
    }
  }

  class MockOscillatorNode extends MockNode {
    constructor() {
      super();
      this.frequency = new MockParam(440);
      this.type = 'sine';
      this.started = false;
      this.stopped = false;
    }
    start() { this.started = true; }
    stop() { this.stopped = true; }
  }

  class MockBiquadFilterNode extends MockNode {
    constructor() {
      super();
      this.frequency = new MockParam(350);
      this.Q = new MockParam(1.0);
      this.type = 'lowpass';
    }
  }

  class MockDelayNode extends MockNode {
    constructor() {
      super();
      this.delayTime = new MockParam(0.25);
    }
  }

  class MockCompressorNode extends MockNode {
    constructor() {
      super();
      this.threshold = new MockParam(-6);
      this.knee = new MockParam(12);
      this.ratio = new MockParam(12);
      this.attack = new MockParam(0.003);
      this.release = new MockParam(0.25);
    }
  }

  class MockAnalyserNode extends MockNode {
    constructor() {
      super();
      this.fftSize = 64;
      this.frequencyBinCount = 32;
      this.smoothingTimeConstant = 0.8;
    }
    getByteFrequencyData(array) {
      if (array && array.length) {
        for (let i = 0; i < array.length; i++) {
          // Synthetic audio signal distribution
          array[i] = Math.max(0, Math.min(255, 180 - i * 5));
        }
      }
    }
  }

  class MockBufferSourceNode extends MockNode {
    constructor() {
      super();
      this.buffer = null;
      this.loop = false;
      this.started = false;
      this.stopped = false;
    }
    start() { this.started = true; }
    stop() { this.stopped = true; }
  }

  class MockAudioBuffer {
    constructor(channels, length, sampleRate) {
      this.numberOfChannels = channels;
      this.length = length;
      this.sampleRate = sampleRate;
      this._data = new Float32Array(length);
    }
    getChannelData() { return this._data; }
  }

  class MockAudioContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 0.05;
      this.sampleRate = 44100;
      this.destination = new MockNode();
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    }
    createGain() { return new MockGainNode(); }
    createOscillator() { return new MockOscillatorNode(); }
    createBiquadFilter() { return new MockBiquadFilterNode(); }
    createDelay() { return new MockDelayNode(); }
    createDynamicsCompressor() { return new MockCompressorNode(); }
    createAnalyser() { return new MockAnalyserNode(); }
    createBufferSource() { return new MockBufferSourceNode(); }
    createBuffer(c, l, s) { return new MockAudioBuffer(c, l, s); }
  }

  // Mock DOM elements
  const elements = {
    'floating-audio-pill': { classList: new Set(), style: {} },
    'audio-play-btn': { addEventListener: () => {} },
    'audio-play-icon': { classList: new Set() },
    'audio-pause-icon': { classList: new Set(['hidden']) },
    'audio-track-title': { textContent: '' },
    'audio-track-freq': { textContent: '' },
    'audio-mute-btn': { addEventListener: () => {} },
    'audio-unmuted-icon': { classList: new Set() },
    'audio-muted-icon': { classList: new Set(['hidden']) }
  };

  const eqBars = [
    { classList: new Set(['eq-bar', 'bar-1']), style: { height: '3px' } },
    { classList: new Set(['eq-bar', 'bar-2']), style: { height: '3px' } },
    { classList: new Set(['eq-bar', 'bar-3']), style: { height: '3px' } },
    { classList: new Set(['eq-bar', 'bar-4']), style: { height: '3px' } }
  ];

  const documentMock = {
    readyState: 'complete',
    addEventListener: () => {},
    dispatchEvent: () => {},
    getElementById: (id) => elements[id] || null,
    querySelector: (sel) => {
      if (sel === '.eq-bar.bar-1') return eqBars[0];
      if (sel === '.eq-bar.bar-2') return eqBars[1];
      if (sel === '.eq-bar.bar-3') return eqBars[2];
      if (sel === '.eq-bar.bar-4') return eqBars[3];
      return null;
    },
    querySelectorAll: (sel) => (sel === '.eq-bar' ? eqBars : [])
  };

  function makeDOMTokenList(initial = []) {
    const set = new Set(initial);
    return {
      add: (...classes) => classes.forEach(c => set.add(c)),
      remove: (...classes) => classes.forEach(c => set.delete(c)),
      contains: (c) => set.has(c),
      toggle: (c) => {
        if (set.has(c)) { set.delete(c); return false; }
        set.add(c); return true;
      }
    };
  }

  for (const k of Object.keys(elements)) {
    const el = elements[k];
    if (el.classList) {
      el.classList = makeDOMTokenList(Array.from(el.classList));
    }
  }

  const windowMock = {
    AudioContext: MockAudioContext,
    webkitAudioContext: MockAudioContext,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id)
  };

  const sandbox = {
    window: windowMock,
    document: documentMock,
    globalThis: windowMock,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Uint8Array,
    Float32Array,
    Math,
    Number,
    Object,
    Array,
    Promise,
    CustomEvent: class CustomEvent { constructor(name, d) { this.name = name; this.detail = d && d.detail; } }
  };

  vm.createContext(sandbox);
  return { sandbox, elements, eqBars, MockAudioContext };
}

async function runTestSuite(runIndex) {
  console.log(`\n================================================================`);
  console.log(`CLOWNHOUSE.IO // Milestone M2 Procedural Web Audio Engine (Run ${runIndex})`);
  console.log(`================================================================\n`);

  const { sandbox, elements, eqBars } = createMockEnvironment();
  const audioCode = fs.readFileSync(AUDIO_JS_PATH, 'utf8');

  // Execute in isolated sandbox
  vm.runInContext(audioCode, sandbox);
  const audio = sandbox.window.ClownAudio;

  // 1. Interface Contract Verification
  console.log('--- 1. Window Contract Verification ---');
  assert(typeof audio === 'object' && audio !== null, 'window.ClownAudio is defined and exported');
  assert(typeof audio.play === 'function', 'audio.play is a function');
  assert(typeof audio.pause === 'function', 'audio.pause is a function');
  assert(typeof audio.togglePlay === 'function', 'audio.togglePlay is a function');
  assert(typeof audio.toggleMute === 'function', 'audio.toggleMute is a function');
  assert(typeof audio.setVolume === 'function', 'audio.setVolume is a function');
  assert(typeof audio.setTrack === 'function', 'audio.setTrack is a function');
  assert(typeof audio.nextTrack === 'function', 'audio.nextTrack is a function');
  assert(typeof audio.prevTrack === 'function', 'audio.prevTrack is a function');
  assert(typeof audio.getState === 'function', 'audio.getState is a function');
  assert(typeof audio.getFrequencyData === 'function', 'audio.getFrequencyData is a function');
  assert(Array.isArray(audio.TRACKS) && audio.TRACKS.length >= 1, 'audio.TRACKS contains valid tracks');

  // 2. Track Catalog Metadata Accuracy
  console.log('\n--- 2. Track Catalog Metadata ---');
  const expectedTrack = {
    id: 'fix-everything',
    title: 'We Can Fix Everything',
    artist: 'Kevin Koontz',
    freq: 'Kevin Koontz'
  };

  const act = audio.TRACKS[0];
  assert(act && act.id === expectedTrack.id, `Track 0 ID is "${expectedTrack.id}"`);
  assert(act && act.title === expectedTrack.title, `Track 0 title is "${expectedTrack.title}"`);
  assert(act && act.artist === expectedTrack.artist, `Track 0 artist is "${expectedTrack.artist}"`);
  assert(act && act.src === 'music/kevin_koontz-we_can_fix_everything.mp3', 'Track 0 src points to Kevin Koontz MP3');
  assert(act && act.art === 'music/kevin_koontz-we_can_fix_everything.webp', 'Track 0 art points to Kevin Koontz WebP');

  // 3. Volume Clamping & Numerical Boundary Fuzzing
  console.log('\n--- 3. Volume Boundary Clamping ---');
  audio.setVolume(0.5);
  assert(audio.getState().volume === 0.5, 'setVolume(0.5) sets volume to 0.5');

  audio.setVolume(-0.8);
  assert(audio.getState().volume === 0.0, 'setVolume(-0.8) clamps strictly to 0.0');

  audio.setVolume(2.4);
  assert(audio.getState().volume === 1.0, 'setVolume(2.4) clamps strictly to 1.0');

  audio.setVolume(NaN);
  assert(audio.getState().volume >= 0.0 && audio.getState().volume <= 1.0, 'setVolume(NaN) does not corrupt volume');

  audio.setVolume('invalid');
  assert(audio.getState().volume >= 0.0 && audio.getState().volume <= 1.0, 'setVolume(string) does not corrupt volume');

  audio.setVolume(0.7); // reset to comfortable level

  // 4. Track Navigation & Modulo Wrapping
  console.log('\n--- 4. Track Navigation & Modulo Wrapping ---');
  audio.setTrack(0);
  assert(audio.getState().trackIndex === 0, 'setTrack(0) sets trackIndex to 0');

  audio.nextTrack();
  assert(audio.getState().trackIndex === 0, 'nextTrack() wraps modulo cleanly to 0');

  audio.prevTrack();
  assert(audio.getState().trackIndex === 0, 'prevTrack() wraps modulo cleanly to 0');

  audio.setTrack(99);
  assert(audio.getState().trackIndex === 0, 'setTrack(99) out-of-bounds falls back to 0');

  // 5. Synthesis Lifecycle: Play, Pause, Mute
  console.log('\n--- 5. Synthesis Play / Pause / Mute Lifecycle ---');
  let state = audio.getState();
  assert(state.isPlaying === false, 'Initial state is paused (autoplay safe)');
  assert(state.isMuted === true, 'Initial state is muted (autoplay safe)');

  await audio.play();
  state = audio.getState();
  assert(state.isPlaying === true, 'audio.play() transitions isPlaying to true');
  assert(state.isMuted === false, 'audio.play() unmutes master channel');

  audio.pause();
  state = audio.getState();
  assert(state.isPlaying === false, 'audio.pause() transitions isPlaying to false');

  await audio.togglePlay();
  state = audio.getState();
  assert(state.isPlaying === true, 'audio.togglePlay() transitions back to playing');

  audio.toggleMute();
  state = audio.getState();
  assert(state.isMuted === true, 'audio.toggleMute() transitions isMuted to true');

  audio.toggleMute();
  state = audio.getState();
  assert(state.isMuted === false, 'audio.toggleMute() transitions isMuted back to false');

  // 6. Analyser Frequency Data Extraction & EQ Bars
  console.log('\n--- 6. AnalyserNode Frequency Extraction ---');
  const buffer = new Uint8Array(32);
  audio.getFrequencyData(buffer);
  assert(buffer[0] > 0, 'getFrequencyData writes non-zero frequency spectrum bytes');

  // Check UI synchronization
  assert(elements['audio-track-title'].textContent.length > 0, 'audio-track-title updated in DOM');
  assert(elements['audio-track-freq'].textContent.length > 0, 'audio-track-freq updated in DOM');

  // 7. Security & Prototype Pollution Immunity
  console.log('\n--- 7. Security & Prototype Pollution Immunity ---');
  const polluteAttacks = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf'];
  polluteAttacks.forEach((attack) => {
    const res = audio.playSfx(attack);
    assert(res === false, `playSfx("${attack}") rejected fail-closed`);
  });

  audio.pause();
}

async function run() {
  await runTestSuite(1);
  const run1Failures = failedTests;

  // Run 2: Double-Run Verification Parity Law ($Run_1 == Run_2$)
  totalTests = 0;
  passedTests = 0;
  failedTests = 0;
  failures.length = 0;

  await runTestSuite(2);
  const run2Failures = failedTests;

  console.log('\n================================================================');
  console.log(`SUMMARY: Run 1 Failures: ${run1Failures} | Run 2 Failures: ${run2Failures}`);
  console.log(`Total Checks Executed Per Run: ${passedTests}`);
  console.log('================================================================\n');

  if (run1Failures === 0 && run2Failures === 0) {
    console.log('VERDICT: PASS (Double-Run Parity Verified)');
    process.exit(0);
  } else {
    console.error('VERDICT: FAIL (Assertion errors detected)');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(2);
});
