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

