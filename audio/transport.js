/**
 * CLOWNHOUSE.IO // AUDIO TRANSPORT
 * Playback controls: play/pause/mute/volume/track navigation, plus
 * event dispatch. All state lives in CH.state; graph work is in graph.js.
 */
(function (root) {
  'use strict';
  const CH = root.__clownaudio = root.__clownaudio || {};

  function dispatchAudioEvent(name, detail) {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        const ev = new CustomEvent(name, { detail });
        window.dispatchEvent(ev);
        if (typeof document !== 'undefined') document.dispatchEvent(ev);
      } catch (_) {}
    }
  }

  function currentTrack() {
    return CH.TRACKS[CH.state.trackIndex] || CH.TRACKS[0];
  }

  function rampMaster(target) {
    const S = CH.state;
    if (S.masterGain && S.ctx) {
      try {
        S.masterGain.gain.setValueAtTime(S.masterGain.gain.value || 0.0001, S.ctx.currentTime);
        S.masterGain.gain.linearRampToValueAtTime(target, S.ctx.currentTime + 0.03);
      } catch (_) {}
    }
  }

  async function play() {
    const S = CH.state;
    const ctx = CH.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try { await ctx.resume(); } catch (err) {
        console.warn('[ClownAudio] Failed to resume AudioContext:', err);
      }
    }

    if (S.isMuted) {
      S.isMuted = false;
      CH.savePref('clownhouse_audio_muted', false);
    }
    rampMaster(S.volume);

    CH.startPatch(currentTrack());
    S.isPlaying = true;
    CH.syncUI();
    CH.startVisualizerLoop();
    dispatchAudioEvent('clownaudio:play', { track: currentTrack() });
  }

  function pause() {
    const S = CH.state;
    S.isPlaying = false;
    CH.getAudioContext();
    rampMaster(0.0001);
    CH.stopPatch();

    CH.syncUI();
    CH.stopVisualizerLoop();
    dispatchAudioEvent('clownaudio:pause', { track: currentTrack() });
  }

  async function togglePlay() {
    const S = CH.state;
    if (S.isPlaying && !S.isMuted) {
      pause();
    } else {
      await play();
    }
  }

  function toggleMute() {
    const S = CH.state;
    CH.getAudioContext();
    S.isMuted = !S.isMuted;
    CH.savePref('clownhouse_audio_muted', S.isMuted);

    rampMaster(S.isMuted ? 0.0001 : S.volume);

    CH.syncUI();
    if (S.isMuted) {
      CH.stopVisualizerLoop();
    } else if (S.isPlaying) {
      CH.startVisualizerLoop();
    }
    dispatchAudioEvent('clownaudio:mute', { isMuted: S.isMuted });
  }

  function setVolume(fraction) {
    const S = CH.state;
    if (typeof fraction !== 'number' || Number.isNaN(fraction) || !Number.isFinite(fraction)) {
      fraction = 0.5;
    }
    S.volume = Math.max(0.0, Math.min(1.0, fraction));
    CH.savePref('clownhouse_audio_volume', S.volume);

    if (!S.isMuted && S.ctx && S.masterGain) {
      rampMaster(S.volume);
    }
    dispatchAudioEvent('clownaudio:volume', { volume: S.volume });
  }

  function setTrack(index) {
    const S = CH.state;
    let target = Number(index);
    if (Number.isNaN(target) || target < 0 || target >= CH.TRACKS.length) {
      target = 0;
    }
    const wasPlaying = S.isPlaying && !S.isMuted;
    S.trackIndex = target;
    if (wasPlaying) {
      CH.startPatch(currentTrack());
    }
    CH.syncUI();
    dispatchAudioEvent('clownaudio:trackchange', {
      trackIndex: S.trackIndex,
      track: currentTrack()
    });
  }

  function nextTrack() {
    setTrack((CH.state.trackIndex + 1) % CH.TRACKS.length);
  }

  function prevTrack() {
    setTrack((CH.state.trackIndex - 1 + CH.TRACKS.length) % CH.TRACKS.length);
  }

  function getState() {
    const S = CH.state;
    return {
      isPlaying: S.isPlaying,
      isMuted: S.isMuted,
      volume: S.volume,
      trackIndex: S.trackIndex,
      currentTrack: currentTrack()
    };
  }

  function getFrequencyData(array) {
    const S = CH.state;
    if (S.analyser && array instanceof Uint8Array) {
      S.analyser.getByteFrequencyData(array);
    } else if (array instanceof Uint8Array) {
      for (let i = 0; i < array.length; i++) {
        array[i] = S.isPlaying && !S.isMuted ? Math.max(10, Math.floor(Math.sin(i * 0.4) * 60 + 80)) : 0;
      }
    }
  }

  Object.assign(CH, {
    dispatchAudioEvent,
    currentTrack,
    play,
    pause,
    togglePlay,
    toggleMute,
    setVolume,
    setTrack,
    nextTrack,
    prevTrack,
    getState,
    getFrequencyData
  });
}(typeof globalThis !== 'undefined' ? globalThis : this));
