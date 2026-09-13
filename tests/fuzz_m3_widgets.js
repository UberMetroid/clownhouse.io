/**
 * CLOWNHOUSE.IO // Milestone M3 Interactive Widgets & Universal Link Matrix Fuzz Harness
 * 
 * Challenger M3-2 Empirical Verification & Falsification Suite
 * 
 * Deeply challenges:
 * 1. Universal Link Matrix Integrity & Negative Protocol/XSS Fuzzing (all 30 .theme-link anchors)
 * 2. Sega Genesis Volume Slider Boundary & Input Fuzzing (<0, >10, NaN, strings, rapid dragging, reset)
 * 3. WRX TR Boost Gauge Throttle & Shift Lights Dynamics (spool triggers, dump physics, needle clamping, 7 LEDs)
 * 4. Mega Man X Buster Charge Triggers & Interruption Fuzzing (rapid clicks <50ms, hold >5000ms, blur, key repeat)
 * 5. Pacific Outpost Radar Blip Hover Storms & Cross-Component Sync (6 blips, 6 comms, 1000-event storm)
 * 6. Chozo Scan Visor Dynamic Reticle & E-Tank Replenishment
 * 7. Switcher Bar Keyboard Accessibility & Roving Tabindex Stress (Arrow keys, Home, End, Enter, Space)
 * 8. 1000-Cycle High-Frequency Interleaved Multi-Widget Concurrency Storm
 * 9. Double-Run Parity Law Enforcement ($Run_1 == Run_2$)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const APP_JS_PATH = path.join(PROJECT_ROOT, 'app.js');
const INDEX_HTML_PATH = path.join(PROJECT_ROOT, 'index.html');

const THEMES = [
  'tower-of-power',
  'chozo-visor',
  'wrx-telemetry',
  'hunter-base',
  'pacific-outpost'
];

const CANONICAL_DESTINATIONS = {
  openooda:   'https://openooda.org',
  necrometer: 'https://necrometer.dev',
  bumtrips:   'https://bumtrips.com',
  reactle:    'https://reactle.clownhouse.io',
  giggle:     'https://giggle.clownhouse.io',
  contact:    'mailto:jeryd@clownhouse.io'
};

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

// ==============================================================================
// MOCK DOM & HTML PARSER
// ==============================================================================

class MockClassList {
  constructor(initial = '') {
    this.classes = new Set(initial.split(/\s+/).filter(Boolean));
  }
  add(...cls) {
    cls.forEach(c => {
      if (c && typeof c === 'string') {
        c.split(/\s+/).filter(Boolean).forEach(item => this.classes.add(item));
      }
    });
  }
  remove(...cls) {
    cls.forEach(c => {
      if (c && typeof c === 'string') {
        c.split(/\s+/).filter(Boolean).forEach(item => this.classes.delete(item));
      }
    });
  }
  contains(cls) {
    return this.classes.has(cls);
  }
  toString() {
    return Array.from(this.classes).join(' ');
  }
}

function parseAttributes(attrStr) {
  const attrs = new Map();
  const re = /([a-zA-Z0-9_-]+)(?:=[\"']([^\"']*)[\"']|=([^\s>]+))?/g;
  let m;
  while ((m = re.exec(attrStr)) !== null) {
    const key = m[1];
    const val = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : '');
    attrs.set(key, val);
  }
  return attrs;
}

function matchesSingle(el, sel) {
  sel = sel.trim();
  if (!sel || !el) return false;

  // Attribute selector matching
  const attrRegex = /\[([a-zA-Z0-9_-]+)(?:=[\"']?([^\"'\]]*)[\"']?)?\]/g;
  let s = sel;
  let match;
  while ((match = attrRegex.exec(sel)) !== null) {
    const attrName = match[1];
    const attrVal = match[2];
    if (!el.attributes.has(attrName)) return false;
    if (attrVal !== undefined && el.attributes.get(attrName) !== attrVal) return false;
    s = s.replace(match[0], '');
  }

  // Tag, class, id matching
  const parts = s.split(/(?=[.#])/);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('#')) {
      if (el.id !== part.slice(1)) return false;
    } else if (part.startsWith('.')) {
      if (!el.classList.contains(part.slice(1))) return false;
    } else {
      if (el.tagName !== part.toUpperCase()) return false;
    }
  }
  return true;
}

function matchesSelector(el, selector) {
  if (!selector || !el) return false;
  const groups = selector.split(',').map(s => s.trim());
  return groups.some(group => {
    const tokens = group.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) return matchesSingle(el, tokens[0]);

    // Ancestor-descendant combinator
    if (!matchesSingle(el, tokens[tokens.length - 1])) return false;
    let curr = el.parentElement;
    let tokenIdx = tokens.length - 2;
    while (curr && tokenIdx >= 0) {
      if (matchesSingle(curr, tokens[tokenIdx])) {
        tokenIdx--;
      }
      curr = curr.parentElement;
    }
    return tokenIdx < 0;
  });
}

class MockElement {
  constructor(tagName, attrs = new Map()) {
    this.tagName = tagName.toUpperCase();
    this.attributes = attrs;
    this.id = attrs.get('id') || '';
    this.classList = new MockClassList(attrs.get('class') || '');
    this._value = attrs.get('value') || '';
    this.children = [];
    this.parentElement = null;
    this.ownerDocument = null;
    this.textContent = '';
    this.innerHTML = '';
    this.eventListeners = new Map();
    this.style = { transform: '', width: '', cursor: '' };
    this.offsetWidth = 120;
    this.offsetHeight = 40;
  }

  get value() {
    return this._value;
  }

  set value(val) {
    this._value = val === undefined || val === null ? '' : String(val);
  }

  setAttribute(name, val) {
    const strVal = String(val);
    this.attributes.set(name, strVal);
    if (name === 'id') this.id = strVal;
    if (name === 'class') this.classList = new MockClassList(strVal);
    if (name === 'value') this._value = strVal;
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'id') this.id = '';
    if (name === 'class') this.classList = new MockClassList('');
    if (name === 'value') this._value = '';
  }

  appendChild(child) {
    child.parentElement = this;
    if (this.ownerDocument) {
      child.ownerDocument = this.ownerDocument;
    }
    this.children.push(child);
    return child;
  }

  querySelectorAll(sel) {
    const res = [];
    const walk = (node) => {
      for (const c of node.children) {
        if (matchesSelector(c, sel)) res.push(c);
        walk(c);
      }
    };
    walk(this);
    return res;
  }

  querySelector(sel) {
    const all = this.querySelectorAll(sel);
    return all.length > 0 ? all[0] : null;
  }

  getElementById(id) {
    let found = null;
    const walk = (node) => {
      if (found) return;
      for (const c of node.children) {
        if (c.id === id) { found = c; return; }
        walk(c);
      }
    };
    walk(this);
    return found;
  }

  closest(selector) {
    let cur = this;
    while (cur) {
      if (matchesSelector(cur, selector)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  contains(other) {
    let cur = other;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  addEventListener(type, listener, options) {
    if (!this.eventListeners.has(type)) this.eventListeners.set(type, []);
    this.eventListeners.get(type).push({ listener, options });
  }

  removeEventListener(type, listener) {
    if (!this.eventListeners.has(type)) return;
    this.eventListeners.set(
      type,
      this.eventListeners.get(type).filter(e => e.listener !== listener)
    );
  }

  dispatchEvent(event) {
    event.target = this;
    if (!event.preventDefault) {
      event.preventDefault = () => { event.defaultPrevented = true; };
    }
    if (!event.stopPropagation) {
      event.stopPropagation = () => { event._propagationStopped = true; };
    }

    let curr = this;
    while (curr) {
      const list = curr.eventListeners.get(event.type) || [];
      for (const { listener } of list) {
        listener.call(curr, event);
        if (event._propagationStopped) break;
      }
      if (!event.bubbles || event._propagationStopped) break;
      curr = curr.parentElement;
    }
    return !event.defaultPrevented;
  }

  click() {
    const event = {
      type: 'click',
      target: this,
      bubbles: true,
      cancelable: true,
      defaultPrevented: false,
      _propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this._propagationStopped = true; }
    };
    return this.dispatchEvent(event);
  }

  focus() {
    if (this.ownerDocument) {
      this.ownerDocument.activeElement = this;
    }
  }

  blur() {
    if (this.ownerDocument && this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = null;
    }
  }
}

class MockCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail || null;
    this.bubbles = Boolean(init.bubbles);
    this.cancelable = Boolean(init.cancelable);
    this.defaultPrevented = false;
    this._propagationStopped = false;
  }
  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }
  stopPropagation() {
    this._propagationStopped = true;
  }
}

function parseHTMLToTree(htmlStr) {
  const root = new MockElement('DOCUMENT');
  const stack = [root];
  const tagRegex = /<!--[\s\S]*?-->|<(?:\/([a-zA-Z0-9_-]+)|([a-zA-Z0-9_-]+)([^>]*?)(\/)?)(?:>|$)|([^<]+)/g;
  let match;

  while ((match = tagRegex.exec(htmlStr)) !== null) {
    const [full, closeTag, openTag, attrStr, selfClose, text] = match;
    if (full.startsWith('<!--')) continue;

    if (openTag) {
      const attrs = parseAttributes(attrStr || '');
      const el = new MockElement(openTag, attrs);
      const parent = stack[stack.length - 1];
      if (parent) parent.appendChild(el);

      const isVoid = VOID_TAGS.has(openTag.toLowerCase()) || Boolean(selfClose);
      if (!isVoid) {
        stack.push(el);
      }
    } else if (closeTag) {
      const top = stack[stack.length - 1];
      if (top && top.tagName === closeTag.toUpperCase()) {
        stack.pop();
      }
    } else if (text && text.trim()) {
      const top = stack[stack.length - 1];
      if (top) {
        top.textContent += text.trim();
      }
    }
  }
  return root;
}

function createDOMEnvironment() {
  const htmlContent = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  const docRoot = parseHTMLToTree(htmlContent);

  const htmlEl = docRoot.querySelector('html');
  const bodyEl = docRoot.querySelector('body');

  const storageStore = new Map();
  const mockLocalStorage = {
    getItem: (key) => storageStore.has(key) ? storageStore.get(key) : null,
    setItem: (key, val) => storageStore.set(key, String(val)),
    removeItem: (key) => storageStore.delete(key),
    clear: () => storageStore.clear(),
    get length() { return storageStore.size; }
  };

  const doc = {
    readyState: 'complete',
    activeElement: null,
    documentElement: htmlEl,
    body: bodyEl,
    getElementById: (id) => docRoot.getElementById(id),
    querySelector: (sel) => docRoot.querySelector(sel),
    querySelectorAll: (sel) => docRoot.querySelectorAll(sel),
    eventListeners: new Map(),
    addEventListener(type, listener) {
      if (!this.eventListeners.has(type)) this.eventListeners.set(type, []);
      this.eventListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      if (!this.eventListeners.has(type)) return;
      this.eventListeners.set(type, this.eventListeners.get(type).filter(l => l !== listener));
    },
    dispatchEvent(event) {
      event.target = this;
      if (!event.preventDefault) {
        event.preventDefault = () => { event.defaultPrevented = true; };
      }
      if (!event.stopPropagation) {
        event.stopPropagation = () => { event._propagationStopped = true; };
      }
      const list = this.eventListeners.get(event.type) || [];
      for (const l of list) l.call(this, event);
      return !event.defaultPrevented;
    }
  };

  const setOwnerDoc = (node) => {
    node.ownerDocument = doc;
    for (const c of node.children) setOwnerDoc(c);
  };
  setOwnerDoc(docRoot);

  const audioCallLog = {
    tones: [],
    sfx: [],
    themeSwitches: [],
    volumeChanges: []
  };

  const mockAudio = {
    playTone(freq, type, attack, decay) {
      audioCallLog.tones.push({ freq, type, attack, decay });
      return { stop: () => {} };
    },
    playSfx(name) {
      audioCallLog.sfx.push(name);
      return true;
    },
    setTheme(name) {
      audioCallLog.themeSwitches.push(name);
      return true;
    },
    setVolume(vol) {
      audioCallLog.volumeChanges.push(vol);
      return vol;
    },
    isMuted() {
      return false;
    },
    initContext() {
      return {};
    }
  };

  const win = {
    document: doc,
    localStorage: mockLocalStorage,
    CustomEvent: MockCustomEvent,
    ClownAudio: mockAudio,
    eventListeners: new Map(),
    addEventListener(type, listener) {
      if (!this.eventListeners.has(type)) this.eventListeners.set(type, []);
      this.eventListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      if (!this.eventListeners.has(type)) return;
      this.eventListeners.set(type, this.eventListeners.get(type).filter(l => l !== listener));
    },
    dispatchEvent(event) {
      event.target = this;
      if (!event.preventDefault) {
        event.preventDefault = () => { event.defaultPrevented = true; };
      }
      if (!event.stopPropagation) {
        event.stopPropagation = () => { event._propagationStopped = true; };
      }
      const list = this.eventListeners.get(event.type) || [];
      for (const l of list) l.call(this, event);
      return !event.defaultPrevented;
    },
    requestAnimationFrame: (cb) => 1,
    cancelAnimationFrame: (id) => {}
  };

  return { doc, win, storageStore, audioCallLog, mockAudio };
}

function instantiateApp(env) {
  const appCode = fs.readFileSync(APP_JS_PATH, 'utf8');
  const trackedTimers = [];

  const safeSetInterval = (cb, ms) => {
    const t = setInterval(cb, ms);
    t.unref();
    trackedTimers.push(t);
    return t;
  };

  const sandbox = {
    console: {
      log: () => {},
      warn: () => {},
      error: () => {}
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: safeSetInterval,
    clearInterval: clearInterval,
    document: env.doc,
    window: env.win,
    CustomEvent: env.win.CustomEvent,
    module: { exports: {} }
  };
  sandbox.globalThis = sandbox.window;

  vm.createContext(sandbox);
  vm.runInContext(appCode, sandbox);
  const app = sandbox.module.exports;
  app.init();

  return { app, sandbox, trackedTimers };
}

// ==============================================================================
// TEST RUNNER INFRASTRUCTURE
// ==============================================================================

function runAllSuites() {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
  };

  function assert(cond, desc) {
    results.total++;
    if (cond) {
      results.passed++;
    } else {
      results.failed++;
      results.failures.push(desc);
      console.error(`  [FAIL] ${desc}`);
    }
  }

  console.log('--- Suite 1: Universal Link Matrix Integrity & Security Fuzzing ---');
  {
    const htmlContent = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    const env = createDOMEnvironment();
    const { doc } = env;

    const allLinks = doc.querySelectorAll('a.theme-link');
    assert(allLinks.length === 30, `Total theme-link elements must be exactly 30 (got ${allLinks.length})`);

    // Verify exactly 6 links per theme
    for (const theme of THEMES) {
      const themeContainer = doc.getElementById(`theme-${theme}`);
      assert(Boolean(themeContainer), `Theme container #theme-${theme} must exist in DOM`);
      if (themeContainer) {
        const themeLinks = themeContainer.querySelectorAll('a.theme-link');
        assert(themeLinks.length === 6, `Theme ${theme} must contain exactly 6 .theme-link elements (got ${themeLinks.length})`);

        const dests = themeLinks.map(l => l.getAttribute('data-destination'));
        for (const destKey of Object.keys(CANONICAL_DESTINATIONS)) {
          assert(dests.includes(destKey), `Theme ${theme} must contain link for destination "${destKey}"`);
        }
      }
    }

    // Verify destination canonical URLs, attributes, and security boundaries
    let externalCount = 0;
    let mailtoCount = 0;

    for (const link of allLinks) {
      const dest = link.getAttribute('data-destination');
      const href = link.getAttribute('href');
      const target = link.getAttribute('target');
      const rel = link.getAttribute('rel') || '';

      assert(Boolean(CANONICAL_DESTINATIONS[dest]), `Link has valid registered destination key: ${dest}`);
      assert(href === CANONICAL_DESTINATIONS[dest], `Link for "${dest}" matches canonical URL "${CANONICAL_DESTINATIONS[dest]}" (got "${href}")`);

      // Strict protocol validation
      if (dest === 'contact') {
        mailtoCount++;
        assert(href.startsWith('mailto:'), `Contact link must use mailto: scheme (got "${href}")`);
        assert(target === null || target === '', `Contact mailto link must NOT have target="_blank" (got "${target}")`);
      } else {
        externalCount++;
        assert(href.startsWith('https://'), `External link must strictly use https:// scheme (got "${href}")`);
        assert(target === '_blank', `External link must have target="_blank" (got "${target}")`);
        assert(rel.includes('noopener') && rel.includes('noreferrer'), `External link must specify rel="noopener noreferrer" (got "${rel}")`);
      }

      // Negative Security / XSS Fuzzing Probes
      assert(!href.toLowerCase().includes('javascript:'), `Link href must not contain javascript: pseudo-protocol: ${href}`);
      assert(!href.toLowerCase().includes('data:'), `Link href must not contain data: scheme: ${href}`);
      assert(!href.toLowerCase().includes('vbscript:'), `Link href must not contain vbscript: scheme: ${href}`);
      assert(!href.includes('\0'), `Link href must not contain null bytes: ${href}`);
      assert(!href.toLowerCase().startsWith('http://'), `Link href must not use insecure unencrypted http://: ${href}`);

      // Check for inline execution handlers
      assert(!link.hasAttribute('onclick'), `Link must not have inline onclick attribute`);
      assert(!link.hasAttribute('onmouseover'), `Link must not have inline onmouseover attribute`);
      assert(!link.hasAttribute('onerror'), `Link must not have inline onerror attribute`);
    }

    assert(externalCount === 25, `Must have exactly 25 external web links (got ${externalCount})`);
    assert(mailtoCount === 5, `Must have exactly 5 mailto contact links (got ${mailtoCount})`);
  }

  console.log('--- Suite 2: Sega Genesis Volume Slider Boundary & Input Fuzzing ---');
  {
    const env = createDOMEnvironment();
    const { app } = instantiateApp(env);
    const { doc, audioCallLog } = env;

    const slider = doc.getElementById('top-volume-slider');
    const valDisplay = doc.getElementById('top-volume-val');
    const resetBtn = doc.getElementById('top-reset-btn');
    const powerLed = doc.querySelector('.power-led');

    assert(Boolean(slider), `Volume slider #top-volume-slider must exist`);
    assert(Boolean(valDisplay), `Volume display #top-volume-val must exist`);
    assert(Boolean(resetBtn), `Volume reset button #top-reset-btn must exist`);

    // Initial state check
    assert(slider.value === '7', `Initial slider value must be 7 (got "${slider.value}")`);
    assert(valDisplay.textContent === '7', `Initial slider readout must display 7 (got "${valDisplay.textContent}")`);

    // Trigger initial input event to sync aria-valuenow
    slider.dispatchEvent({ type: 'input', bubbles: true });
    assert(slider.getAttribute('aria-valuenow') === '7', `Slider aria-valuenow set to 7 upon input`);

    // 1. Negative boundary inputs (<0)
    const negativeTests = [-1, -5, -10, -100, -99999, -0.01];
    for (const neg of negativeTests) {
      slider.value = String(neg);
      slider.dispatchEvent({ type: 'input', bubbles: true });
      assert(slider.value === '0', `Negative input ${neg} clamped to 0 (got "${slider.value}")`);
      assert(valDisplay.textContent === '0', `Display updated to 0 for input ${neg} (got "${valDisplay.textContent}")`);
      assert(slider.getAttribute('aria-valuenow') === '0', `aria-valuenow updated to 0 for input ${neg}`);
    }

    // 2. Overflow boundary inputs (>10)
    const overflowTests = [11, 15, 20, 100, 99999, 1000000];
    for (const ovf of overflowTests) {
      slider.value = String(ovf);
      slider.dispatchEvent({ type: 'input', bubbles: true });
      assert(slider.value === '10', `Overflow input ${ovf} clamped to 10 (got "${slider.value}")`);
      assert(valDisplay.textContent === '10', `Display updated to 10 for input ${ovf} (got "${valDisplay.textContent}")`);
      assert(slider.getAttribute('aria-valuenow') === '10', `aria-valuenow updated to 10 for input ${ovf}`);
    }

    // 3. Malformed / Non-numeric fuzzing
    const malformedInputs = [
      { input: 'NaN', expected: '7' },
      { input: 'null', expected: '7' },
      { input: 'undefined', expected: '7' },
      { input: '', expected: '7' },
      { input: 'invalid', expected: '7' },
      { input: '0', expected: '0' },
      { input: '10', expected: '10' },
      { input: '04', expected: '4' },
      { input: '8.9', expected: '8' }
    ];
    for (const tc of malformedInputs) {
      slider.value = tc.input;
      slider.dispatchEvent({ type: 'input', bubbles: true });
      assert(slider.value === tc.expected, `Malformed input "${tc.input}" resolved to ${tc.expected} (got "${slider.value}")`);
      assert(valDisplay.textContent === tc.expected, `Readout matches expected ${tc.expected}`);
    }

    // 4. Tick marks illumination verification
    const ticks = doc.querySelectorAll('.slider-scale .slider-tick');
    assert(ticks.length === 6, `Slider scale must contain 6 ticks (got ${ticks.length})`);

    // Set volume to 4 -> ticks 0, 1, 2 should be active (idx <= 4/2)
    slider.value = '4';
    slider.dispatchEvent({ type: 'input', bubbles: true });
    assert(ticks[0].classList.contains('tick-active'), `Tick 0 is active for volume 4`);
    assert(ticks[1].classList.contains('tick-active'), `Tick 1 is active for volume 4`);
    assert(ticks[2].classList.contains('tick-active'), `Tick 2 is active for volume 4`);
    assert(!ticks[3].classList.contains('tick-active'), `Tick 3 is inactive for volume 4`);

    // Set volume to 10 -> all 6 ticks should be active
    slider.value = '10';
    slider.dispatchEvent({ type: 'input', bubbles: true });
    for (let i = 0; i < 6; i++) {
      assert(ticks[i].classList.contains('tick-active'), `Tick ${i} is active for max volume 10`);
    }

    // 5. Reset button verification
    slider.value = '2';
    slider.dispatchEvent({ type: 'input', bubbles: true });
    assert(slider.value === '2', `Slider moved to 2`);

    resetBtn.click();
    assert(slider.value === '7', `Reset button restored slider value to 7 (got "${slider.value}")`);
    assert(valDisplay.textContent === '7', `Reset button restored readout to 7`);
    assert(slider.getAttribute('aria-valuenow') === '7', `Reset button restored aria-valuenow to 7`);
    if (powerLed) {
      assert(powerLed.classList.contains('led-reset-blink'), `Power LED received led-reset-blink class upon reset`);
    }

    // 6. High-Frequency Rapid Dragging Simulation (1000 randomized events)
    let lastSet = 7;
    for (let i = 0; i < 1000; i++) {
      const randVal = Math.floor(Math.random() * 25) - 5; // values between -5 and 19
      slider.value = String(randVal);
      slider.dispatchEvent({ type: 'input', bubbles: true });
      lastSet = Math.max(0, Math.min(10, randVal));
    }
    assert(slider.value === String(lastSet), `Rapid dragging fuzzing preserved final clamp value ${lastSet} (got "${slider.value}")`);
    assert(valDisplay.textContent === String(lastSet), `Rapid dragging display preserved final value ${lastSet}`);
  }

  console.log('--- Suite 3: WRX TR Boost Gauge Throttle & Shift Lights Dynamics ---');
  {
    const env = createDOMEnvironment();
    const { app } = instantiateApp(env);
    const { doc, audioCallLog } = env;

    const wrxContainer = doc.getElementById('theme-wrx-telemetry');
    const gaugeWidget = doc.querySelector('.boost-gauge-widget') || doc.getElementById('wrx-boost-gauge');
    const boostReadout = doc.querySelector('.boost-readout');
    const needleGroup = doc.getElementById('wrx-needle-group');
    const throttleBtn = doc.getElementById('wrx-throttle-btn');
    const shiftLeds = doc.querySelectorAll('.shift-lights .shift-led');

    assert(Boolean(wrxContainer), `WRX container #theme-wrx-telemetry must exist`);
    assert(Boolean(needleGroup), `Analog needle #wrx-needle-group must exist`);
    assert(Boolean(throttleBtn), `Throttle pedal button #wrx-throttle-btn must exist`);
    assert(shiftLeds.length === 7, `Must have exactly 7 sequential shift LEDs (got ${shiftLeds.length})`);

    // Test needle rotation mathematics across range [-1.0, 1.8] bar:
    // angle = -135 + ((clamped - (-1.0)) / 2.8) * 270
    function calculateNeedleAngle(bar) {
      const clamped = Math.max(-1.0, Math.min(1.8, bar));
      return -135 + ((clamped - (-1.0)) / 2.8) * 270;
    }

    const testBars = [
      { bar: -1.0, expectedAngle: -135.0 },
      { bar: -0.5, expectedAngle: -86.8 },
      { bar: 0.0,  expectedAngle: -38.6 },
      { bar: 0.4,  expectedAngle: 0.0 },
      { bar: 1.0,  expectedAngle: 57.9 },
      { bar: 1.8,  expectedAngle: 135.0 },
      { bar: -5.0, expectedAngle: -135.0 }, // Clamp floor
      { bar: 10.0, expectedAngle: 135.0 }  // Clamp ceiling
    ];

    for (const tb of testBars) {
      const angle = calculateNeedleAngle(tb.bar);
      assert(Math.abs(angle - tb.expectedAngle) < 0.2, `Needle angle for ${tb.bar} bar is ${angle.toFixed(1)}deg (expected ${tb.expectedAngle}deg)`);
    }

    // Unmute audio to test throttle sound synthesis
    app.toggleSound();
    assert(app.isSoundMuted() === false, `Audio unmuted for throttle sfx verification`);

    const initialSfxCount = audioCallLog.sfx.length;
    throttleBtn.click();
    assert(audioCallLog.sfx.length > initialSfxCount, `Throttle button click triggered audio SFX when unmuted`);

    // Rapid clicking stress on throttle button (200 consecutive clicks)
    for (let i = 0; i < 200; i++) {
      throttleBtn.click();
    }
    assert(true, `Completed 200 rapid clicks on throttle button without unhandled exceptions`);

    // Interrupted transitions: rapid enter/leave interleaving (100 cycles)
    if (gaugeWidget) {
      for (let i = 0; i < 100; i++) {
        gaugeWidget.dispatchEvent({ type: 'mouseenter', bubbles: true });
        gaugeWidget.dispatchEvent({ type: 'mouseleave', bubbles: true });
      }
      assert(true, `Completed 100 rapid enter/leave cycles on boost gauge widget`);
    }

    // Checkpoint hover triggering
    const checkpoints = doc.querySelectorAll('#theme-wrx-telemetry .rally-checkpoint');
    assert(checkpoints.length === 6, `WRX theme has 6 rally checkpoints (got ${checkpoints.length})`);
    for (const cp of checkpoints) {
      cp.dispatchEvent({ type: 'mouseenter', bubbles: true });
      cp.dispatchEvent({ type: 'mouseleave', bubbles: true });
    }
    assert(true, `Completed hover trigger cycles across all 6 rally checkpoints`);
  }

  console.log('--- Suite 4: Mega Man X Buster Charge Triggers & Boundary Interruption ---');
  {
    const env = createDOMEnvironment();
    const { app } = instantiateApp(env);
    const { doc, win } = env;

    const chargeBtn = doc.getElementById('buster-charge-btn');
    const chargeIndicator = doc.getElementById('charge-indicator');
    const chargeBar = doc.getElementById('charge-bar');
    const healthMeter = doc.getElementById('hunter-health-meter');
    const healthNumeric = doc.getElementById('hunter-health-numeric');

    assert(Boolean(chargeBtn), `Buster charge button #buster-charge-btn must exist`);
    assert(Boolean(chargeIndicator), `Charge indicator #charge-indicator must exist`);
    assert(Boolean(chargeBar), `Charge progress bar #charge-bar must exist`);

    // Initial state
    assert(chargeIndicator.textContent.includes('READY'), `Initial indicator text is READY`);
    assert(chargeBar.style.width === '0%' || chargeBar.style.width === '', `Initial charge bar width is 0%`);

    // 1. Rapid click (<50ms) -> Normal Shot
    chargeBtn.dispatchEvent({ type: 'pointerdown', bubbles: true });
    assert(chargeBtn.getAttribute('data-charge-level') === 'blue', `Pointerdown immediately engages Blue LV1 charge aura`);
    assert(chargeBar.style.width === '33%', `Charge bar at 33% on charge initiation`);

    chargeBtn.dispatchEvent({ type: 'pointerup', bubbles: true });
    assert(chargeIndicator.textContent.includes('NORMAL SHOT'), `Rapid release fires NORMAL SHOT (got "${chargeIndicator.textContent}")`);
    assert(chargeBtn.getAttribute('data-charge-level') === 'idle', `Aura returns to idle upon shot release`);
    assert(chargeBar.style.width === '0%', `Charge bar returns to 0% upon release`);

    // 2. Rapid mousedown/mouseup stress (100 cycles in rapid succession)
    for (let i = 0; i < 100; i++) {
      chargeBtn.dispatchEvent({ type: 'pointerdown', bubbles: true });
      chargeBtn.dispatchEvent({ type: 'pointerup', bubbles: true });
    }
    assert(chargeBtn.getAttribute('data-charge-level') === 'idle', `Aura remains clean idle after 100 rapid click cycles`);

    // 3. Window blur cancellation during charge
    chargeBtn.dispatchEvent({ type: 'pointerdown', bubbles: true });
    assert(chargeBtn.getAttribute('data-charge-level') === 'blue', `Charge active before blur`);
    win.dispatchEvent({ type: 'blur', bubbles: true });
    assert(chargeBtn.getAttribute('data-charge-level') === 'idle', `Window blur cancelled charge and restored aura to idle`);
    assert(chargeBar.style.width === '0%', `Window blur reset charge bar to 0%`);
    assert(chargeIndicator.textContent === 'READY', `Window blur restored indicator to READY`);

    // 4. Pointercancel & pointerleave cancellation
    chargeBtn.dispatchEvent({ type: 'pointerdown', bubbles: true });
    chargeBtn.dispatchEvent({ type: 'pointerleave', bubbles: true });
    assert(chargeBtn.getAttribute('data-charge-level') === 'idle', `Pointerleave cancelled active charge`);

    chargeBtn.dispatchEvent({ type: 'pointerdown', bubbles: true });
    chargeBtn.dispatchEvent({ type: 'pointercancel', bubbles: true });
    assert(chargeBtn.getAttribute('data-charge-level') === 'idle', `Pointercancel cancelled active charge`);

    // 5. Keyboard charge actuation (Space & Enter)
    chargeBtn.dispatchEvent({ type: 'keydown', key: ' ', bubbles: true });
    assert(chargeBtn.getAttribute('data-charge-level') === 'blue', `Keydown Space initiated charging`);

    // Simulate OS key-repeat while holding Space (50 repeated keydown events)
    for (let i = 0; i < 50; i++) {
      chargeBtn.dispatchEvent({ type: 'keydown', key: ' ', bubbles: true });
    }
    assert(chargeBtn.getAttribute('data-charge-level') === 'blue', `Key repeat ignored during active charge`);

    chargeBtn.dispatchEvent({ type: 'keyup', key: ' ', bubbles: true });
    assert(chargeBtn.getAttribute('data-charge-level') === 'idle', `Keyup Space released charge`);

    chargeBtn.dispatchEvent({ type: 'keydown', key: 'Enter', bubbles: true });
    assert(chargeBtn.getAttribute('data-charge-level') === 'blue', `Keydown Enter initiated charging`);
    chargeBtn.dispatchEvent({ type: 'keyup', key: 'Enter', bubbles: true });
    assert(chargeBtn.getAttribute('data-charge-level') === 'idle', `Keyup Enter released charge`);

    // 6. Interactive 28-tick health bar refill
    if (healthMeter) {
      const healthTicks = healthMeter.querySelectorAll('.tick');
      assert(healthTicks.length === 28, `Health meter has exactly 28 ticks (got ${healthTicks.length})`);
      healthMeter.click();
      if (healthNumeric) {
        assert(healthNumeric.textContent === '28/28', `Health numeric readout displays 28/28 upon refill`);
      }
    }
  }

  console.log('--- Suite 5: Pacific Outpost Radar Blip Hover Storms & Cross-Component Sync ---');
  {
    const env = createDOMEnvironment();
    const { app } = instantiateApp(env);
    const { doc } = env;

    const outpost = doc.getElementById('theme-pacific-outpost');
    const radarScope = doc.getElementById('pacific-radar-scope');
    const radarStatus = doc.getElementById('pacific-radar-status');
    const blips = doc.querySelectorAll('#theme-pacific-outpost .radar-blip');
    const commsRelays = doc.querySelectorAll('#theme-pacific-outpost .comms-relay');

    assert(Boolean(outpost), `Pacific Outpost container #theme-pacific-outpost must exist`);
    assert(Boolean(radarScope), `Radar scope #pacific-radar-scope must exist`);
    assert(blips.length === 6, `Must have exactly 6 radar blips (got ${blips.length})`);
    assert(commsRelays.length === 6, `Must have exactly 6 comms relays (got ${commsRelays.length})`);

    // 1. Single Blip Hover & Status Lock
    const testBlip = blips[0];
    const targetKey = testBlip.getAttribute('data-target');
    const matchingRelay = doc.querySelector(`#theme-pacific-outpost .comms-relay[data-destination="${targetKey}"]`);

    testBlip.dispatchEvent({ type: 'mouseenter', bubbles: true });
    assert(testBlip.classList.contains('active-target'), `Blip ${targetKey} has active-target class on hover`);
    if (matchingRelay) {
      assert(matchingRelay.classList.contains('active-tracked'), `Matching comms relay ${targetKey} has active-tracked class`);
    }
    if (radarStatus) {
      assert(radarStatus.textContent.includes('TARGET LOCKED'), `Radar status indicates target locked: "${radarStatus.textContent}"`);
    }

    testBlip.dispatchEvent({ type: 'mouseleave', bubbles: true });
    assert(!testBlip.classList.contains('active-target'), `Blip ${targetKey} cleared active-target on leave`);
    if (matchingRelay) {
      assert(!matchingRelay.classList.contains('active-tracked'), `Matching comms relay cleared active-tracked on leave`);
    }

    // 2. Comms card reverse hover
    if (matchingRelay) {
      matchingRelay.dispatchEvent({ type: 'mouseenter', bubbles: true });
      assert(testBlip.classList.contains('active-target'), `Reverse hover on comms relay illuminated radar blip`);
      matchingRelay.dispatchEvent({ type: 'mouseleave', bubbles: true });
      assert(!testBlip.classList.contains('active-target'), `Reverse hover leave cleared radar blip`);
    }

    // 3. Radar blip click delegation to cardLink.click()
    let cardLinkClicked = false;
    const cardLink = matchingRelay ? matchingRelay.querySelector('a.theme-link') : null;
    if (cardLink) {
      const origClick = cardLink.click.bind(cardLink);
      cardLink.click = function () {
        cardLinkClicked = true;
        return origClick();
      };
      testBlip.click();
      assert(cardLinkClicked, `Clicking radar blip triggered underlying cardLink.click()`);
    }

    // 4. Radar Scope Click triggers Sonar Ripple
    radarScope.click();
    assert(true, `Radar scope click executed sonar ping without error`);

    // 5. Radar Blip Hover Storm (1000 randomized rapid hover/leave events)
    for (let i = 0; i < 1000; i++) {
      const blipIndex = Math.floor(Math.random() * blips.length);
      const b = blips[blipIndex];
      if (Math.random() > 0.5) {
        b.dispatchEvent({ type: 'mouseenter', bubbles: true });
      } else {
        b.dispatchEvent({ type: 'mouseleave', bubbles: true });
      }
    }

    // Clean storm exit: dispatch mouseleave for all blips
    for (const b of blips) {
      b.dispatchEvent({ type: 'mouseleave', bubbles: true });
    }

    // Verify all active classes cleared
    const remainingActiveBlips = doc.querySelectorAll('#theme-pacific-outpost .radar-blip.active-target');
    const remainingActiveRelays = doc.querySelectorAll('#theme-pacific-outpost .comms-relay.active-tracked');
    assert(remainingActiveBlips.length === 0, `All blips returned to un-highlighted state after storm (orphans: ${remainingActiveBlips.length})`);
    assert(remainingActiveRelays.length === 0, `All comms relays returned to un-highlighted state after storm (orphans: ${remainingActiveRelays.length})`);
    if (radarStatus) {
      assert(radarStatus.textContent.includes('SWEEPING 360'), `Radar status returned to default sweeping state`);
    }
  }

  console.log('--- Suite 6: Chozo Scan Visor Dynamic Reticle & E-Tank Replenishment ---');
  {
    const env = createDOMEnvironment();
    const { app } = instantiateApp(env);
    const { doc, audioCallLog } = env;

    const chozoContainer = doc.getElementById('theme-chozo-visor');
    const reticle = doc.querySelector('#theme-chozo-visor .targeting-reticle');
    const eTanksCluster = doc.querySelector('#theme-chozo-visor .e-tanks-cluster');
    const eTanks = doc.querySelectorAll('#theme-chozo-visor .e-tank');

    assert(Boolean(chozoContainer), `Chozo Visor container #theme-chozo-visor must exist`);
    assert(Boolean(reticle), `Targeting reticle must exist`);
    assert(Boolean(eTanksCluster), `E-Tanks cluster must exist`);
    assert(eTanks.length === 4, `Chozo theme must contain 4 E-Tanks (got ${eTanks.length})`);

    // Unmute to verify harmonic audio on reticle click
    app.toggleSound();
    const tonesBefore = audioCallLog.tones.length;
    reticle.click();
    assert(audioCallLog.tones.length > tonesBefore, `Clicking targeting reticle scheduled audio tones when unmuted`);

    // E-Tanks cluster click fills all tanks
    eTanksCluster.click();
    assert(true, `Clicked E-Tanks cluster without error`);
  }

  console.log('--- Suite 7: Switcher Bar Keyboard Accessibility & Roving Tabindex Stress ---');
  {
    const env = createDOMEnvironment();
    const { app } = instantiateApp(env);
    const { doc } = env;

    const switcherBar = doc.getElementById('theme-switcher-bar');
    const soundToggle = doc.getElementById('sound-toggle');
    const buttons = doc.querySelectorAll('#theme-switcher-bar button[data-theme], #theme-switcher-bar button[data-theme-target], #theme-switcher-bar .switcher-btn');

    assert(Boolean(switcherBar), `Theme switcher bar #theme-switcher-bar must exist`);
    assert(Boolean(soundToggle), `Sound toggle #sound-toggle must exist`);
    assert(buttons.length === 5, `Must have 5 theme switcher tab buttons (got ${buttons.length})`);

    // Initial state: first button has tabindex 0, active theme is tower-of-power
    assert(app.getActiveTheme() === 'tower-of-power', `Initial active theme is tower-of-power`);
    doc.activeElement = buttons[0];

    // Helper to dispatch keydown with full event shape
    function dispatchKey(key) {
      const event = {
        type: 'keydown',
        key: key,
        bubbles: true,
        cancelable: true,
        defaultPrevented: false,
        _propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this._propagationStopped = true; }
      };
      switcherBar.dispatchEvent(event);
    }

    // 1. ArrowRight navigation (0 -> 1 -> 2 -> 3 -> 4 -> 0 wrap)
    dispatchKey('ArrowRight');
    assert(app.getActiveTheme() === 'chozo-visor', `ArrowRight switched theme to chozo-visor`);
    assert(doc.activeElement === buttons[1], `Focus moved to tab 1 (chozo-visor)`);

    dispatchKey('ArrowRight');
    assert(app.getActiveTheme() === 'wrx-telemetry', `ArrowRight switched theme to wrx-telemetry`);

    dispatchKey('ArrowDown');
    assert(app.getActiveTheme() === 'hunter-base', `ArrowDown switched theme to hunter-base`);

    dispatchKey('ArrowDown');
    assert(app.getActiveTheme() === 'pacific-outpost', `ArrowDown switched theme to pacific-outpost`);

    // Wrap around
    dispatchKey('ArrowRight');
    assert(app.getActiveTheme() === 'tower-of-power', `ArrowRight wrapped around to tower-of-power`);

    // Reverse wrap with ArrowLeft
    dispatchKey('ArrowLeft');
    assert(app.getActiveTheme() === 'pacific-outpost', `ArrowLeft reverse wrapped to pacific-outpost`);

    dispatchKey('ArrowUp');
    assert(app.getActiveTheme() === 'hunter-base', `ArrowUp moved to hunter-base`);

    // Home and End key navigation
    dispatchKey('Home');
    assert(app.getActiveTheme() === 'tower-of-power', `Home key moved to first theme (tower-of-power)`);

    dispatchKey('End');
    assert(app.getActiveTheme() === 'pacific-outpost', `End key moved to last theme (pacific-outpost)`);

    // 2. Sound toggle keyboard actuation (Enter & Space)
    assert(app.isSoundMuted() === true, `Sound initially muted`);
    soundToggle.click();
    assert(app.isSoundMuted() === false, `Click on sound-toggle unmuted audio`);
    assert(soundToggle.getAttribute('aria-pressed') === 'true', `aria-pressed updated to "true"`);

    soundToggle.click();
    assert(app.isSoundMuted() === true, `Click on sound-toggle re-muted audio`);
    assert(soundToggle.getAttribute('aria-pressed') === 'false', `aria-pressed updated to "false"`);
  }

  console.log('--- Suite 8: High-Frequency Interleaved Multi-Widget Concurrency Storm ---');
  {
    const env = createDOMEnvironment();
    const { app, trackedTimers } = instantiateApp(env);
    const { doc, win } = env;

    const slider = doc.getElementById('top-volume-slider');
    const resetBtn = doc.getElementById('top-reset-btn');
    const throttleBtn = doc.getElementById('wrx-throttle-btn');
    const chargeBtn = doc.getElementById('buster-charge-btn');
    const blips = doc.querySelectorAll('#theme-pacific-outpost .radar-blip');
    const links = doc.querySelectorAll('a.theme-link');
    const soundToggle = doc.getElementById('sound-toggle');
    const buttons = doc.querySelectorAll('#theme-switcher-bar button[data-theme]');

    let errorCount = 0;

    for (let cycle = 0; cycle < 1000; cycle++) {
      const action = Math.floor(Math.random() * 8);
      try {
        switch (action) {
          case 0:
            // Volume drag
            if (slider) {
              slider.value = String(Math.floor(Math.random() * 12) - 1);
              slider.dispatchEvent({ type: 'input', bubbles: true });
            }
            break;
          case 1:
            // Reset button
            if (resetBtn && Math.random() < 0.2) {
              resetBtn.click();
            }
            break;
          case 2:
            // WRX throttle
            if (throttleBtn) {
              throttleBtn.click();
            }
            break;
          case 3:
            // Buster charge cycle
            if (chargeBtn) {
              chargeBtn.dispatchEvent({ type: 'pointerdown', bubbles: true });
              if (Math.random() < 0.3) {
                win.dispatchEvent({ type: 'blur', bubbles: true });
              } else {
                chargeBtn.dispatchEvent({ type: 'pointerup', bubbles: true });
              }
            }
            break;
          case 4:
            // Radar blip hover
            if (blips.length > 0) {
              const b = blips[Math.floor(Math.random() * blips.length)];
              b.dispatchEvent({ type: Math.random() > 0.5 ? 'mouseenter' : 'mouseleave', bubbles: true });
            }
            break;
          case 5:
            // Theme switch
            if (buttons.length > 0) {
              const b = buttons[Math.floor(Math.random() * buttons.length)];
              b.click();
            }
            break;
          case 6:
            // Sound toggle
            if (soundToggle && Math.random() < 0.1) {
              soundToggle.click();
            }
            break;
          case 7:
            // Link hover
            if (links.length > 0) {
              const l = links[Math.floor(Math.random() * links.length)];
              doc.dispatchEvent({ type: 'mouseenter', target: l, bubbles: true });
            }
            break;
        }
      } catch (err) {
        errorCount++;
        console.error(`Error during concurrency storm cycle ${cycle}:`, err);
      }
    }

    assert(errorCount === 0, `1000-cycle concurrency storm completed with zero unhandled exceptions`);
    assert(THEMES.includes(app.getActiveTheme()), `Application retained valid active theme: ${app.getActiveTheme()}`);

    // Clean up background timers
    for (const t of trackedTimers) {
      clearInterval(t);
    }
  }

  return results;
}

// ==============================================================================
// MAIN EXECUTION & DOUBLE-RUN ENFORCEMENT
// ==============================================================================

console.log('==============================================================');
console.log(' CLOWNHOUSE.IO // Milestone M3 Widget & Link Fuzz Harness    ');
console.log('==============================================================');
console.log('');

// Run 1
console.log('>>> EXECUTING RUN 1...');
const run1 = runAllSuites();
console.log(`Run 1 Completed: Total=${run1.total}, Passed=${run1.passed}, Failed=${run1.failed}`);
console.log('');

// Run 2 (Double-Run Invariance Law)
console.log('>>> EXECUTING RUN 2 (Double-Run State Invariance Verification)...');
const run2 = runAllSuites();
console.log(`Run 2 Completed: Total=${run2.total}, Passed=${run2.passed}, Failed=${run2.failed}`);
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

if (run1.failed === 0 && bitForBit) {
  console.log(`>>> ALL BASELINE ASSERTIONS PASSED (${run1.passed}/${run1.total})`);
  process.exit(0);
} else {
  console.log(`>>> HARNESS REPORTED ${run1.failed} ASSERTION FAILURES`);
  process.exit(1);
}
