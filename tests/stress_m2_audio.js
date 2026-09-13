/**
 * CLOWNHOUSE.IO // Milestone M2 Audio Stress & Concurrency Harness
 * 
 * Adversarially tests ClownAudio procedural Web Audio API engine:
 * 1. Rapid concurrent sound triggers (100+ playSfx in <50ms) across all SFX types and all themes.
 * 2. Web Audio node lifecycle tracking and garbage collection / disconnect verification.
 * 3. Rapid volume thrashing (1,000 adjustments in <50ms) with boundary and exotic inputs.
 * 4. Rapid mute toggling (500 toggles in <50ms) with in-flight staggered timeouts.
 * 5. Rapid theme hopping (500 swaps in <50ms) during active voice synthesis.
 * 6. Edge case & bug discovery: Uninitialized audioCtx guard deadlock analysis.
 * 7. Real Google Chrome CDP execution: Testing in real Blink Web Audio API engine.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = 8422;
const CDP_PORT = 9422;

const AUDIO_JS_CODE = fs.readFileSync(path.join(PROJECT_ROOT, 'audio.js'), 'utf8');

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failures = [];

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
  } else {
    failedAssertions++;
    failures.push(message || 'Assertion failed');
    console.error('  [FAIL] ' + (message || 'Assertion failed'));
  }
}

// ============================================================================
// PART 1: HIGH-FIDELITY WEB AUDIO API MOCK & LIFECYCLE SPY
// ============================================================================

class MockAudioParam {
  constructor(defaultValue, name, owner) {
    this.value = defaultValue;
    this.name = name;
    this.owner = owner;
    this.timeline = [];
  }

  setValueAtTime(val, time) {
    if (typeof val !== 'number' || isNaN(val)) {
      throw new TypeError(`Failed to execute 'setValueAtTime' on 'AudioParam': The provided float value is non-finite.`);
    }
    this.value = val;
    this.timeline.push({ type: 'setValueAtTime', value: val, time });
    return this;
  }

  linearRampToValueAtTime(val, time) {
    if (typeof val !== 'number' || isNaN(val)) {
      throw new TypeError(`Failed to execute 'linearRampToValueAtTime' on 'AudioParam': The provided float value is non-finite.`);
    }
    this.value = val;
    this.timeline.push({ type: 'linearRampToValueAtTime', value: val, time });
    return this;
  }

  exponentialRampToValueAtTime(val, time) {
    if (typeof val !== 'number' || isNaN(val)) {
      throw new TypeError(`Failed to execute 'exponentialRampToValueAtTime' on 'AudioParam': The provided float value is non-finite.`);
    }
    if (val <= 0) {
      throw new RangeError(`Failed to execute 'exponentialRampToValueAtTime' on 'AudioParam': The float target value provided must be non-zero.`);
    }
    this.value = val;
    this.timeline.push({ type: 'exponentialRampToValueAtTime', value: val, time });
    return this;
  }

  cancelScheduledValues(cancelTime) {
    this.timeline = this.timeline.filter(e => e.time < cancelTime);
    return this;
  }
}

class MockAudioNode {
  constructor(context, type) {
    this.context = context;
    this.nodeType = type;
    this.connectedTo = new Set();
    this.isDisconnected = false;
    this.context.stats.createdNodes++;
    this.context.stats.activeNodes++;
  }

  connect(destination) {
    this.connectedTo.add(destination);
    this.isDisconnected = false;
    this.context.stats.connections++;
    return destination;
  }

  disconnect() {
    this.connectedTo.clear();
    if (!this.isDisconnected) {
      this.isDisconnected = true;
      this.context.stats.disconnections++;
      this.context.stats.activeNodes = Math.max(0, this.context.stats.activeNodes - 1);
    }
  }
}

class MockGainNode extends MockAudioNode {
  constructor(context) {
    super(context, 'GainNode');
    this.gain = new MockAudioParam(1.0, 'gain', this);
  }
}

class MockDynamicsCompressorNode extends MockAudioNode {
  constructor(context) {
    super(context, 'DynamicsCompressorNode');
    this.threshold = new MockAudioParam(-24, 'threshold', this);
    this.knee = new MockAudioParam(30, 'knee', this);
    this.ratio = new MockAudioParam(12, 'ratio', this);
    this.attack = new MockAudioParam(0.003, 'attack', this);
    this.release = new MockAudioParam(0.25, 'release', this);
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor(context) {
    super(context, 'BiquadFilterNode');
    this.type = 'lowpass';
    this.frequency = new MockAudioParam(350, 'frequency', this);
    this.Q = new MockAudioParam(1, 'Q', this);
    this.gain = new MockAudioParam(0, 'gain', this);
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor(context) {
    super(context, 'OscillatorNode');
    this.type = 'sine';
    this.frequency = new MockAudioParam(440, 'frequency', this);
    this.detune = new MockAudioParam(0, 'detune', this);
    this.onended = null;
    this.hasStarted = false;
    this.hasStopped = false;
    this.startTime = 0;
    this.stopTime = 0;
  }

  start(time = 0) {
    if (this.hasStarted) throw new Error('Cannot start an already started OscillatorNode');
    this.hasStarted = true;
    this.startTime = time;
    this.context.stats.startedSources++;
  }

  stop(time = 0) {
    if (this.hasStopped) throw new Error('Cannot stop an already stopped OscillatorNode');
    this.hasStopped = true;
    this.stopTime = time;
    this.context.stats.stoppedSources++;
    this.context.scheduledEndedEvents.push({
      time: time,
      node: this
    });
  }
}

class MockAudioBufferSourceNode extends MockAudioNode {
  constructor(context) {
    super(context, 'AudioBufferSourceNode');
    this.buffer = null;
    this.loop = false;
    this.onended = null;
    this.hasStarted = false;
    this.hasStopped = false;
    this.startTime = 0;
    this.stopTime = 0;
  }

  start(time = 0) {
    if (this.hasStarted) throw new Error('Cannot start an already started AudioBufferSourceNode');
    this.hasStarted = true;
    this.startTime = time;
    this.context.stats.startedSources++;
  }

  stop(time = 0) {
    if (this.hasStopped) throw new Error('Cannot stop an already stopped AudioBufferSourceNode');
    this.hasStopped = true;
    this.stopTime = time;
    this.context.stats.stoppedSources++;
    this.context.scheduledEndedEvents.push({
      time: time,
      node: this
    });
  }
}

class MockAudioBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._data = new Float32Array(length);
  }

  getChannelData(channel) {
    return this._data;
  }
}

class MockAudioContext {
  constructor() {
    this.state = 'suspended';
    this.sampleRate = 44100;
    this.currentTime = 0.0;
    this.stats = {
      createdNodes: 0,
      activeNodes: 0,
      connections: 0,
      disconnections: 0,
      startedSources: 0,
      stoppedSources: 0
    };
    this.destination = new MockAudioNode(this, 'AudioDestinationNode');
    this.scheduledEndedEvents = [];
  }

  createGain() {
    return new MockGainNode(this);
  }

  createDynamicsCompressor() {
    return new MockDynamicsCompressorNode(this);
  }

  createBiquadFilter() {
    return new MockBiquadFilterNode(this);
  }

  createOscillator() {
    return new MockOscillatorNode(this);
  }

  createBufferSource() {
    return new MockAudioBufferSourceNode(this);
  }

  createBuffer(channels, length, sampleRate) {
    return new MockAudioBuffer(channels, length, sampleRate);
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }

  // Fast-forward simulated time to trigger onended callbacks and verify node cleanup
  advanceTime(seconds) {
    this.currentTime += seconds;
    const ready = [];
    const remaining = [];
    for (const evt of this.scheduledEndedEvents) {
      if (evt.time <= this.currentTime) {
        ready.push(evt);
      } else {
        remaining.push(evt);
      }
    }
    this.scheduledEndedEvents = remaining;
    for (const evt of ready) {
      if (typeof evt.node.onended === 'function') {
        evt.node.onended();
      }
    }
  }
}

// Function to instantiate fresh ClownAudio module in Node with injected AudioContext
function createIsolatedClownAudio(options = {}) {
  const code = AUDIO_JS_CODE;
  
  const mockStorage = new Map();
  if (options.initialSound) {
    mockStorage.set('clownhouse_sound', options.initialSound);
  }

  const mockCtx = options.disableMockAudio ? null : new MockAudioContext();
  const MockAudioContextClass = options.disableMockAudio ? null : function() { return mockCtx; };

  const sandboxWindow = {
    AudioContext: MockAudioContextClass,
    webkitAudioContext: MockAudioContextClass,
    localStorage: {
      getItem: (k) => mockStorage.get(k) || null,
      setItem: (k, v) => mockStorage.set(k, String(v)),
      removeItem: (k) => mockStorage.delete(k),
      clear: () => mockStorage.clear()
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    performance: {
      now: () => Date.now()
    }
  };

  const sandbox = {
    window: sandboxWindow,
    globalThis: sandboxWindow,
    module: { exports: {} },
    exports: {},
    console: console,
    Math: Math,
    Date: Date,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Number: Number,
    Boolean: Boolean,
    Object: Object,
    Array: Array
  };

  const fn = new Function(
    'window', 'globalThis', 'module', 'exports', 'console', 'Math', 'Date', 'setTimeout', 'clearTimeout', 'Number', 'Boolean', 'Object', 'Array',
    code
  );
  fn(
    sandbox.window, sandbox.globalThis, sandbox.module, sandbox.exports, sandbox.console, sandbox.Math, sandbox.Date, sandbox.setTimeout, sandbox.clearTimeout, sandbox.Number, sandbox.Boolean, sandbox.Object, sandbox.Array
  );

  return {
    audio: sandbox.module.exports,
    mockCtx,
    sandboxWindow,
    storage: mockStorage
  };
}

// ============================================================================
// SUITE 1: RAPID CONCURRENT SOUND TRIGGERS (100+ playSfx in <50ms)
// ============================================================================
async function runSuite1_ConcurrentTriggers() {
  console.log('\n--- Suite 1: Rapid Concurrent Sound Triggers (100+ playSfx in <50ms) ---');

  const THEMES = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];
  const SFX_TYPES = ['hover', 'click', 'switch', 'special'];

  // Test 1.1: 100+ rapid concurrent triggers across each theme and SFX type
  for (const theme of THEMES) {
    for (const sfx of SFX_TYPES) {
      const { audio, mockCtx } = createIsolatedClownAudio();
      audio.toggleMute(); // Unmute so sound is enabled
      audio.setTheme(theme);
      
      const startTime = Date.now();
      const CALL_COUNT = 120;
      let playedCount = 0;
      let thrownErrors = 0;

      for (let i = 0; i < CALL_COUNT; i++) {
        try {
          const res = audio.playSfx(sfx);
          if (res) playedCount++;
        } catch (err) {
          thrownErrors++;
        }
      }
      const elapsed = Date.now() - startTime;

      assert(thrownErrors === 0, `${theme} playSfx('${sfx}') threw 0 exceptions across ${CALL_COUNT} calls`);
      assert(elapsed < 50, `${theme} playSfx('${sfx}') 120 calls executed in <50ms (actual: ${elapsed}ms)`);

      if (sfx === 'hover') {
        // Hover throttle: only 1 should play in a synchronous loop <25ms
        assert(playedCount === 1, `${theme} hover throttling properly limited 120 rapid calls to 1 voice (played: ${playedCount})`);
      } else {
        // Click, switch, special should fire
        assert(playedCount === CALL_COUNT, `${theme} ${sfx} played all ${CALL_COUNT} triggers without dropping (played: ${playedCount})`);
      }

      // Test 1.2: Node Garbage Collection & Disconnect Lifecycle
      // Verify nodes are created and connected
      const nodesCreated = mockCtx.stats.createdNodes;
      assert(nodesCreated > 0, `${theme} ${sfx} created Web Audio nodes (total: ${nodesCreated})`);

      // Advance simulated time past all voice durations (1.5 seconds)
      mockCtx.advanceTime(1.5);
      // Wait for any setTimeout callbacks to resolve and then advance again
      await new Promise(r => setTimeout(r, 200));
      mockCtx.advanceTime(2.0);

      // Verify that all finished oscillator and source nodes triggered disconnect
      assert(mockCtx.stats.disconnections > 0, `${theme} ${sfx} triggered node disconnections on completion (disconnections: ${mockCtx.stats.disconnections})`);
    }
  }

  // Test 1.3: Mixed SFX Avalanche: 500 interleaved playSfx calls in <50ms
  {
    const { audio, mockCtx } = createIsolatedClownAudio();
    audio.toggleMute();
    
    const startTime = Date.now();
    let totalPlayed = 0;
    let totalErrors = 0;
    const BURST = 500;

    for (let i = 0; i < BURST; i++) {
      const theme = THEMES[i % THEMES.length];
      const sfx = SFX_TYPES[i % SFX_TYPES.length];
      audio.setTheme(theme);
      try {
        if (audio.playSfx(sfx)) totalPlayed++;
      } catch (e) {
        totalErrors++;
      }
    }
    const elapsed = Date.now() - startTime;

    assert(totalErrors === 0, `500-call interleaved avalanche threw 0 exceptions`);
    assert(elapsed < 100, `500-call interleaved avalanche finished in <100ms (actual: ${elapsed}ms)`);
    assert(totalPlayed > 0, `Avalanche executed sound profiles successfully (played: ${totalPlayed})`);

    // Let all audio finish and advance time
    await new Promise(r => setTimeout(r, 250));
    mockCtx.advanceTime(3.0);
    assert(mockCtx.stats.disconnections >= mockCtx.stats.stoppedSources, 
      `All stopped sources triggered disconnects (stopped: ${mockCtx.stats.stoppedSources}, disconnected: ${mockCtx.stats.disconnections})`);
  }

  // Test 1.4: Node Count Invariance & No Memory Leaks on Muted State
  {
    const { audio, mockCtx } = createIsolatedClownAudio();
    // Keep muted (default)
    const initialNodes = mockCtx.stats.createdNodes;
    for (let i = 0; i < 200; i++) {
      const res = audio.playSfx('click');
      assert(res === false, `playSfx while muted returns false`);
    }
    assert(mockCtx.stats.createdNodes === initialNodes, `Muted playSfx creates 0 audio nodes (prevents node memory leaks)`);
  }
}

// ============================================================================
// SUITE 2: RAPID VOLUME ADJUSTMENTS & PARAMETER COLLISION STRESS
// ============================================================================
async function runSuite2_VolumeStress() {
  console.log('\n--- Suite 2: Rapid Volume Adjustments & Parameter Collision Stress ---');

  const { audio, mockCtx } = createIsolatedClownAudio();
  audio.toggleMute(); // Unmute

  // Test 2.1: 1,000 rapid volume adjustments in <50ms
  const startVolTime = Date.now();
  let volErrors = 0;
  for (let i = 0; i < 1000; i++) {
    try {
      const v = (i % 100) / 100.0;
      const returned = audio.setVolume(v);
      if (returned !== v || audio.getVolume() !== v) {
        volErrors++;
      }
    } catch (e) {
      volErrors++;
    }
  }
  const elapsedVol = Date.now() - startVolTime;
  assert(volErrors === 0, `1,000 rapid setVolume calls executed with 0 errors`);
  assert(elapsedVol < 50, `1,000 volume adjustments completed in <50ms (actual: ${elapsedVol}ms)`);

  // Test 2.2: Boundary clamping and negative falsification
  const boundaryTests = [
    { input: -1.0, expected: 0.0 },
    { input: -99999.0, expected: 0.0 },
    { input: 1.5, expected: 1.0 },
    { input: 99999.0, expected: 1.0 },
    { input: 0.0, expected: 0.0 },
    { input: 1.0, expected: 1.0 },
    { input: NaN, expected: 0.0 },
    { input: Infinity, expected: 1.0 },
    { input: -Infinity, expected: 0.0 },
    { input: '0.8', expected: 0.8 },
    { input: 'invalid', expected: 0.0 },
    { input: null, expected: 0.0 },
    { input: undefined, expected: 0.0 },
    { input: {}, expected: 0.0 },
    { input: [], expected: 0.0 }
  ];

  for (const t of boundaryTests) {
    const res = audio.setVolume(t.input);
    assert(Math.abs(res - t.expected) < 0.0001, `setVolume(${JSON.stringify(t.input)}) clamped to ${t.expected} (got: ${res})`);
  }

  // Test 2.3: Volume adjustments concurrent with active audio playback
  let concurrentErrors = 0;
  for (let i = 0; i < 100; i++) {
    try {
      audio.playSfx('switch');
      audio.setVolume(Math.random());
      audio.playSfx('click');
      audio.setVolume(Math.random());
    } catch (e) {
      concurrentErrors++;
    }
  }
  assert(concurrentErrors === 0, `Concurrent playSfx and setVolume thrashing threw 0 exceptions`);
}

// ============================================================================
// SUITE 3: RAPID MUTE TOGGLING & IN-FLIGHT TIMEOUT INTEGRITY
// ============================================================================
async function runSuite3_MuteThrashing() {
  console.log('\n--- Suite 3: Rapid Mute Toggling & In-Flight Timeout Integrity ---');

  const { audio, mockCtx, storage } = createIsolatedClownAudio();
  assert(audio.isMuted() === true, `Audio starts muted by default`);

  // Test 3.1: 500 rapid mute toggles in <50ms
  const startMuteTime = Date.now();
  let toggleErrors = 0;
  for (let i = 0; i < 500; i++) {
    const expected = (i % 2 === 0) ? false : true;
    const res = audio.toggleMute();
    if (res !== expected || audio.isMuted() !== expected) {
      toggleErrors++;
    }
  }
  const elapsedMute = Date.now() - startMuteTime;
  assert(toggleErrors === 0, `500 rapid mute toggles kept state consistency`);
  assert(elapsedMute < 50, `500 mute toggles finished in <50ms (actual: ${elapsedMute}ms)`);
  assert(storage.get('clownhouse_sound') === (audio.isMuted() ? 'off' : 'on'), `Storage synchronized with final mute state`);

  // Test 3.2: Muting cancels/suppresses in-flight staggered timeouts
  // Reset and unmute
  audio.toggleMute(); // Now unmuted
  assert(audio.isMuted() === false, `Audio is unmuted`);

  // Fire 'switch' which schedules 4 staggered notes (0ms, 40ms, 80ms, 120ms)
  audio.setTheme('tower-of-power');
  audio.playSfx('switch');

  // Immediately mute
  audio.toggleMute(); // Now muted
  assert(audio.isMuted() === true, `Audio is muted immediately after switch call`);

  const nodesAtMute = mockCtx.stats.createdNodes;
  // Wait 200ms so all 4 timeouts elapse
  await new Promise(r => setTimeout(r, 200));

  // Verify that the delayed timeouts checked (!soundEnabled || isMuted) and did NOT create additional voices
  const nodesAfterTimeout = mockCtx.stats.createdNodes;
  assert(nodesAfterTimeout === nodesAtMute, 
    `Muting suppressed in-flight staggered timeouts (nodes before: ${nodesAtMute}, after: ${nodesAfterTimeout})`);
}

// ============================================================================
// SUITE 4: RAPID THEME HOPPING UNDER AUDIO LOAD
// ============================================================================
async function runSuite4_ThemeHopping() {
  console.log('\n--- Suite 4: Rapid Theme Hopping Under Audio Load ---');

  const { audio } = createIsolatedClownAudio();
  audio.toggleMute(); // Unmute

  const THEMES = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];

  // Test 4.1: 500 rapid theme hops while triggering audio
  const startHopTime = Date.now();
  let hopErrors = 0;
  for (let i = 0; i < 500; i++) {
    const targetTheme = THEMES[i % THEMES.length];
    const ok = audio.setTheme(targetTheme);
    if (!ok || audio.getActiveTheme() !== targetTheme) {
      hopErrors++;
    }
    // Fire a sound during the hop
    audio.playSfx('click');
  }
  const elapsedHop = Date.now() - startHopTime;

  assert(hopErrors === 0, `500 rapid theme hops maintained state integrity`);
  assert(elapsedHop < 100, `500 theme hops with sound triggers ran in <100ms (actual: ${elapsedHop}ms)`);

  // Test 4.2: Hostile/Invalid Theme Names fail-closed
  const hostileThemes = [
    'invalid-theme',
    '',
    null,
    undefined,
    12345,
    '__proto__',
    'constructor',
    'prototype',
    'tower-of-power/../',
    '<script>alert(1)</script>'
  ];

  const currentActive = audio.getActiveTheme();
  for (const bad of hostileThemes) {
    const res = audio.setTheme(bad);
    assert(res === false, `setTheme(${JSON.stringify(bad)}) rejected fail-closed`);
    assert(audio.getActiveTheme() === currentActive, `Active theme remained unchanged after invalid theme`);
  }
}

// ============================================================================
// SUITE 5: EMPIRICAL FALSIFICATION & EDGE CASE MINING
// ============================================================================
async function runSuite5_FalsificationAndEdgeCases() {
  console.log('\n--- Suite 5: Empirical Falsification & Edge Case Mining ---');

  // Test 5.1: Negative Falsification of playSfx with malformed inputs
  {
    const { audio } = createIsolatedClownAudio();
    audio.toggleMute(); // unmuted
    const badSfx = [null, undefined, '', 123, {}, [], '__proto__', 'constructor', 'invalidSfx'];
    for (const b of badSfx) {
      const res = audio.playSfx(b);
      assert(res === false, `playSfx(${JSON.stringify(b)}) fails closed to false`);
    }
  }

  // Test 5.2: CRITICAL BUG PROBE - Deadlock on hydrated unmuted state with null audioCtx
  // When clownhouse_sound is 'on' in localStorage, audio.js hydrates isMuted = false, soundEnabled = true.
  // BUT audioCtx is null because initContext() is deferred.
  // Now, when user triggers playSfx('click') without clicking sound-toggle:
  // Does playSfx initialize audioCtx, or does line 807 return false because !audioCtx?
  {
    console.log('  [PROBE] Testing initial hydration deadlock (clownhouse_sound="on", audioCtx=null)...');
    const { audio, sandboxWindow } = createIsolatedClownAudio({ initialSound: 'on' });
    
    assert(audio.isMuted() === false, `Audio hydrated isMuted = false from storage`);
    assert(audio.getContextState() === 'uninitialized', `audioCtx starts uninitialized (null)`);

    // In a real browser, clicking a link triggers playSfx('click') or playSfx('switch')
    const playResult = audio.playSfx('click');
    const contextAfterPlay = audio.getContextState();

    console.log(`    playResult: ${playResult}, contextAfterPlay: ${contextAfterPlay}`);
    if (playResult === false && contextAfterPlay === 'uninitialized') {
      console.warn('    [CHALLENGE FINDING]: audio.js line 807 checks `if (!soundEnabled || isMuted || !audioCtx) return false;` BEFORE line 823 `initContext()`.');
      console.warn('    This causes a silent audio deadlock when clownhouse_sound="on": playSfx will never play or initialize audioCtx until toggleMute() is called!');
      assert(false, `[VULNERABILITY CONFIRMED] playSfx deadlocks when sound restored as unmuted because !audioCtx check precedes initContext()`);
    } else {
      assert(true, `playSfx initialized audio context smoothly on user interaction`);
    }
  }

  // Test 5.3: Prototype Pollution Defense on VALID_THEMES and PROFILES
  {
    const { audio } = createIsolatedClownAudio();
    const polluted = audio.setTheme('valueOf');
    assert(polluted === false, `Cannot set prototype properties as active theme`);
    assert(audio.getActiveTheme() === 'tower-of-power', `Theme remained default tower-of-power`);
  }

  // Test 5.4: Stress playTone direct API boundary robustness
  {
    const { audio } = createIsolatedClownAudio();
    audio.toggleMute();
    const badTones = [
      [-100, 'sine', 0.1, 0.5],
      [440, 'invalidType', 0.1, 0.5],
      [440, 'sine', -0.5, 0.5],
      [440, 'sine', 0.1, -1.0],
      [NaN, 'sine', 0.1, 0.5]
    ];
    let toneExceptions = 0;
    for (const args of badTones) {
      try {
        audio.playTone(...args);
      } catch (e) {
        toneExceptions++;
      }
    }
    assert(toneExceptions === 0, `playTone handled all malformed / out-of-range parameters gracefully without throwing`);
  }
}

// ============================================================================
// SUITE 6: REAL GOOGLE CHROME CDP STRESS & CONCURRENCY VERIFICATION
// ============================================================================
function startStaticServer() {
  const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
  };

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(PROJECT_ROOT, reqPath);

      if (!filePath.startsWith(PROJECT_ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
        res.end(data);
      });
    });

    server.listen(PORT, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

function launchChrome() {
  return new Promise((resolve, reject) => {
    const chrome = spawn('google-chrome', [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      `--remote-debugging-port=${CDP_PORT}`,
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--autoplay-policy=no-user-gesture-required',
      `http://127.0.0.1:${PORT}/index.html`
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    chrome.on('error', reject);

    let retries = 25;
    const checkCdp = () => {
      http.get(`http://127.0.0.1:${CDP_PORT}/json`, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const targets = JSON.parse(raw);
            const pageTarget = targets.find(t => t.type === 'page' || t.url.includes(String(PORT)));
            if (pageTarget && pageTarget.webSocketDebuggerUrl) {
              resolve({ chrome, wsUrl: pageTarget.webSocketDebuggerUrl });
            } else if (targets.length > 0 && targets[0].webSocketDebuggerUrl) {
              resolve({ chrome, wsUrl: targets[0].webSocketDebuggerUrl });
            } else if (retries-- > 0) {
              setTimeout(checkCdp, 200);
            } else {
              reject(new Error('No CDP target found'));
            }
          } catch (e) {
            if (retries-- > 0) setTimeout(checkCdp, 200);
            else reject(e);
          }
        });
      }).on('error', () => {
        if (retries-- > 0) setTimeout(checkCdp, 200);
        else reject(new Error('CDP connection failed'));
      });
    };
    setTimeout(checkCdp, 500);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
    this.events = [];
    this.consoleLogs = [];
    this.runtimeErrors = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data.toString());
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(new Error(msg.error.message));
          else cb.resolve(msg.result);
        }
        if (msg.method === 'Console.messageAdded') {
          this.consoleLogs.push(msg.params.message);
        }
        if (msg.method === 'Runtime.consoleAPICalled') {
          this.consoleLogs.push(msg.params);
        }
        if (msg.method === 'Runtime.exceptionThrown') {
          this.runtimeErrors.push(msg.params);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error('CDP Eval Exception: ' + (res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)));
    }
    return res.result ? res.result.value : undefined;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
  }
}

async function runSuite6_ChromeCDPStress() {
  console.log('\n--- Suite 6: Real Google Chrome CDP Stress & Concurrency ---');

  let server = null;
  let chromeProc = null;
  let client = null;

  try {
    server = await startStaticServer();
    const { chrome, wsUrl } = await launchChrome();
    chromeProc = chrome;

    client = new CDPClient(wsUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Console.enable');

    // Wait for document to be ready
    await new Promise(r => setTimeout(r, 800));

    // Test 6.1: Verify ClownAudio is available in browser
    const audioLoaded = await client.eval(`typeof window.ClownAudio !== 'undefined'`);
    assert(audioLoaded === true, `ClownAudio is loaded and exposed on window in Google Chrome`);

    // Test 6.2: Unmute audio by clicking #sound-toggle
    const initialMuted = await client.eval(`window.ClownAudio.isMuted()`);
    assert(initialMuted === true, `ClownAudio starts muted in Google Chrome`);

    await client.eval(`
      const btn = document.getElementById('sound-toggle');
      if (btn) btn.click();
    `);
    await new Promise(r => setTimeout(r, 100));

    const unmutedState = await client.eval(`window.ClownAudio.isMuted()`);
    assert(unmutedState === false, `Sound toggle click unmuted ClownAudio in Chrome`);

    const contextState = await client.eval(`window.ClownAudio.getContextState()`);
    assert(contextState === 'running', `Web Audio AudioContext is 'running' in Chrome`);

    // Test 6.3: Hammer 120 rapid playSfx calls in real Chrome browser in <50ms
    const cdpStressResult = await client.eval(`
      (() => {
        const start = performance.now();
        let played = 0;
        let errors = 0;
        for (let i = 0; i < 120; i++) {
          try {
            if (window.ClownAudio.playSfx('click')) played++;
          } catch (e) {
            errors++;
          }
        }
        const elapsed = performance.now() - start;
        return { played, errors, elapsed };
      })()
    `);

    assert(cdpStressResult.errors === 0, `120 rapid playSfx('click') in Google Chrome had 0 errors`);
    assert(cdpStressResult.elapsed < 50, `120 rapid playSfx in Google Chrome ran in <50ms (actual: ${cdpStressResult.elapsed.toFixed(1)}ms)`);
    assert(cdpStressResult.played === 120, `All 120 click SFX triggered in Chrome (played: ${cdpStressResult.played})`);

    // Test 6.4: Rapid volume, mute, and theme thrashing in Chrome
    const cdpChaosResult = await client.eval(`
      (() => {
        const start = performance.now();
        const themes = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];
        let errors = 0;
        for (let i = 0; i < 200; i++) {
          try {
            window.ClownAudio.setTheme(themes[i % themes.length]);
            window.ClownAudio.setVolume((i % 10) / 10);
            window.ClownAudio.playSfx('special');
            if (i % 25 === 0) window.ClownAudio.toggleMute();
          } catch (e) {
            errors++;
          }
        }
        return { errors, elapsed: performance.now() - start };
      })()
    `);

    assert(cdpChaosResult.errors === 0, `200-iteration chaos monkey in Google Chrome threw 0 errors`);
    assert(cdpChaosResult.elapsed < 100, `Chrome chaos monkey finished in <100ms (actual: ${cdpChaosResult.elapsed.toFixed(1)}ms)`);

    // Ensure no uncaught browser runtime errors occurred
    assert(client.runtimeErrors.length === 0, `0 uncaught browser runtime exceptions during audio stress in Chrome`);

  } catch (err) {
    console.error('Chrome CDP test failed with error:', err);
    assert(false, `Google Chrome CDP stress testing failed: ${err.message}`);
  } finally {
    if (client) client.close();
    if (chromeProc) {
      try { chromeProc.kill('SIGKILL'); } catch (e) {}
    }
    if (server) {
      try { server.close(); } catch (e) {}
    }
  }
}

// ============================================================================
// MASTER HARNESS RUNNER
// ============================================================================
async function runAllSuites() {
  console.log('================================================================');
  console.log('CLOWNHOUSE.IO // Milestone M2 Audio Stress & Concurrency Suite');
  console.log('================================================================');

  try {
    await runSuite1_ConcurrentTriggers();
    await runSuite2_VolumeStress();
    await runSuite3_MuteThrashing();
    await runSuite4_ThemeHopping();
    await runSuite5_FalsificationAndEdgeCases();
    await runSuite6_ChromeCDPStress();
  } catch (err) {
    console.error('Fatal harness error:', err);
    totalAssertions++;
    failedAssertions++;
    failures.push(`Fatal harness error: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log(`TOTAL ASSERTIONS: ${totalAssertions}`);
  console.log(`PASSED:           ${passedAssertions}`);
  console.log(`FAILED:           ${failedAssertions}`);
  console.log('================================================================');

  if (failedAssertions > 0) {
    console.error('\nFAILURES DETECTED:');
    failures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log('\nALL STRESS & CONCURRENCY ASSERTIONS PASSED EMPIRICALLY [CONFIRM].');
    process.exit(0);
  }
}

runAllSuites();
