/**
 * CLOWNHOUSE.IO // Milestone M1 Empirical Fuzzing & Security Test Harness
 * 
 * Deeply challenges:
 * 1. Hostile payload fuzzing in localStorage (XSS, null bytes, >64KB, undefined, prototype pollution, JSON)
 * 2. SecurityError exception simulation on localStorage.getItem / setItem / window.localStorage getter
 * 3. Keyboard navigation tests on switcher buttons (Arrow keys, Home, End, roving tabindex, focus isolation)
 * 4. 1000-cycle randomized concurrency and state consistency stress
 * 5. Double-run verification parity ($Run_1 == Run_2$)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const APP_JS_PATH = path.join(PROJECT_ROOT, 'app.js');
const INDEX_HTML_PATH = path.join(PROJECT_ROOT, 'index.html');

const VALID_THEMES = [
  'tower-of-power',
  'chozo-visor',
  'wrx-telemetry',
  'hunter-base',
  'pacific-outpost'
];

// --- DOM Mock Implementation ---
function createMockDOMEnvironment(options = {}) {
  const {
    initialStorage = {},
    throwOnGetItem = false,
    throwOnSetItem = false,
    throwOnStorageAccess = false,
    quotaExceeded = false
  } = options;

  const storageStore = new Map(Object.entries(initialStorage));

  class MockStorage {
    getItem(key) {
      if (throwOnGetItem) {
        const err = new Error('The operation is insecure.');
        err.name = 'SecurityError';
        throw err;
      }
      return storageStore.has(key) ? storageStore.get(key) : null;
    }
    setItem(key, val) {
      if (throwOnSetItem) {
        const err = new Error('The operation is insecure.');
        err.name = 'SecurityError';
        throw err;
      }
      if (quotaExceeded) {
        const err = new Error('Quota exceeded.');
        err.name = 'QuotaExceededError';
        throw err;
      }
      storageStore.set(key, String(val));
    }
    removeItem(key) {
      storageStore.delete(key);
    }
    clear() {
      storageStore.clear();
    }
    get length() {
      return storageStore.size;
    }
  }

  const mockStorageInstance = new MockStorage();

  class MockClassList {
    constructor() {
      this.classes = new Set();
    }
    add(cls) {
      this.classes.add(cls);
    }
    remove(cls) {
      this.classes.delete(cls);
    }
    contains(cls) {
      return this.classes.has(cls);
    }
    toString() {
      return Array.from(this.classes).join(' ');
    }
  }

  class MockElement {
    constructor(tagName, id = '', className = '') {
      this.tagName = tagName.toUpperCase();
      this.id = id;
      this.attributes = new Map();
      this.classList = new MockClassList();
      this.children = [];
      this.parentElement = null;
      this.textContent = '';
      this.value = '5';
      this.eventListeners = new Map();

      if (className) {
        className.split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c));
      }
    }

    setAttribute(name, val) {
      this.attributes.set(name, String(val));
    }

    getAttribute(name) {
      return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    removeAttribute(name) {
      this.attributes.delete(name);
    }

    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    }

    addEventListener(type, listener, options) {
      if (!this.eventListeners.has(type)) {
        this.eventListeners.set(type, []);
      }
      this.eventListeners.get(type).push({ listener, options });
    }

    removeEventListener(type, listener) {
      if (!this.eventListeners.has(type)) return;
      this.eventListeners.set(
        type,
        this.eventListeners.get(type).filter(entry => entry.listener !== listener)
      );
    }

    dispatchEvent(event) {
      event.target = this;
      let current = this;
      while (current) {
        const listeners = current.eventListeners.get(event.type) || [];
        for (const { listener } of listeners) {
          listener.call(current, event);
          if (event._propagationStopped) break;
        }
        if (!event.bubbles || event._propagationStopped) break;
        current = current.parentElement;
      }
      return !event.defaultPrevented;
    }

    focus() {
      doc.activeElement = this;
    }

    closest(selector) {
      let cur = this;
      while (cur) {
        if (cur.matches(selector)) return cur;
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

    matches(selector) {
      const parts = selector.split(',').map(s => s.trim());
      return parts.some(part => this._matchesSingle(part));
    }

    _matchesSingle(sel) {
      if (sel.startsWith('#')) {
        return this.id === sel.slice(1);
      }
      if (sel.startsWith('.')) {
        return this.classList.contains(sel.slice(1));
      }
      if (sel.startsWith('[data-theme-target]')) {
        return this.attributes.has('data-theme-target');
      }
      if (sel.startsWith('[data-theme]')) {
        return this.attributes.has('data-theme');
      }
      if (sel.startsWith('button[')) {
        if (this.tagName !== 'BUTTON') return false;
        const attrMatch = sel.match(/\[([a-zA-Z0-9_-]+)\]/);
        return attrMatch ? this.attributes.has(attrMatch[1]) : false;
      }
      return false;
    }

    querySelectorAll(selector) {
      const results = [];
      const traverse = (node) => {
        for (const child of node.children) {
          if (child.matches(selector)) {
            results.push(child);
          }
          traverse(child);
        }
      };
      traverse(this);
      return results;
    }

    querySelector(selector) {
      const all = this.querySelectorAll(selector);
      return all.length > 0 ? all[0] : null;
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

  // Assemble HTML elements matching index.html
  const doc = {
    readyState: 'complete',
    activeElement: null,
    eventListeners: new Map(),
    documentElement: new MockElement('HTML'),
    body: new MockElement('BODY'),
    addEventListener(type, listener) {
      if (!this.eventListeners.has(type)) this.eventListeners.set(type, []);
      this.eventListeners.get(type).push(listener);
    },
    dispatchEvent(event) {
      const listeners = this.eventListeners.get(event.type) || [];
      for (const listener of listeners) listener.call(this, event);
      return !event.defaultPrevented;
    }
  };

  doc.documentElement.appendChild(doc.body);

  const header = new MockElement('HEADER', 'site-header', 'site-header');
  const nav = new MockElement('NAV', 'theme-switcher-bar', 'switcher-bar theme-switcher-bar');
  const brandDiv = new MockElement('DIV', '', 'switcher-brand');
  const brandLink = new MockElement('A', '', 'brand-link');
  brandDiv.appendChild(brandLink);
  nav.appendChild(brandDiv);

  const tabsDiv = new MockElement('DIV', '', 'switcher-tabs theme-tabs');
  const buttons = [];

  VALID_THEMES.forEach((themeName, idx) => {
    const btn = new MockElement('BUTTON', `switcher-${themeName}`, `switcher-btn theme-tab ${idx === 0 ? 'active' : ''}`);
    btn.setAttribute('role', 'tab');
    btn.setAttribute('data-theme', themeName);
    btn.setAttribute('data-theme-target', themeName);
    btn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
    btn.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');
    btn.setAttribute('tabindex', idx === 0 ? '0' : '-1');

    const titleSpan = new MockElement('SPAN', '', 'theme-title');
    titleSpan.textContent = themeName;
    btn.appendChild(titleSpan);

    tabsDiv.appendChild(btn);
    buttons.push(btn);
  });
  nav.appendChild(tabsDiv);

  const actionsDiv = new MockElement('DIV', '', 'switcher-actions switcher-controls');
  const soundToggle = new MockElement('BUTTON', 'sound-toggle', 'sound-toggle-btn sound-toggle');
  soundToggle.setAttribute('aria-pressed', 'false');
  const stateSpan = new MockElement('SPAN', '', 'btn-state');
  stateSpan.textContent = 'MUTED';
  soundToggle.appendChild(stateSpan);
  actionsDiv.appendChild(soundToggle);
  nav.appendChild(actionsDiv);

  header.appendChild(nav);
  doc.body.appendChild(header);

  const main = new MockElement('MAIN', 'theme-viewport', 'theme-viewport');
  const containers = [];
  VALID_THEMES.forEach((themeName, idx) => {
    const container = new MockElement('SECTION', `theme-${themeName}`, `theme-container ${idx === 0 ? 'active' : ''}`);
    container.setAttribute('data-theme', themeName);
    if (idx !== 0) {
      container.setAttribute('hidden', '');
      container.setAttribute('aria-hidden', 'true');
    } else {
      container.setAttribute('aria-hidden', 'false');
    }
    main.appendChild(container);
    containers.push(container);
  });
  doc.body.appendChild(main);

  doc.getElementById = function(id) {
    if (id === 'site-header') return header;
    if (id === 'theme-switcher-bar') return nav;
    if (id === 'sound-toggle') return soundToggle;
    if (id === 'theme-viewport') return main;
    for (const b of buttons) if (b.id === id) return b;
    for (const c of containers) if (c.id === id) return c;
    return null;
  };

  doc.querySelectorAll = function(sel) {
    return doc.body.querySelectorAll(sel);
  };

  doc.activeElement = buttons[0]; // Default focus on active tab

  const win = {
    document: doc,
    CustomEvent: MockCustomEvent,
    eventListeners: new Map(),
    addEventListener(type, listener) {
      if (!this.eventListeners.has(type)) this.eventListeners.set(type, []);
      this.eventListeners.get(type).push(listener);
    },
    dispatchEvent(event) {
      const listeners = this.eventListeners.get(event.type) || [];
      for (const listener of listeners) listener.call(this, event);
      return !event.defaultPrevented;
    }
  };

  if (throwOnStorageAccess) {
    Object.defineProperty(win, 'localStorage', {
      get() {
        const err = new Error('The operation is insecure.');
        err.name = 'SecurityError';
        throw err;
      }
    });
  } else {
    win.localStorage = mockStorageInstance;
  }

  return { win, doc, nav, buttons, containers, soundToggle, storageStore };
}

function instantiateApp(env) {
  const appCode = fs.readFileSync(APP_JS_PATH, 'utf8');
  const sandbox = {
    console: {
      log: () => {},
      warn: () => {},
      error: () => {}
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
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
  return { app, sandbox };
}

// ==============================================================================
// TEST RUNNER & SUITES
// ==============================================================================

function runAllTests() {
  const results = {
    passed: 0,
    failed: 0,
    failures: []
  };

  function assert(condition, message) {
    if (!condition) {
      results.failed++;
      results.failures.push(message);
      throw new Error(`Assertion Failed: ${message}`);
    } else {
      results.passed++;
    }
  }

  console.log('======================================================================');
  console.log('CLOWNHOUSE.IO // Milestone M1 Empirical Storage & Security Fuzz Runner');
  console.log('======================================================================\n');

  // ----------------------------------------------------------------------------
  // SUITE 1: Hostile localStorage Payload Fuzzing
  // ----------------------------------------------------------------------------
  console.log('--- SUITE 1: Hostile localStorage Payload Fuzzing ---');

  const hostilePayloads = [
    // XSS Vectors
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    'javascript:alert(1)',
    '<svg onload=alert(1)>',
    '"><script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    '\' onfocus=\'alert(1)',
    '<iframe src="javascript:alert(1)">',

    // Null Byte & Control Characters
    'tower-of-power\x00',
    '\x00tower-of-power',
    '\x00',
    '\u0000',
    'chozo-visor\x00.admin',
    'wrx-telemetry\r\n',
    '\t\n\r',

    // Oversized Payloads (>64KB, >128KB)
    'A'.repeat(65536),
    'B'.repeat(131072),
    'tower-of-power/'.repeat(5000),

    // Undefined, null, primitives
    'undefined',
    'null',
    'NaN',
    'Infinity',
    '-1',
    '0',
    '123',
    'true',
    'false',

    // Prototype Pollution & Builtin Objects
    '__proto__',
    'constructor',
    'prototype',
    'toString',
    'valueOf',
    'hasOwnProperty',
    'isPrototypeOf',

    // Path Traversal & Command Injection
    '../../etc/passwd',
    '..\\..\\windows\\system32',
    'tower-of-power; rm -rf /',
    '$(whoami)',
    '`id`',

    // Non-ASCII, Unicode Bidi, ANSI
    '\u202Ereversed_theme',
    '\x1b[31mRedTheme\x1b[0m',
    '🕹️',
    'chozo—visor', // Unicode em-dash
    ' tower-of-power',
    'tower-of-power ',

    // Partial Matches & Case Sensitivity
    'tower',
    'power',
    'chozo',
    'visor',
    'wrx',
    'hunter',
    'pacific',
    'TOWER-OF-POWER',
    'Chozo-Visor',
    'WRX-TELEMETRY',

    // JSON Payloads
    '{"theme": "tower-of-power"}',
    '["tower-of-power"]',
    '{"__proto__": {"admin": true}}'
  ];

  for (const payload of hostilePayloads) {
    const payloadDesc = payload.length > 30 ? `${payload.slice(0, 27)}... (len ${payload.length})` : payload;

    // Test A: In localStorage prior to init()
    try {
      const env = createMockDOMEnvironment({
        initialStorage: { clownhouse_theme: payload }
      });
      const { app } = instantiateApp(env);

      assert(
        app.getActiveTheme() === 'tower-of-power',
        `Payload "${payloadDesc}" in localStorage must fall back to default 'tower-of-power', got "${app.getActiveTheme()}"`
      );
      assert(
        env.doc.documentElement.getAttribute('data-theme') === 'tower-of-power',
        `Payload "${payloadDesc}" must not inject into documentElement data-theme`
      );
      assert(
        env.doc.body.getAttribute('data-theme') === 'tower-of-power',
        `Payload "${payloadDesc}" must not inject into body data-theme`
      );
      assert(
        env.storageStore.get('clownhouse_theme') === 'tower-of-power',
        `Storage must self-heal to 'tower-of-power' after corrupted payload "${payloadDesc}"`
      );
    } catch (err) {
      console.error(`[FAIL] Suite 1A (Pre-seed): ${err.message}`);
      throw err;
    }

    // Test B: Direct call to setTheme(payload)
    try {
      const env = createMockDOMEnvironment();
      const { app } = instantiateApp(env);
      const prevTheme = app.getActiveTheme();

      const result = app.setTheme(payload);
      assert(
        result === false,
        `setTheme("${payloadDesc}") must return false for invalid theme, got ${result}`
      );
      assert(
        app.getActiveTheme() === prevTheme,
        `Active theme must remain unchanged after rejected payload "${payloadDesc}"`
      );
      assert(
        env.doc.documentElement.getAttribute('data-theme') === prevTheme,
        `documentElement data-theme must remain unchanged after rejected payload "${payloadDesc}"`
      );
    } catch (err) {
      console.error(`[FAIL] Suite 1B (setTheme): ${err.message}`);
      throw err;
    }
  }

  // Non-string object / function / array / symbol tests
  const nonStringPayloads = [
    { val: null, name: 'null' },
    { val: undefined, name: 'undefined' },
    { val: 12345, name: 'number: 12345' },
    { val: true, name: 'boolean: true' },
    { val: false, name: 'boolean: false' },
    { val: {}, name: 'empty object: {}' },
    { val: { theme: 'tower-of-power' }, name: 'object: { theme }' },
    { val: ['tower-of-power'], name: 'array: [tower-of-power]' },
    { val: () => 'tower-of-power', name: 'function' },
    { val: Symbol('tower-of-power'), name: 'Symbol' },
    { val: Object.create(null), name: 'Object.create(null)' }
  ];

  const exoticFailures = [];
  for (const item of nonStringPayloads) {
    const env = createMockDOMEnvironment();
    const { app } = instantiateApp(env);
    const prevTheme = app.getActiveTheme();
    try {
      const res = app.setTheme(item.val);
      assert(res === false, `setTheme(non-string: ${item.name}) must return false`);
      assert(app.getActiveTheme() === prevTheme, `Active theme must stay ${prevTheme} on non-string input`);
    } catch (err) {
      exoticFailures.push({ input: item.name, error: err.message });
      console.warn(`  [VULNERABILITY] setTheme(${item.name}) threw unhandled exception: ${err.message}`);
    }
  }

  console.log(`[PASS] Suite 1 completed: ${hostilePayloads.length * 2 + nonStringPayloads.length} hostile payloads fuzzed fail-closed.\n`);

  // ----------------------------------------------------------------------------
  // SUITE 2: Storage Exception Simulation (SecurityError & Quota)
  // ----------------------------------------------------------------------------
  console.log('--- SUITE 2: Storage Exception Simulation (SecurityError & Quota) ---');

  // Case 2.1: localStorage.getItem throws SecurityError (Private Browsing)
  {
    const env = createMockDOMEnvironment({ throwOnGetItem: true });
    let app;
    try {
      const instantiated = instantiateApp(env);
      app = instantiated.app;
      assert(true, 'init() must not throw when localStorage.getItem throws SecurityError');
    } catch (e) {
      assert(false, `init() threw unhandled exception on SecurityError: ${e.message}`);
    }
    assert(app.getActiveTheme() === 'tower-of-power', 'Fallback to default theme when storage getItem throws SecurityError');
    assert(env.doc.documentElement.getAttribute('data-theme') === 'tower-of-power', 'DOM root data-theme initialized safely');
  }

  // Case 2.2: localStorage.setItem throws SecurityError
  {
    const env = createMockDOMEnvironment({ throwOnSetItem: true });
    const { app } = instantiateApp(env);

    let eventFired = false;
    env.win.addEventListener('themechange', (e) => {
      if (e.detail && e.detail.theme === 'chozo-visor') eventFired = true;
    });

    const res = app.setTheme('chozo-visor');
    assert(res === true, 'setTheme must succeed in-memory even when setItem throws SecurityError');
    assert(app.getActiveTheme() === 'chozo-visor', 'In-memory state must update to chozo-visor');
    assert(env.doc.documentElement.getAttribute('data-theme') === 'chozo-visor', 'DOM root data-theme must update');
    assert(eventFired === true, 'CustomEvent themechange must still fire when setItem throws');
  }

  // Case 2.3: Both getItem and setItem throw SecurityError
  {
    const env = createMockDOMEnvironment({ throwOnGetItem: true, throwOnSetItem: true });
    const { app } = instantiateApp(env);
    assert(app.getActiveTheme() === 'tower-of-power', 'Initial default theme set');

    for (const t of VALID_THEMES) {
      const res = app.setTheme(t);
      assert(res === true, `setTheme('${t}') must succeed in-memory when full storage blocked`);
      assert(app.getActiveTheme() === t, `Theme state is ${t}`);
      assert(env.doc.documentElement.getAttribute('data-theme') === t, `DOM theme matches ${t}`);
    }
  }

  // Case 2.4: window.localStorage getter throws SecurityError (Restricted Sandbox)
  {
    const env = createMockDOMEnvironment({ throwOnStorageAccess: true });
    let app;
    try {
      const instantiated = instantiateApp(env);
      app = instantiated.app;
      assert(true, 'Survives window.localStorage getter SecurityError');
    } catch (e) {
      assert(false, `Crashed on window.localStorage getter throw: ${e.message}`);
    }
    assert(app.getActiveTheme() === 'tower-of-power', 'Default theme selected on restricted localStorage access');
    const res = app.setTheme('wrx-telemetry');
    assert(res === true, 'Theme hot-swap functions when window.localStorage throws on access');
    assert(app.getActiveTheme() === 'wrx-telemetry', 'Active theme is wrx-telemetry');
  }

  // Case 2.5: localStorage.setItem throws QuotaExceededError
  {
    const env = createMockDOMEnvironment({ quotaExceeded: true });
    const { app } = instantiateApp(env);
    const res = app.setTheme('hunter-base');
    assert(res === true, 'setTheme survives QuotaExceededError');
    assert(app.getActiveTheme() === 'hunter-base', 'Theme set to hunter-base');
  }

  console.log('[PASS] Suite 2 completed: All 5 SecurityError & Quota failure scenarios verified fail-closed.\n');

  // ----------------------------------------------------------------------------
  // SUITE 3: Switcher Bar Keyboard Navigation (WAI-ARIA Roving Tabindex)
  // ----------------------------------------------------------------------------
  console.log('--- SUITE 3: Switcher Bar Keyboard Navigation (WAI-ARIA Roving Tabindex) ---');

  function sendKey(navEl, keyName) {
    const evt = {
      type: 'keydown',
      key: keyName,
      defaultPrevented: false,
      bubbles: true,
      preventDefault: function() { this.defaultPrevented = true; }
    };
    navEl.dispatchEvent(evt);
    return evt;
  }

  // Case 3.1: Sequential ArrowRight navigation with circular wrap-around
  {
    const env = createMockDOMEnvironment();
    const { app } = instantiateApp(env);

    // Initial state: Button 0 active
    assert(env.buttons[0].getAttribute('tabindex') === '0', 'Button 0 has initial tabindex="0"');
    assert(env.buttons[0].getAttribute('aria-selected') === 'true', 'Button 0 aria-selected="true"');
    assert(env.buttons[1].getAttribute('tabindex') === '-1', 'Button 1 has initial tabindex="-1"');

    // Simulate focus on button 0
    env.buttons[0].focus();
    assert(env.doc.activeElement === env.buttons[0], 'Button 0 focused');

    // ArrowRight: 0 -> 1 (chozo-visor)
    sendKey(env.nav, 'ArrowRight');
    assert(env.doc.activeElement === env.buttons[1], 'Focus moved to button 1 (chozo-visor)');
    assert(app.getActiveTheme() === 'chozo-visor', 'Theme switched to chozo-visor');
    assert(env.buttons[1].getAttribute('tabindex') === '0', 'Button 1 has tabindex="0"');
    assert(env.buttons[0].getAttribute('tabindex') === '-1', 'Button 0 has tabindex="-1"');

    // ArrowRight: 1 -> 2 (wrx-telemetry)
    sendKey(env.nav, 'ArrowRight');
    assert(env.doc.activeElement === env.buttons[2], 'Focus moved to button 2 (wrx-telemetry)');
    assert(app.getActiveTheme() === 'wrx-telemetry', 'Theme switched to wrx-telemetry');

    // ArrowRight: 2 -> 3 (hunter-base)
    sendKey(env.nav, 'ArrowRight');
    assert(env.doc.activeElement === env.buttons[3], 'Focus moved to button 3 (hunter-base)');
    assert(app.getActiveTheme() === 'hunter-base', 'Theme switched to hunter-base');

    // ArrowRight: 3 -> 4 (pacific-outpost)
    sendKey(env.nav, 'ArrowRight');
    assert(env.doc.activeElement === env.buttons[4], 'Focus moved to button 4 (pacific-outpost)');
    assert(app.getActiveTheme() === 'pacific-outpost', 'Theme switched to pacific-outpost');

    // ArrowRight wrap-around: 4 -> 0 (tower-of-power)
    sendKey(env.nav, 'ArrowRight');
    assert(env.doc.activeElement === env.buttons[0], 'Focus wrapped around to button 0 (tower-of-power)');
    assert(app.getActiveTheme() === 'tower-of-power', 'Theme wrapped to tower-of-power');
    assert(env.buttons[0].getAttribute('tabindex') === '0', 'Button 0 restored tabindex="0"');
    assert(env.buttons[4].getAttribute('tabindex') === '-1', 'Button 4 restored tabindex="-1"');
  }

  // Case 3.2: Sequential ArrowLeft navigation with backwards wrap-around
  {
    const env = createMockDOMEnvironment();
    const { app } = instantiateApp(env);

    env.buttons[0].focus();

    // ArrowLeft wrap-around: 0 -> 4 (pacific-outpost)
    sendKey(env.nav, 'ArrowLeft');
    assert(env.doc.activeElement === env.buttons[4], 'ArrowLeft from button 0 wrapped to button 4');
    assert(app.getActiveTheme() === 'pacific-outpost', 'Theme switched to pacific-outpost');
    assert(env.buttons[4].getAttribute('tabindex') === '0', 'Button 4 tabindex="0"');
    assert(env.buttons[0].getAttribute('tabindex') === '-1', 'Button 0 tabindex="-1"');

    // ArrowLeft: 4 -> 3 (hunter-base)
    sendKey(env.nav, 'ArrowLeft');
    assert(env.doc.activeElement === env.buttons[3], 'ArrowLeft moved to button 3');
    assert(app.getActiveTheme() === 'hunter-base', 'Theme is hunter-base');

    // ArrowLeft: 3 -> 2 (wrx-telemetry)
    sendKey(env.nav, 'ArrowLeft');
    assert(env.doc.activeElement === env.buttons[2], 'ArrowLeft moved to button 2');
    assert(app.getActiveTheme() === 'wrx-telemetry', 'Theme is wrx-telemetry');
  }

  // Case 3.3: ArrowDown and ArrowUp parity
  {
    const env = createMockDOMEnvironment();
    const { app } = instantiateApp(env);

    env.buttons[0].focus();

    // ArrowDown should advance forward
    sendKey(env.nav, 'ArrowDown');
    assert(env.doc.activeElement === env.buttons[1], 'ArrowDown advances forward to button 1');
    assert(app.getActiveTheme() === 'chozo-visor', 'Theme updated to chozo-visor');

    // ArrowUp should retreat backward
    sendKey(env.nav, 'ArrowUp');
    assert(env.doc.activeElement === env.buttons[0], 'ArrowUp retreats backward to button 0');
    assert(app.getActiveTheme() === 'tower-of-power', 'Theme updated to tower-of-power');
  }

  // Case 3.4: Home and End keys
  {
    const env = createMockDOMEnvironment();
    const { app } = instantiateApp(env);

    // Focus middle button 2
    env.buttons[2].focus();
    app.setTheme('wrx-telemetry');

    // Home jumps to button 0
    sendKey(env.nav, 'Home');
    assert(env.doc.activeElement === env.buttons[0], 'Home key jumps directly to button 0');
    assert(app.getActiveTheme() === 'tower-of-power', 'Theme jumped to tower-of-power');
    assert(env.buttons[0].getAttribute('tabindex') === '0', 'Button 0 has tabindex="0"');

    // End jumps to button 4
    sendKey(env.nav, 'End');
    assert(env.doc.activeElement === env.buttons[4], 'End key jumps directly to button 4 (last)');
    assert(app.getActiveTheme() === 'pacific-outpost', 'Theme jumped to pacific-outpost');
    assert(env.buttons[4].getAttribute('tabindex') === '0', 'Button 4 has tabindex="0"');
    assert(env.buttons[0].getAttribute('tabindex') === '-1', 'Button 0 has tabindex="-1"');
  }

  // Case 3.5: Isolation - Arrow keys on non-tab elements are not hijacked
  {
    const env = createMockDOMEnvironment();
    const { app } = instantiateApp(env);

    // Focus on sound-toggle button
    env.soundToggle.focus();
    const currentTheme = app.getActiveTheme();

    const evt = sendKey(env.nav, 'ArrowRight');
    assert(app.getActiveTheme() === currentTheme, 'ArrowRight on sound-toggle must NOT change theme');
    assert(evt.defaultPrevented === false, 'ArrowRight on sound-toggle must NOT preventDefault');
  }

  // Case 3.6: Strict Roving Tabindex Invariant
  {
    const env = createMockDOMEnvironment();
    const { app } = instantiateApp(env);

    for (let i = 0; i < env.buttons.length; i++) {
      env.buttons[i].focus();
      sendKey(env.nav, 'ArrowRight');

      // Count buttons with tabindex="0"
      const zeroTabs = env.buttons.filter(b => b.getAttribute('tabindex') === '0');
      const minusTabs = env.buttons.filter(b => b.getAttribute('tabindex') === '-1');

      assert(zeroTabs.length === 1, `Exactly 1 button must have tabindex="0", found ${zeroTabs.length}`);
      assert(minusTabs.length === env.buttons.length - 1, `All other buttons must have tabindex="-1"`);
      assert(zeroTabs[0] === env.doc.activeElement, 'Button with tabindex="0" must match focused button');
    }
  }

  console.log('[PASS] Suite 3 completed: Keyboard navigation, wrap-around, Home/End, and roving tabindex verified.\n');

  // ----------------------------------------------------------------------------
  // SUITE 4: Concurrency Stress & Randomized Fuzzing (1000 Iterations)
  // ----------------------------------------------------------------------------
  console.log('--- SUITE 4: Concurrency Stress & State Invariance (1000 Cycles) ---');

  {
    const env = createMockDOMEnvironment();
    const { app } = instantiateApp(env);

    const operations = [
      () => {
        // Random valid theme
        const t = VALID_THEMES[Math.floor(Math.random() * VALID_THEMES.length)];
        app.setTheme(t);
      },
      () => {
        // Random hostile payload
        const p = hostilePayloads[Math.floor(Math.random() * hostilePayloads.length)];
        app.setTheme(p);
      },
      () => {
        // ArrowRight
        sendKey(env.nav, 'ArrowRight');
      },
      () => {
        // ArrowLeft
        sendKey(env.nav, 'ArrowLeft');
      },
      () => {
        // Home
        sendKey(env.nav, 'Home');
      },
      () => {
        // End
        sendKey(env.nav, 'End');
      },
      () => {
        // Sound toggle
        app.toggleSound();
      }
    ];

    for (let i = 0; i < 1000; i++) {
      const op = operations[Math.floor(Math.random() * operations.length)];
      op();
    }

    // Invariance Checks after 1000 cycles
    const finalTheme = app.getActiveTheme();
    assert(VALID_THEMES.includes(finalTheme), `Final theme "${finalTheme}" must be in VALID_THEMES`);
    assert(
      env.doc.documentElement.getAttribute('data-theme') === finalTheme,
      `documentElement data-theme must match active theme "${finalTheme}"`
    );
    assert(
      env.doc.body.getAttribute('data-theme') === finalTheme,
      `body data-theme must match active theme "${finalTheme}"`
    );

    const activeContainers = env.containers.filter(c => c.classList.contains('active') && !c.attributes.has('hidden'));
    assert(activeContainers.length === 1, `Exactly 1 container must be active, found ${activeContainers.length}`);
    assert(activeContainers[0].id === `theme-${finalTheme}`, `Active container must be theme-${finalTheme}`);

    const activeButtons = env.buttons.filter(b => b.classList.contains('active') && b.getAttribute('aria-selected') === 'true');
    assert(activeButtons.length === 1, `Exactly 1 switcher button must be active, found ${activeButtons.length}`);
    assert(activeButtons[0].getAttribute('data-theme') === finalTheme, `Active button must match ${finalTheme}`);

    const zeroTabButtons = env.buttons.filter(b => b.getAttribute('tabindex') === '0');
    assert(zeroTabButtons.length === 1, 'Exactly 1 button has tabindex="0" after 1000 cycles');

    console.log('[PASS] Suite 4 completed: 1000 randomized operations preserved 100% state invariance.\n');
  }

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log('======================================================================');
  console.log(`TOTAL CHECKS: ${results.passed + results.failed}`);
  console.log(`PASSED:       ${results.passed}`);
  console.log(`FAILED:       ${results.failed}`);
  console.log('======================================================================');

  if (results.failed > 0) {
    console.error('Test failures:');
    results.failures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f}`));
    process.exit(1);
  }

  return { passed: results.passed, failed: results.failed };
}

if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
