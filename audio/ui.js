/**
 * CLOWNHOUSE.IO // AUDIO UI
 * DOM synchronization for the floating audio pill and the
 * requestAnimationFrame-driven 4-bar equalizer.
 */
(function (root) {
  'use strict';
  const CH = root.__clownaudio = root.__clownaudio || {};

  function safeRequestAnimationFrame(callback) {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      return window.requestAnimationFrame(callback);
    }
    if (typeof requestAnimationFrame === 'function') {
      return requestAnimationFrame(callback);
    }
    return null;
  }

  function safeCancelAnimationFrame(id) {
    if (!id) return;
    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(id);
      return;
    }
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(id);
    }
  }

  function syncUI() {
    if (typeof document === 'undefined') return;
    const S = CH.state;

    const pill = document.getElementById('floating-audio-pill');
    const playIcon = document.getElementById('audio-play-icon');
    const pauseIcon = document.getElementById('audio-pause-icon');
    const titleEl = document.getElementById('audio-track-title');
    const freqEl = document.getElementById('audio-track-freq');
    const unmutedIcon = document.getElementById('audio-unmuted-icon');
    const mutedIcon = document.getElementById('audio-muted-icon');

    const track = CH.currentTrack();
    if (titleEl) titleEl.textContent = track.title;
    if (freqEl) freqEl.textContent = track.freq || track.artist;

    const active = S.isPlaying && !S.isMuted;
    if (pill) {
      if (active) { pill.classList.add('is-playing'); } else { pill.classList.remove('is-playing'); }
    }
    if (playIcon && pauseIcon) {
      if (active) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
      } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
      }
    }
    if (unmutedIcon && mutedIcon) {
      if (S.isMuted) {
        unmutedIcon.classList.add('hidden');
        mutedIcon.classList.remove('hidden');
      } else {
        unmutedIcon.classList.remove('hidden');
        mutedIcon.classList.add('hidden');
      }
    }
  }

  function startVisualizerLoop() {
    const S = CH.state;
    if (S.animId) return;
    const eqBars = typeof document !== 'undefined' ? [
      document.querySelector('.eq-bar.bar-1'),
      document.querySelector('.eq-bar.bar-2'),
      document.querySelector('.eq-bar.bar-3'),
      document.querySelector('.eq-bar.bar-4')
    ] : null;
    const dataArray = S.analyser ? new Uint8Array(S.analyser.frequencyBinCount) : null;

    function render() {
      if (!S.isPlaying || S.isMuted) {
        if (eqBars) eqBars.forEach(b => { if (b) b.style.height = '3px'; });
        S.animId = null;
        return;
      }
      if (S.analyser && dataArray) {
        S.analyser.getByteFrequencyData(dataArray);
        if (eqBars) {
          const v = [
            Math.max(dataArray[0] || 0, dataArray[1] || 0),
            Math.max(dataArray[2] || 0, dataArray[3] || 0),
            Math.max(dataArray[4] || 0, dataArray[5] || 0),
            Math.max(dataArray[7] || 0, dataArray[9] || 0)
          ];
          eqBars.forEach((b, i) => {
            if (b) b.style.height = `${Math.max(3, Math.min(14, 3 + Math.floor((v[i] / 255) * 11)))}px`;
          });
        }
      }
      S.animId = safeRequestAnimationFrame(render);
    }
    S.animId = safeRequestAnimationFrame(render);
  }

  function stopVisualizerLoop() {
    const S = CH.state;
    if (S.animId) {
      safeCancelAnimationFrame(S.animId);
      S.animId = null;
    }
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.eq-bar').forEach(b => { b.style.height = '3px'; });
    }
  }

  CH.syncUI = syncUI;
  CH.startVisualizerLoop = startVisualizerLoop;
  CH.stopVisualizerLoop = stopVisualizerLoop;
}(typeof globalThis !== 'undefined' ? globalThis : this));
