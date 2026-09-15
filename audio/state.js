/**
 * CLOWNHOUSE.IO // AUDIO STATE
 * Shared mutable state + persisted preferences for the audio engine.
 * Every audio/*.js module attaches to the same root.__clownaudio namespace.
 */
(function (root) {
  'use strict';
  const CH = root.__clownaudio = root.__clownaudio || {};

  function loadPref(key, fallback, validate) {
    try {
      if (typeof localStorage === 'undefined') return fallback;
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const val = JSON.parse(raw);
      return validate(val) ? val : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function savePref(key, value) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (_) {}
  }

  CH.loadPref = loadPref;
  CH.savePref = savePref;

  CH.state = {
    isPlaying: false,
    isMuted: loadPref('clownhouse_audio_muted', true, v => v === true || v === 'true'),
    volume: loadPref('clownhouse_audio_volume', 0.7, v => typeof v === 'number' && v >= 0 && v <= 1),
    trackIndex: 0,
    ctx: null,
    masterGain: null,
    compressor: null,
    analyser: null,
    voices: [],
    patchGain: null,
    animId: null
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
