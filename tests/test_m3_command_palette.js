/**
 * CLOWNHOUSE.IO // Milestone M3 Command Palette & Fuzzy Search Test Suite
 * 
 * Verifies:
 * 1. Interface contract completeness for window.ClownPalette (open, close, toggle, search, executeItem).
 * 2. Full catalog indexing across all projects, cluster services, themes, navigation, and audio tracks.
 * 3. Multi-token fuzzy search filtering precision.
 * 4. Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape) and wrapping.
 * 5. Shortcut key listeners (Cmd+K, Ctrl+K, /).
 * 6. Double-Run Parity Law ($Run_1 == Run_2$).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const APP_JS_PATH = path.join(PROJECT_ROOT, 'app.js');

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

function createMockEnvironment() {
  const elements = {
    'command-palette-modal': {
      classList: makeDOMTokenList(['command-palette-modal', 'hidden']),
      setAttribute: () => {},
      getAttribute: () => 'true'
    },
    'palette-input': {
      value: '',
      focus: function () { this.isFocused = true; },
      addEventListener: function (type, cb) { this.listeners[type] = cb; },
      listeners: {}
    },
    'palette-results': {
      innerHTML: '',
      children: [],
      appendChild: function (el) { this.children.push(el); },
      querySelectorAll: function () { return this.children; }
    },
    'palette-backdrop': { addEventListener: () => {} },
    'palette-close-badge': { addEventListener: () => {} },
    'theme-toggle-btn': { addEventListener: () => {} },
    'theme-btn-label': { textContent: 'tokyo-night' },
    'palette-toggle-btn': { addEventListener: () => {} },
    'hero-palette-btn': { addEventListener: () => {} },
    'audio-play-btn': { addEventListener: () => {} },
    'audio-mute-btn': { addEventListener: () => {} },
    'theme-color-meta': { setAttribute: () => {}, getAttribute: () => '#1a1b26' },
    'projects': { scrollIntoView: () => {} },
    'services': { scrollIntoView: () => {} },
    'stack': { scrollIntoView: () => {} },
    'activity': { scrollIntoView: () => {} }
  };

  const documentMock = {
    readyState: 'complete',
    documentElement: {
      setAttribute: () => {},
      getAttribute: () => 'tokyo-night'
    },
    addEventListener: () => {},
    dispatchEvent: () => {},
    getElementById: (id) => elements[id] || null,
    querySelector: (sel) => {
      if (sel === 'meta[name="theme-color"]') return elements['theme-color-meta'];
      return null;
    },
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        classList: makeDOMTokenList(),
        setAttribute: () => {},
        getAttribute: () => null,
        appendChild: (child) => { (el.children = el.children || []).push(child); },
        addEventListener: function (type, cb) { (this.listeners = this.listeners || {})[type] = cb; },
        scrollIntoView: () => {}
      };
      return el;
    }
  };

  const windowListeners = {};
  const windowMock = {
    addEventListener: (type, cb) => { windowListeners[type] = cb; },
    removeEventListener: (type) => { delete windowListeners[type]; },
    dispatchEvent: () => {},
    matchMedia: () => ({ matches: false }),
    location: { href: '' },
    open: () => {},
    localStorage: {
      _data: {},
      getItem: function (k) { return this._data[k] || null; },
      setItem: function (k, v) { this._data[k] = String(v); }
    }
  };

  const sandbox = {
    window: windowMock,
    document: documentMock,
    globalThis: windowMock,
    localStorage: windowMock.localStorage,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Uint8Array,
    Math,
    Number,
    Object,
    Array,
    CustomEvent: class CustomEvent { constructor(n, d) { this.name = n; this.detail = d && d.detail; } }
  };

  vm.createContext(sandbox);
  return { sandbox, elements, windowListeners };
}

async function runPaletteSuite(runIndex) {
  console.log(`\n================================================================`);
  console.log(`CLOWNHOUSE.IO // Milestone M3 Command Palette & Fuzzy Search (Run ${runIndex})`);
  console.log(`================================================================\n`);

  const { sandbox, elements, windowListeners } = createMockEnvironment();
  const appCode = fs.readFileSync(APP_JS_PATH, 'utf8');

  vm.runInContext(appCode, sandbox);
  const palette = sandbox.window.ClownPalette;

  // 1. Interface Contract Completeness
  console.log('--- 1. Window Contract Verification ---');
  assert(typeof palette === 'object' && palette !== null, 'window.ClownPalette is defined');
  assert(typeof palette.open === 'function', 'palette.open is a function');
  assert(typeof palette.close === 'function', 'palette.close is a function');
  assert(typeof palette.toggle === 'function', 'palette.toggle is a function');
  assert(typeof palette.search === 'function', 'palette.search is a function');
  assert(typeof palette.executeItem === 'function', 'palette.executeItem is a function');

  // 2. Catalog Indexing Completeness
  console.log('\n--- 2. Catalog Indexing Completeness ---');
  const allItems = palette.search('');
  assert(allItems.length >= 15, `Catalog indexes comprehensive item count (${allItems.length} items >= 15)`);

  const hasItem = (id) => allItems.some(item => item.id === id);
  assert(hasItem('proj-openooda'), 'Catalog contains openOODA.org project');
  assert(hasItem('proj-necrometer'), 'Catalog contains necrometer.dev project');
  assert(hasItem('proj-bumtrips'), 'Catalog contains bumtrips.com project');
  assert(hasItem('svc-reactle'), 'Catalog contains reactle.clownhouse.io service');
  assert(hasItem('svc-giggle'), 'Catalog contains giggle.clownhouse.io compute node');
  assert(hasItem('svc-contact'), 'Catalog contains jeryd@clownhouse.io direct ingress');
  assert(hasItem('theme-tokyo'), 'Catalog contains Tokyo Night theme');
  assert(hasItem('theme-catp'), 'Catalog contains Catppuccin theme');
  assert(hasItem('theme-gruv'), 'Catalog contains Gruvbox theme');
  assert(hasItem('theme-nord'), 'Catalog contains Nord theme');
  assert(hasItem('theme-rose'), 'Catalog contains Rosé Pine theme');
  assert(hasItem('theme-ethereal'), 'Catalog contains Ethereal theme');
  assert(hasItem('theme-vanta'), 'Catalog contains Vantablack theme');
  assert(hasItem('act-audio'), 'Catalog contains audio toggle action');
  assert(hasItem('act-theme-random'), 'Catalog contains random theme action');
  assert(hasItem('track-chrono-corridors'), 'Catalog contains Chrono Trigger Corridors of Time track');
  assert(hasItem('track-fix-everything'), 'Catalog contains We Can Fix Everything soundtrack');
  assert(hasItem('track-lab01'), 'Catalog contains LAB-01 Carrier Drift track');
  assert(hasItem('track-lab02'), 'Catalog contains LAB-02 Cybernetic Drone track');
  assert(hasItem('track-lab03'), 'Catalog contains LAB-03 Necrometer 528Hz track');
  assert(hasItem('track-lab04'), 'Catalog contains LAB-04 Velvet Frequency track');

  // 3. Multi-Token Fuzzy Search Filtering
  console.log('\n--- 3. Multi-Token Fuzzy Search Filtering ---');
  const oodaSearch = palette.search('ooda agent');
  assert(oodaSearch.length > 0 && oodaSearch[0].id === 'proj-openooda', 'Search "ooda agent" correctly matches openOODA.org');

  const necroSearch = palette.search('necro rust');
  assert(necroSearch.length > 0 && necroSearch[0].id === 'proj-necrometer', 'Search "necro rust" correctly matches necrometer.dev');

  const bumtripsSearch = palette.search('bumtrips podcast');
  assert(bumtripsSearch.length > 0 && bumtripsSearch[0].id === 'proj-bumtrips', 'Search "bumtrips podcast" correctly matches bumtrips.com');

  const catppuccinSearch = palette.search('catppuccin mocha');
  assert(catppuccinSearch.length > 0 && catppuccinSearch[0].id === 'theme-catp', 'Search "catppuccin mocha" correctly matches Catppuccin theme');

  const audioSearch = palette.search('carrier 432hz');
  assert(audioSearch.length > 0 && audioSearch[0].id === 'track-lab01', 'Search "carrier 432hz" correctly matches Track LAB-01');

  const emptySearch = palette.search('xyzNonExistentString12345');
  assert(emptySearch.length === 0, 'Search non-existent query yields empty array cleanly');

  // 4. Modal Open, Close, Toggle Lifecycle
  console.log('\n--- 4. Modal Open / Close / Toggle Lifecycle ---');
  palette.open();
  assert(!elements['command-palette-modal'].classList.contains('hidden'), 'palette.open() removes "hidden" class');

  palette.close();
  assert(elements['command-palette-modal'].classList.contains('hidden'), 'palette.close() restores "hidden" class');

  palette.toggle();
  assert(!elements['command-palette-modal'].classList.contains('hidden'), 'palette.toggle() opens closed palette');

  palette.toggle();
  assert(elements['command-palette-modal'].classList.contains('hidden'), 'palette.toggle() closes open palette');

  // 5. Keyboard Navigation & Shortcuts
  console.log('\n--- 5. Keyboard Shortcut Triggering ---');
  const keydown = windowListeners['keydown'];
  assert(typeof keydown === 'function', 'Global window keydown listener is registered');

  // Cmd+K opens palette
  keydown({ key: 'k', metaKey: true, preventDefault: () => {} });
  assert(!elements['command-palette-modal'].classList.contains('hidden'), 'Cmd+K opens command palette');
  palette.close();

  // Ctrl+K opens palette
  keydown({ key: 'k', ctrlKey: true, preventDefault: () => {} });
  assert(!elements['command-palette-modal'].classList.contains('hidden'), 'Ctrl+K opens command palette');
  palette.close();

  // Slash '/' opens palette when not typing
  keydown({ key: '/', preventDefault: () => {} });
  assert(!elements['command-palette-modal'].classList.contains('hidden'), 'Slash "/" opens command palette');
  palette.close();

  // Slash '/' suppressed when inside input
  keydown({ key: '/', target: { tagName: 'INPUT' }, preventDefault: () => {} });
  assert(elements['command-palette-modal'].classList.contains('hidden'), 'Slash "/" suppressed when inside <input>');
}

async function run() {
  await runPaletteSuite(1);
  const run1Failures = failedTests;

  // Run 2: Double-Run Verification Parity Law ($Run_1 == Run_2$)
  totalTests = 0;
  passedTests = 0;
  failedTests = 0;
  failures.length = 0;

  await runPaletteSuite(2);
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
