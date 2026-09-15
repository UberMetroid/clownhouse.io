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
const AUDIO_MODULE_PATHS = [
  'audio/state.js',
  'audio/catalog.js',
  'audio/graph.js',
  'audio/transport.js',
  'audio/ui.js',
  'audio/sfx.js',
  'audio.js'
].map(p => path.join(PROJECT_ROOT, p));
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

