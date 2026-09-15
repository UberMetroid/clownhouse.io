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

