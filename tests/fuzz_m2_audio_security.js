/**
 * CLOWNHOUSE.IO // Milestone M2 Audio Engine Boundary & Security Fuzz Harness
 * 
 * Deeply challenges:
 * 1. setVolume with negative, overflow, NaN, null, and object inputs (verify strict clamping [0.0, 1.0]).
 * 2. setTheme in audio.js with invalid strings and prototype pollution.
 * 3. Fail-open safety when sound card/AudioContext is missing or throws.
 * 4. playSfx prototype pollution, hover throttling, and exotic argument handling.
 * 5. Double-Run verification parity ($Run_1 == Run_2$).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const AUDIO_JS_PATH = path.join(PROJECT_ROOT, 'audio.js');
const APP_JS_PATH = path.join(PROJECT_ROOT, 'app.js');

const VALID_THEMES = [
  'tower-of-power',
  'chozo-visor',
  'wrx-telemetry',
  'hunter-base',
  'pacific-outpost'
];

// --- Mock Audio Context Generator ---
function createMockAudioContextClass(options = {}) {
  const {
    throwOnConstruct = false,
    constructErrorName = 'NotAllowedError',
    constructErrorMessage = 'The play() request was interrupted by new permissions policy.',
    throwOnResume = false,
    rejectOnResume = false,
    failCreateGain = false
  } = options;

  return class MockAudioContext {
    constructor() {
      if (throwOnConstruct) {
        const err = new Error(constructErrorMessage);
        err.name = constructErrorName;
        throw err;
      }
      this.state = 'suspended';
      this.currentTime = 0.05;
      this.sampleRate = 44100;
      this.destination = { id: 'mock-destination' };
    }

    resume() {
      if (throwOnResume) {
        throw new Error('AudioContext resume failed synchronously.');
      }
      if (rejectOnResume) {
        return Promise.reject(new Error('AudioContext resume failed asynchronously.'));
      }
      this.state = 'running';
      return Promise.resolve();
    }

    createGain() {
      if (failCreateGain) {
        throw new Error('Audio hardware node allocation failure.');
      }
      return {
        gain: {
          value: 1.0,
          setValueAtTime: function (val, time) { this.value = val; },
          linearRampToValueAtTime: function (val, time) { this.value = val; },
          exponentialRampToValueAtTime: function (val, time) { this.value = val; },
          cancelScheduledValues: function (time) {}
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
        frequency: {
          setValueAtTime: function () {},
          exponentialRampToValueAtTime: function () {}
        },
        connect: function () {},
        disconnect: function () {},
        start: function () {},
        stop: function () {},
        onended: null
      };
    }

    createBiquadFilter() {
      return {
        type: 'lowpass',
        frequency: {
          setValueAtTime: function () {},
          exponentialRampToValueAtTime: function () {}
        },
        Q: { setValueAtTime: function () {} },
        gain: { setValueAtTime: function () {} },
        connect: function () {},
        disconnect: function () {}
      };
    }

    createBuffer(channels, length, sampleRate) {
      return {
        numberOfChannels: channels,
        length: length,
        sampleRate: sampleRate,
        getChannelData: function () {
          return new Float32Array(length);
        }
      };
    }

    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        connect: function () {},
        disconnect: function () {},
        start: function () {},
        stop: function () {},
        onended: null
      };
    }
  };
}

// --- Isolated Sandbox Loader ---
function loadIsolatedAudioModule(options = {}) {
  const {
    hasWindow = true,
    AudioContextClass = null,
    initialTheme = 'tower-of-power',
    initialSound = 'off'
  } = options;

  const storageMap = new Map();
  if (initialSound) {
    storageMap.set('clownhouse_sound', initialSound);
  }

  let mockPerfTime = 1000;
  const windowMock = hasWindow ? {
    AudioContext: AudioContextClass,
    webkitAudioContext: null,
    localStorage: {
      getItem: (k) => storageMap.get(k) || null,
      setItem: (k, v) => storageMap.set(k, String(v)),
      removeItem: (k) => storageMap.delete(k)
    },
    addEventListener: () => {},
    performance: {
      now: () => mockPerfTime,
      advance: (ms) => { mockPerfTime += ms; }
    }
  } : null;

  const documentMock = hasWindow ? {
    documentElement: {
      getAttribute: (attr) => attr === 'data-theme' ? initialTheme : null
    }
  } : null;

  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    window: windowMock,
    document: documentMock,
    globalThis: windowMock || {},
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    performance: windowMock ? windowMock.performance : { now: () => Date.now() },
    module: { exports: {} },
    exports: {}
  };

  const code = fs.readFileSync(AUDIO_JS_PATH, 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  return {
    audio: sandbox.module.exports,
    sandbox: sandbox
  };
}

// --- Test Harness Framework ---
let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failures = [];
const findings = [];

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
  } else {
    failedAssertions++;
    failures.push(message || `Assertion #${totalAssertions} failed`);
  }
}

function recordFinding(type, name, details) {
  findings.push({ type, name, details });
}

// ==============================================================================
// SUITE 1: setVolume Exhaustive Fuzzing & Clamping Matrix
// ==============================================================================
function runSuite1VolumeFuzzing() {
  console.log('--- [Suite 1] setVolume Exhaustive Boundary & Clamping Fuzzing ---');
  const { audio } = loadIsolatedAudioModule({ AudioContextClass: createMockAudioContextClass() });

  // 1. Negative numbers -> strictly 0.0
  const negativeInputs = [
    -100, -100000, -1.0, -0.5, -0.001, -0.000000001,
    -Number.MIN_VALUE, -Number.MAX_VALUE, -Infinity,
    "-50", "-0.001", "-Infinity"
  ];
  for (const val of negativeInputs) {
    const res = audio.setVolume(val);
    assert(res === 0.0, `setVolume(${val}) must return 0.0, got ${res}`);
    assert(audio.getVolume() === 0.0, `getVolume() after setVolume(${val}) must be 0.0, got ${audio.getVolume()}`);
  }

  // 2. Overflow numbers -> strictly 1.0
  const overflowInputs = [
    1.0000001, 1.01, 1.5, 2.0, 10.0, 99999, 1e12,
    Number.MAX_VALUE, Infinity,
    "1.5", "100", "99999", "Infinity"
  ];
  for (const val of overflowInputs) {
    const res = audio.setVolume(val);
    assert(res === 1.0, `setVolume(${val}) must return 1.0, got ${res}`);
    assert(audio.getVolume() === 1.0, `getVolume() after setVolume(${val}) must be 1.0, got ${audio.getVolume()}`);
  }

  // 3. Valid boundary and mid-range numbers
  const validInputs = [
    [0.0, 0.0],
    [1.0, 1.0],
    [0.5, 0.5],
    [0.75, 0.75],
    [0.12345, 0.12345],
    ["0.0", 0.0],
    ["1.0", 1.0],
    ["0.4", 0.4]
  ];
  for (const [input, expected] of validInputs) {
    const res = audio.setVolume(input);
    assert(Math.abs(res - expected) < 1e-6, `setVolume(${input}) expected ${expected}, got ${res}`);
    assert(Math.abs(audio.getVolume() - expected) < 1e-6, `getVolume() expected ${expected}, got ${audio.getVolume()}`);
  }

  // 4. Non-numeric primitives: NaN, null, undefined, invalid strings
  const nonNumericInputs = [
    NaN, null, undefined, "", "   ", "abc", "vol_max",
    "NaN", "undefined", "null", {}, []
  ];
  for (const val of nonNumericInputs) {
    const res = audio.setVolume(val);
    assert(res === 0.0, `setVolume(${JSON.stringify(val)}) must fallback to 0.0, got ${res}`);
    assert(audio.getVolume() === 0.0, `getVolume() after non-numeric input must be 0.0, got ${audio.getVolume()}`);
  }

  // 5. Booleans
  assert(audio.setVolume(false) === 0.0, `setVolume(false) should be 0.0`);
  assert(audio.setVolume(true) === 1.0, `setVolume(true) should be 1.0`);

  // 6. Custom objects with valueOf
  assert(audio.setVolume({ valueOf: () => 0.65 }) === 0.65, `Custom object with valueOf: 0.65 failed`);
  assert(audio.setVolume({ valueOf: () => -5.0 }) === 0.0, `Custom object with valueOf: -5.0 must clamp to 0.0`);
  assert(audio.setVolume({ valueOf: () => 50.0 }) === 1.0, `Custom object with valueOf: 50.0 must clamp to 1.0`);
  assert(audio.setVolume({ valueOf: () => NaN }) === 0.0, `Custom object with valueOf: NaN must fallback to 0.0`);

  // 7. Arrays
  assert(audio.setVolume([0.33]) === 0.33, `Array [0.33] failed`);
  assert(audio.setVolume([-2]) === 0.0, `Array [-2] must clamp to 0.0`);
  assert(audio.setVolume([99]) === 1.0, `Array [99] must clamp to 1.0`);
  assert(audio.setVolume([1, 2]) === 0.0, `Array [1, 2] must fallback to 0.0`);

  // 8. Adversarial Hostile Inputs (Testing for Unhandled Exceptions)
  // 8a. Object.create(null)
  let objCreateNullThrew = false;
  try {
    audio.setVolume(Object.create(null));
  } catch (e) {
    objCreateNullThrew = true;
    recordFinding('BUG', 'SET_VOLUME_OBJECT_CREATE_NULL_EXCEPTION', {
      error: e.message,
      stack: e.stack
    });
  }
  // Document whether audio.setVolume throws on Object.create(null)
  if (objCreateNullThrew) {
    console.log('  [OBSERVATION] audio.setVolume(Object.create(null)) threw TypeError: Cannot convert object to primitive value');
  }

  // 8b. Symbol('vol')
  let symbolThrew = false;
  try {
    audio.setVolume(Symbol('vol'));
  } catch (e) {
    symbolThrew = true;
    recordFinding('BUG', 'SET_VOLUME_SYMBOL_EXCEPTION', {
      error: e.message,
      stack: e.stack
    });
  }
  if (symbolThrew) {
    console.log('  [OBSERVATION] audio.setVolume(Symbol(...)) threw TypeError: Cannot convert a Symbol value to a number');
  }

  // 8c. Throwing valueOf
  let throwingObjThrew = false;
  try {
    audio.setVolume({ valueOf: () => { throw new Error('attack'); } });
  } catch (e) {
    throwingObjThrew = true;
    recordFinding('FLAW', 'SET_VOLUME_THROWING_VALUEOF', { error: e.message });
  }

  console.log(`Suite 1 completed: ${passedAssertions}/${totalAssertions} assertions passed.`);
}

// ==============================================================================
// SUITE 2: setTheme Boundary, Injection, & Prototype Pollution Matrix
// ==============================================================================
function runSuite2ThemeFuzzing() {
  console.log('--- [Suite 2] setTheme Boundary & Prototype Pollution Matrix ---');
  const { audio } = loadIsolatedAudioModule();

  // 1. All valid themes must succeed and update activeTheme
  for (const theme of VALID_THEMES) {
    const ok = audio.setTheme(theme);
    assert(ok === true, `setTheme('${theme}') must return true`);
    assert(audio.getActiveTheme() === theme, `getActiveTheme() must be '${theme}'`);
  }

  // Set to known reference theme
  audio.setTheme('chozo-visor');
  const referenceTheme = audio.getActiveTheme();
  assert(referenceTheme === 'chozo-visor', `Reference theme setup failed`);

  // 2. Invalid string names must be rejected fail-closed
  const invalidThemeNames = [
    "",
    " ",
    "   ",
    "invalid-theme",
    "sonic-the-hedgehog",
    "genesis-model-1",
    "TOWER-OF-POWER",
    "Chozo-Visor",
    "wrx_telemetry",
    "hunter.base",
    "pacific outpost",
    "../tower-of-power",
    "../../etc/passwd",
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "tower-of-power\0",
    "\0chozo-visor",
    "\0",
    "A".repeat(1024),
    "B".repeat(65536)
  ];

  for (const inv of invalidThemeNames) {
    const res = audio.setTheme(inv);
    assert(res === false, `setTheme(${JSON.stringify(inv)}) must return false`);
    assert(audio.getActiveTheme() === referenceTheme, `getActiveTheme() must remain '${referenceTheme}' after invalid input`);
  }

  // 3. Prototype Pollution strings
  const protoKeys = [
    "__proto__",
    "constructor",
    "prototype",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "isPrototypeOf",
    "propertyIsEnumerable"
  ];

  for (const pKey of protoKeys) {
    const res = audio.setTheme(pKey);
    assert(res === false, `setTheme('${pKey}') prototype key must return false`);
    assert(audio.getActiveTheme() === referenceTheme, `getActiveTheme() must remain '${referenceTheme}'`);
  }

  // 4. Polluting Object.prototype directly
  Object.prototype['chozo-visor-fake'] = true;
  Object.prototype['evil-payload-theme'] = { active: true };
  const rejectedInjected = audio.setTheme('evil-payload-theme');
  assert(rejectedInjected === false, `Injected prototype theme must return false`);
  assert(audio.getActiveTheme() === referenceTheme, `getActiveTheme() must not switch to injected prototype property`);
  delete Object.prototype['chozo-visor-fake'];
  delete Object.prototype['evil-payload-theme'];

  // 5. Exotic non-string types
  const exoticInputs = [
    null, undefined, 0, 1, 42, -1, NaN, Infinity,
    true, false, {}, [], [ 'tower-of-power' ],
    { toString: () => 'tower-of-power' },
    Object.create(null),
    Symbol('tower-of-power')
  ];

  for (const ex of exoticInputs) {
    let res;
    let threw = false;
    try {
      res = audio.setTheme(ex);
    } catch (e) {
      threw = true;
      recordFinding('BUG', 'SET_THEME_EXOTIC_EXCEPTION', { error: e.message });
    }
    assert(!threw, `setTheme must not throw on exotic input`);
    assert(res === false, `setTheme must return false for non-matching input`);
    assert(audio.getActiveTheme() === referenceTheme, `Theme must remain '${referenceTheme}'`);
  }

  console.log(`Suite 2 completed: ${passedAssertions}/${totalAssertions} assertions passed.`);
}

// ==============================================================================
// SUITE 3: Missing Sound Card / Driver / AudioContext Simulation
// ==============================================================================
function runSuite3FailOpenSafety() {
  console.log('--- [Suite 3] Missing Sound Card / AudioContext Fail-Open Safety ---');

  // Scenario 3A: Headless environment with window.AudioContext = null
  {
    const { audio } = loadIsolatedAudioModule({
      hasWindow: true,
      AudioContextClass: null
    });

    assert(audio.initContext() === null, `initContext() without AudioContext class must return null`);
    assert(audio.getContextState() === 'uninitialized', `getContextState() must be 'uninitialized'`);
    assert(audio.isMuted() === true, `isMuted() must return true initially`);

    // Public methods must not throw
    let toggleThrew = false;
    try {
      const state = audio.toggleMute();
      assert(typeof state === 'boolean', `toggleMute() must return boolean`);
    } catch (e) {
      toggleThrew = true;
    }
    assert(!toggleThrew, `toggleMute() must fail-open without throwing`);

    let setVolThrew = false;
    try {
      const v = audio.setVolume(0.85);
      assert(v === 0.85, `setVolume without audio context must still update volume to 0.85`);
      assert(audio.getVolume() === 0.85, `getVolume() must be 0.85`);
    } catch (e) {
      setVolThrew = true;
    }
    assert(!setVolThrew, `setVolume must not throw when audio context is null`);

    let playSfxThrew = false;
    try {
      const sfxRes = audio.playSfx('switch');
      assert(sfxRes === false, `playSfx must return false when audio context is null`);
    } catch (e) {
      playSfxThrew = true;
    }
    assert(!playSfxThrew, `playSfx must not throw when audio context is null`);

    let playToneThrew = false;
    try {
      const toneRes = audio.playTone(440, 'sine', 0.1);
      assert(toneRes === null, `playTone must return null when audio context is null`);
    } catch (e) {
      playToneThrew = true;
    }
    assert(!playToneThrew, `playTone must not throw when audio context is null`);
  }

  // Scenario 3B: Hardware failure / Constructor throws NotAllowedError
  {
    const ThrowingContext = createMockAudioContextClass({
      throwOnConstruct: true,
      constructErrorName: 'NotAllowedError',
      constructErrorMessage: 'Hardware audio device initialization failed.'
    });

    const { audio } = loadIsolatedAudioModule({
      hasWindow: true,
      AudioContextClass: ThrowingContext
    });

    let initThrew = false;
    let res = null;
    try {
      res = audio.initContext();
    } catch (e) {
      initThrew = true;
    }
    assert(!initThrew, `initContext() must catch constructor throw gracefully`);
    assert(res === null, `initContext() must return null on constructor failure`);
    assert(audio.getContextState() === 'uninitialized', `getContextState() must remain uninitialized`);

    // Calling playSfx must return false without throw
    assert(audio.playSfx('click') === false, `playSfx('click') must return false on hardware failure`);
  }

  // Scenario 3C: Resume rejection
  {
    const RejectingContext = createMockAudioContextClass({
      rejectOnResume: true
    });

    const { audio } = loadIsolatedAudioModule({
      hasWindow: true,
      AudioContextClass: RejectingContext
    });

    let threw = false;
    try {
      audio.initContext();
    } catch (e) {
      threw = true;
    }
    assert(!threw, `initContext with rejecting resume() must not throw`);
  }

  console.log(`Suite 3 completed: ${passedAssertions}/${totalAssertions} assertions passed.`);
}

// ==============================================================================
// SUITE 4: playSfx & Acoustic Profiling Security Matrix
// ==============================================================================
function runSuite4PlaySfxSecurity() {
  console.log('--- [Suite 4] playSfx Prototype Pollution & Audio Engine Stress ---');

  const { audio, sandbox } = loadIsolatedAudioModule({
    AudioContextClass: createMockAudioContextClass(),
    initialSound: 'off'
  });

  // When muted, playSfx must always return false
  assert(audio.isMuted() === true, `Should start muted`);
  assert(audio.playSfx('switch') === false, `playSfx('switch') while muted must return false`);
  assert(audio.playSfx('hover') === false, `playSfx('hover') while muted must return false`);
  assert(audio.playSfx('click') === false, `playSfx('click') while muted must return false`);
  assert(audio.playSfx('special') === false, `playSfx('special') while muted must return false`);

  // Unmute and initialize
  audio.toggleMute();
  assert(audio.isMuted() === false, `Must be unmuted`);

  // Verify all 5 themes support all 4 standard sfx types
  const sfxTypes = ['switch', 'hover', 'click', 'special'];
  for (const theme of VALID_THEMES) {
    audio.setTheme(theme);
    for (const sfx of sfxTypes) {
      if (sandbox.window && sandbox.window.performance && sandbox.window.performance.advance) {
        sandbox.window.performance.advance(50); // advance past 25ms throttle
      }
      const played = audio.playSfx(sfx);
      assert(played === true, `Theme '${theme}' sfx '${sfx}' must return true when unmuted`);
    }
  }

  // Hover throttle stress: 20 rapid hover calls in same timestamp
  let hoverCount = 0;
  for (let i = 0; i < 20; i++) {
    if (audio.playSfx('hover')) {
      hoverCount++;
    }
  }
  // Due to the 25ms throttle without advancing time, subsequent rapid calls must be throttled
  assert(hoverCount === 1, `Rapid hover events must be throttled to 1 call, got ${hoverCount}`);

  // Invalid sfx types
  assert(audio.playSfx('nonexistent') === false, `playSfx('nonexistent') must return false`);
  assert(audio.playSfx('') === false, `playSfx('') must return false`);
  assert(audio.playSfx('turbo_boost') === false, `playSfx('turbo_boost') must return false`);

  // Prototype Pollution Check on playSfx
  // Check if toString / valueOf / constructor are treated as playable sfx
  const toStringPlayed = audio.playSfx('toString');
  const valueOfPlayed = audio.playSfx('valueOf');
  const constructorPlayed = audio.playSfx('constructor');

  if (toStringPlayed || valueOfPlayed || constructorPlayed) {
    recordFinding('BUG', 'PLAY_SFX_PROTOTYPE_METHOD_EXECUTION', {
      toStringPlayed,
      valueOfPlayed,
      constructorPlayed,
      explanation: "playSfx('toString') returned true because profile['toString'] is inherited from Object.prototype without hasOwnProperty check."
    });
    console.log(`  [OBSERVATION] playSfx('toString')=${toStringPlayed}, playSfx('valueOf')=${valueOfPlayed}, playSfx('constructor')=${constructorPlayed}`);
  }

  // Test Direct Prototype Pollution Injection
  let pollutedExecuted = false;
  Object.prototype.injectedAttackerSfx = function () {
    pollutedExecuted = true;
  };
  const injectedResult = audio.playSfx('injectedAttackerSfx');
  delete Object.prototype.injectedAttackerSfx;

  if (pollutedExecuted) {
    recordFinding('VULNERABILITY', 'PLAY_SFX_PROTOTYPE_POLLUTION_EXECUTION', {
      pollutedExecuted,
      injectedResult,
      explanation: "Object.prototype.injectedAttackerSfx was executed directly by playSfx('injectedAttackerSfx')."
    });
    console.log(`  [OBSERVATION] playSfx executed injected method on Object.prototype! (executed=${pollutedExecuted}, result=${injectedResult})`);
  }

  // Hostile input to playSfx: Object.create(null)
  let sfxCreateNullThrew = false;
  try {
    audio.playSfx(Object.create(null));
  } catch (e) {
    sfxCreateNullThrew = true;
    recordFinding('BUG', 'PLAY_SFX_OBJECT_CREATE_NULL_EXCEPTION', {
      error: e.message,
      stack: e.stack
    });
    console.log('  [OBSERVATION] audio.playSfx(Object.create(null)) threw TypeError: Cannot convert object to primitive value');
  }

  console.log(`Suite 4 completed: ${passedAssertions}/${totalAssertions} assertions passed.`);
}

// ==============================================================================
// SUITE 5: 1,000-Cycle Deterministic Randomized Stress Fuzzing (Mulberry32 PRNG)
// ==============================================================================
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function runSuite5RandomizedStressFuzzing() {
  console.log('--- [Suite 5] 1,000-Cycle Deterministic Randomized Stress Fuzzing ---');
  const rng = mulberry32(0xDEADBEEF);
  const { audio } = loadIsolatedAudioModule({
    AudioContextClass: createMockAudioContextClass()
  });

  // 1. 500 Randomized setVolume cycles
  for (let i = 0; i < 500; i++) {
    const roll = rng();
    let fuzzInput;
    if (roll < 0.2) {
      // Random float [-1000, 1000]
      fuzzInput = (rng() - 0.5) * 2000;
    } else if (roll < 0.4) {
      // Random string
      const chars = '0123456789.-+eE \t\n\0!@#abcdef';
      let s = '';
      const len = Math.floor(rng() * 12);
      for (let j = 0; j < len; j++) {
        s += chars[Math.floor(rng() * chars.length)];
      }
      fuzzInput = s;
    } else if (roll < 0.6) {
      // Exotic or edge numbers
      const specialNums = [
        0, 1, -0, -1, NaN, Infinity, -Infinity,
        Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER,
        Number.EPSILON, Number.MIN_VALUE, Number.MAX_VALUE
      ];
      fuzzInput = specialNums[Math.floor(rng() * specialNums.length)];
    } else if (roll < 0.8) {
      // Objects & Arrays
      const objGenerators = [
        {}, [], [rng()], [rng(), rng()],
        { valueOf: () => (rng() - 0.5) * 10 },
        { toString: () => String((rng() - 0.5) * 5) }
      ];
      fuzzInput = objGenerators[Math.floor(rng() * objGenerators.length)];
    } else {
      // Primitives
      const primitives = [null, undefined, true, false];
      fuzzInput = primitives[Math.floor(rng() * primitives.length)];
    }

    try {
      const volRes = audio.setVolume(fuzzInput);
      const currentVol = audio.getVolume();
      assert(
        typeof volRes === 'number' && !isNaN(volRes) && volRes >= 0.0 && volRes <= 1.0,
        `setVolume(${fuzzInput}) returned out-of-range or non-number: ${volRes}`
      );
      assert(
        typeof currentVol === 'number' && !isNaN(currentVol) && currentVol >= 0.0 && currentVol <= 1.0,
        `getVolume() out-of-range: ${currentVol}`
      );
      assert(volRes === currentVol, `setVolume return (${volRes}) != getVolume (${currentVol})`);
    } catch (err) {
      // If unhandled exception occurs, assert failure
      assert(false, `setVolume(${typeof fuzzInput}) threw unexpected error: ${err.message}`);
    }
  }

  // 2. 500 Randomized setTheme cycles
  for (let i = 0; i < 500; i++) {
    const roll = rng();
    let themeInput;
    if (roll < 0.3) {
      // One of the valid themes
      themeInput = VALID_THEMES[Math.floor(rng() * VALID_THEMES.length)];
    } else if (roll < 0.6) {
      // Random garbage string
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789-_/\\.<>:"\'';
      let s = '';
      const len = Math.floor(rng() * 20);
      for (let j = 0; j < len; j++) {
        s += chars[Math.floor(rng() * chars.length)];
      }
      themeInput = s;
    } else if (roll < 0.8) {
      // Prototype keys or permutations
      const protoKeys = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf'];
      themeInput = protoKeys[Math.floor(rng() * protoKeys.length)];
    } else {
      // Non-strings
      const exotics = [null, undefined, 42, -1, NaN, Infinity, true, false, {}, []];
      themeInput = exotics[Math.floor(rng() * exotics.length)];
    }

    const prevTheme = audio.getActiveTheme();
    let res;
    try {
      res = audio.setTheme(themeInput);
    } catch (err) {
      assert(false, `setTheme(${typeof themeInput}) threw unexpected error: ${err.message}`);
    }

    const newTheme = audio.getActiveTheme();
    assert(VALID_THEMES.indexOf(newTheme) !== -1, `Active theme escaped whitelist: '${newTheme}'`);

    if (VALID_THEMES.indexOf(themeInput) !== -1) {
      assert(res === true, `setTheme for valid theme '${themeInput}' returned false`);
      assert(newTheme === themeInput, `Active theme '${newTheme}' did not match set theme '${themeInput}'`);
    } else {
      assert(res === false, `setTheme for invalid input returned true`);
      assert(newTheme === prevTheme, `Active theme mutated on invalid input: was '${prevTheme}', became '${newTheme}'`);
    }
  }

  console.log(`Suite 5 completed: ${passedAssertions}/${totalAssertions} assertions passed.`);
}

// ==============================================================================
// MASTER EXECUTION & DOUBLE-RUN VERIFICATION
// ==============================================================================
function runAllSuites() {
  totalAssertions = 0;
  passedAssertions = 0;
  failedAssertions = 0;
  failures.length = 0;
  findings.length = 0;

  runSuite1VolumeFuzzing();
  runSuite2ThemeFuzzing();
  runSuite3FailOpenSafety();
  runSuite4PlaySfxSecurity();
  runSuite5RandomizedStressFuzzing();

  return {
    total: totalAssertions,
    passed: passedAssertions,
    failed: failedAssertions,
    failures: [...failures]
  };
}

console.log('==============================================================');
console.log(' CLOWNHOUSE.IO // Milestone M2 Audio Security Fuzz Harness   ');
console.log('==============================================================');
console.log('');

// Run 1
console.log('>>> EXECUTING RUN 1...');
const run1 = runAllSuites();
console.log('');

// Run 2 (Double-Run Parity Law)
console.log('>>> EXECUTING RUN 2 (Double-Run State Invariance Verification)...');
const run2 = runAllSuites();
console.log('');

console.log('==============================================================');
console.log(' DOUBLE-RUN PARITY RESULTS:');
console.log(` Run 1: Total=${run1.total}, Passed=${run1.passed}, Failed=${run1.failed}`);
console.log(` Run 2: Total=${run2.total}, Passed=${run2.passed}, Failed=${run2.failed}`);
console.log('==============================================================');

const bitForBit = (
  run1.total === run2.total &&
  run1.passed === run2.passed &&
  run1.failed === run2.failed &&
  JSON.stringify(run1.failures) === JSON.stringify(run2.failures)
);

console.log(`Double-Run Bit-for-Bit State Invariance: ${bitForBit ? 'CONFIRMED' : 'VIOLATION'}`);
console.log('');

if (run1.failures.length > 0) {
  console.log('==============================================================');
  console.log(` FAILED ASSERTIONS (${run1.failures.length}):`);
  console.log('==============================================================');
  run1.failures.forEach((f, i) => {
    console.log(`  [Failure ${i + 1}] ${f}`);
  });
  console.log('');
}

if (findings.length > 0) {
  console.log('==============================================================');
  console.log(` EMPIRICALLY CONFIRMED FINDINGS & ANOMALIES (${findings.length}):`);
  console.log('==============================================================');
  findings.forEach((f, i) => {
    console.log(`[Finding ${i + 1}] [${f.type}] ${f.name}`);
    console.log(`  Details: ${JSON.stringify(f.details, null, 2)}`);
  });
  console.log('');
}

if (run1.failed === 0 && bitForBit) {
  console.log('>>> ALL BASELINE ASSERTIONS PASSED');
  process.exit(0);
} else {
  console.log(`>>> HARNESS REPORTED ${run1.failed} ASSERTION FAILURES`);
  process.exit(1);
}

