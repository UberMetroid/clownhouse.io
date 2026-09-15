/**
 * CLOWNHOUSE.IO // AUDIO ENGINE — ASSEMBLER
 * Composes the audio/* modules into the public window.ClownAudio API.
 *
 * Modules (loaded before this file, in order):
 *   audio/state.js      shared state + persisted preferences
 *   audio/catalog.js    TRACKS — procedural LAB patch descriptors
 *   audio/graph.js      AudioContext graph + patch player
 *   audio/transport.js  play/pause/mute/volume/track navigation
 *   audio/ui.js         DOM sync + EQ visualizer
 *   audio/sfx.js        playSfx + spacebar shortcut
 *
 * Contract: procedural Web Audio synthesis only. Zero binary audio
 * assets — no .mp3/.wav/.ogg files are requested or required.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    require('./audio/state.js');
    require('./audio/catalog.js');
    require('./audio/graph.js');
    require('./audio/transport.js');
    require('./audio/ui.js');
    require('./audio/sfx.js');
    module.exports = factory(globalThis.__clownaudio || {});
  } else {
    root.ClownAudio = factory(root.__clownaudio || {});
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (CH) {
  'use strict';

  const publicApi = {
    TRACKS: [...(CH.TRACKS || [])],
    play: CH.play,
    pause: CH.pause,
    togglePlay: CH.togglePlay,
    toggleMute: CH.toggleMute,
    setVolume: CH.setVolume,
    setTrack: CH.setTrack,
    nextTrack: CH.nextTrack,
    prevTrack: CH.prevTrack,
    getState: CH.getState,
    getFrequencyData: CH.getFrequencyData,
    playSfx: CH.playSfx,
    setTheme: (themeId) => themeId
  };

  if (typeof window !== 'undefined' && typeof CH.handleKeydown === 'function') {
    window.addEventListener('keydown', CH.handleKeydown);
  }

  if (typeof document !== 'undefined' && typeof CH.syncUI === 'function') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => { CH.syncUI(); });
    } else {
      CH.syncUI();
    }
  }

  return publicApi;
}));
