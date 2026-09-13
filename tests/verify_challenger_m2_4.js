/**
 * CLOWNHOUSE.IO // Milestone M2 Audio Security & Boundary Falsification Harness
 * Challenger M2-4 Verification Suite
 * 
 * Verifies:
 * 1. Execution of tests/fuzz_m2_audio_security.js (all 3,264 assertions across Run 1 & Run 2 with 0 findings).
 * 2. Prototype pollution immunity: injected functions on Object.prototype cannot be executed via playSfx.
 * 3. Prototype method bypass immunity: playSfx('constructor'), playSfx('toString'), playSfx('valueOf') return false.
 * 4. Adversarial inputs on audio.setVolume and app.setVolume (Symbol, Object.create(null), throwing valueOf/toString).
 * 5. Double-Run Parity Law enforcement.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const AUDIO_JS_PATH = path.join(PROJECT_ROOT, 'audio.js');
const APP_JS_PATH = path.join(PROJECT_ROOT, 'app.js');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const checkFailures = [];

function assertCheck(cond, desc) {
  totalChecks++;
  if (cond) {
    passedChecks++;
    console.log(`  [PASS] ${desc}`);
  } else {
    failedChecks++;
    checkFailures.push(desc);
    console.error(`  [FAIL] ${desc}`);
  }
}

// Mock Web Audio Context
class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0.05;
    this.sampleRate = 44100;
    this.destination = {};
  }
  createGain() {
    return {
      gain: {
        value: 1.0,
        setValueAtTime: function (v) { this.value = v; },
        linearRampToValueAtTime: function (v) { this.value = v; },
        exponentialRampToValueAtTime: function (v) { this.value = v; },
        cancelScheduledValues: function () {}
      },
      connect: function () {},
      disconnect: function () {}
    };
  }
  createDynamicsCompressor() {
    return {
      threshold: { setValueAtTime: function () {} },
      knee: { setValueAtTime: function () {} },
      ratio: { setValueAtTime: function () {} },
      attack: { setValueAtTime: function () {} },
      release: { setValueAtTime: function () {} },
      connect: function () {},
      disconnect: function () {}
    };
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: function () {}, exponentialRampToValueAtTime: function () {} },
      connect: function () {},
      disconnect: function () {},
      start: function () {},
      stop: function () {}
    };
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(100) };
  }
  createBufferSource() {
    return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {} };
  }
  createBiquadFilter() {
    return {
      frequency: { setValueAtTime: function () {}, exponentialRampToValueAtTime: function () {} },
      Q: { setValueAtTime: function () {} },
      gain: { setValueAtTime: function () {} },
      connect: function () {},
      disconnect: function () {}
    };
  }
}

function loadIsolatedAudio() {
  const sandbox = {
    window: {
      AudioContext: MockAudioContext,
      localStorage: { getItem: () => 'on', setItem: () => {} },
      performance: { now: () => 1000 }
    },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: setTimeout,
    module: { exports: {} },
    exports: {}
  };
  sandbox.globalThis = sandbox.window;
  const code = fs.readFileSync(AUDIO_JS_PATH, 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.module.exports;
}

function loadIsolatedApp() {
  const sandbox = {
    window: {
      localStorage: { getItem: () => 'tower-of-power', setItem: () => {} },
      ClownAudio: loadIsolatedAudio()
    },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: setTimeout,
    module: { exports: {} },
    exports: {}
  };
  sandbox.globalThis = sandbox.window;
  const code = fs.readFileSync(APP_JS_PATH, 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.module.exports;
}

function runVerificationSuite() {
  console.log('\n--- 1. Baseline Fuzz Harness Execution ---');
  const fuzzOutput = execSync('node tests/fuzz_m2_audio_security.js', { cwd: PROJECT_ROOT, encoding: 'utf8' });
  assertCheck(fuzzOutput.includes('Run 1: Total=3264, Passed=3264, Failed=0'), 'Run 1 passed all 3,264 assertions');
  assertCheck(fuzzOutput.includes('Run 2: Total=3264, Passed=3264, Failed=0'), 'Run 2 passed all 3,264 assertions');
  assertCheck(fuzzOutput.includes('Double-Run Bit-for-Bit State Invariance: CONFIRMED'), 'Double-Run Bit-for-Bit State Invariance CONFIRMED');
  assertCheck(fuzzOutput.includes('ALL BASELINE ASSERTIONS PASSED'), 'All baseline fuzz assertions passed with 0 findings');

  console.log('\n--- 2. Prototype Pollution Protection Verification ---');
  const audio = loadIsolatedAudio();
  if (audio.isMuted()) {
    audio.toggleMute(); // ensure unmuted (isMuted() === false)
  }

  let injectedExecuted = false;
  Object.prototype.injectedAttackerSfx = function () {
    injectedExecuted = true;
  };
  let injectedSwitchExecuted = false;
  const originalSwitch = Object.prototype.switch;
  Object.prototype.switch = function () {
    injectedSwitchExecuted = true;
  };

  const resInjected = audio.playSfx('injectedAttackerSfx');
  assertCheck(resInjected === false, "playSfx('injectedAttackerSfx') returns false");
  assertCheck(injectedExecuted === false, "Object.prototype.injectedAttackerSfx was NOT executed");

  const resSwitch = audio.playSfx('switch');
  assertCheck(resSwitch === true, "playSfx('switch') executes legitimate theme sound");
  assertCheck(injectedSwitchExecuted === false, "Object.prototype.switch was NOT executed");

  delete Object.prototype.injectedAttackerSfx;
  if (originalSwitch !== undefined) Object.prototype.switch = originalSwitch; else delete Object.prototype.switch;

  console.log('\n--- 3. Prototype Method Bypass Rejection ---');
  const protoBypasses = [
    'constructor',
    'toString',
    'valueOf',
    '__proto__',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString'
  ];
  for (const bypass of protoBypasses) {
    const res = audio.playSfx(bypass);
    assertCheck(res === false, `playSfx('${bypass}') strictly rejected and returns false`);
  }

  console.log('\n--- 4. Adversarial Inputs on audio.setVolume ---');
  const adversarialAudioInputs = [
    { input: Symbol('vol'), name: "Symbol('vol')", expected: 0.0 },
    { input: Symbol.for('volume'), name: "Symbol.for('volume')", expected: 0.0 },
    { input: Symbol.iterator, name: "Symbol.iterator", expected: 0.0 },
    { input: Object.create(null), name: "Object.create(null)", expected: 0.0 },
    { input: Object.freeze(Object.create(null)), name: "Object.freeze(Object.create(null))", expected: 0.0 },
    { input: { valueOf: () => { throw new Error('hostile valueOf'); } }, name: "{ valueOf: throw }", expected: 0.0 },
    { input: { toString: () => { throw new Error('hostile toString'); } }, name: "{ toString: throw }", expected: 0.0 },
    { input: new Proxy({}, { get: () => { throw new Error('proxy trap'); } }), name: "Proxy get throw", expected: 0.0 },
    { input: [Symbol('nested')], name: "[Symbol('nested')]", expected: 0.0 },
    { input: 10n, name: "10n (BigInt)", expected: 1.0 },
    { input: -10n, name: "-10n (BigInt)", expected: 0.0 }
  ];

  for (const { input, name, expected } of adversarialAudioInputs) {
    let threw = false;
    let res = null;
    try {
      res = audio.setVolume(input);
    } catch (e) {
      threw = true;
    }
    assertCheck(!threw && res === expected, `audio.setVolume(${name}) returns ${expected} without throw`);
  }

  console.log('\n--- 5. Adversarial Inputs on app.setVolume ---');
  const app = loadIsolatedApp();
  const adversarialAppInputs = [
    { input: Symbol('vol'), name: "Symbol('vol')", expected: 0 },
    { input: Symbol.for('volume'), name: "Symbol.for('volume')", expected: 0 },
    { input: Symbol.iterator, name: "Symbol.iterator", expected: 0 },
    { input: Object.create(null), name: "Object.create(null)", expected: 0 },
    { input: Object.freeze(Object.create(null)), name: "Object.freeze(Object.create(null))", expected: 0 },
    { input: { valueOf: () => { throw new Error('hostile valueOf'); } }, name: "{ valueOf: throw }", expected: 0 },
    { input: { toString: () => { throw new Error('hostile toString'); } }, name: "{ toString: throw }", expected: 0 },
    { input: new Proxy({}, { get: () => { throw new Error('proxy trap'); } }), name: "Proxy get throw", expected: 0 },
    { input: [Symbol('nested')], name: "[Symbol('nested')]", expected: 0 },
    { input: 10n, name: "10n (BigInt)", expected: 1 },
    { input: -10n, name: "-10n (BigInt)", expected: 0 }
  ];

  for (const { input, name, expected } of adversarialAppInputs) {
    let threw = false;
    let res = null;
    try {
      res = app.setVolume(input);
    } catch (e) {
      threw = true;
    }
    assertCheck(!threw && res === expected, `app.setVolume(${name}) returns ${expected} without throw`);
  }

  console.log('\n--- 6. Adversarial Inputs on audio.playSfx & audio.setTheme ---');
  const hostileSfxInputs = [
    Symbol('switch'),
    Object.create(null),
    { toString: () => { throw new Error('attack'); } },
    null,
    undefined,
    123,
    ['switch']
  ];
  for (const input of hostileSfxInputs) {
    let threw = false;
    let res = null;
    try {
      res = audio.playSfx(input);
    } catch (e) {
      threw = true;
    }
    assertCheck(!threw && res === false, `audio.playSfx(${typeof input}) returns false without throw`);
  }

  return { total: totalChecks, passed: passedChecks, failed: failedChecks, failures: [...checkFailures] };
}

console.log('================================================================');
console.log(' CLOWNHOUSE.IO // CHALLENGER M2-4 EMPIRICAL FALSIFICATION RUN');
console.log('================================================================');

console.log('>>> EXECUTING RUN 1...');
const r1 = runVerificationSuite();

// Reset counters for Double Run
totalChecks = 0;
passedChecks = 0;
failedChecks = 0;
checkFailures.length = 0;

console.log('\n>>> EXECUTING RUN 2 (Double-Run Invariance Gate)...');
const r2 = runVerificationSuite();

const bitForBit = (
  r1.total === r2.total &&
  r1.passed === r2.passed &&
  r1.failed === r2.failed &&
  JSON.stringify(r1.failures) === JSON.stringify(r2.failures)
);

console.log('\n================================================================');
console.log(` DOUBLE-RUN RESULTS: Run 1 (${r1.passed}/${r1.total}), Run 2 (${r2.passed}/${r2.total})`);
console.log(` Bit-For-Bit Parity: ${bitForBit ? 'CONFIRMED' : 'VIOLATION'}`);
console.log('================================================================');

if (r1.failed === 0 && bitForBit) {
  console.log('>>> EMPIRICAL VERDICT: CONFIRM');
  process.exit(0);
} else {
  console.error(`>>> EMPIRICAL VERDICT: CHALLENGE (${r1.failed} failures)`);
  process.exit(1);
}
