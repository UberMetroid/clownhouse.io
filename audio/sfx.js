/**
 * CLOWNHOUSE.IO // AUDIO SFX
 * 16-bit Web Audio sound effects (zero samples) plus the
 * spacebar transport shortcut.
 */
(function (root) {
  'use strict';
  const CH = root.__clownaudio = root.__clownaudio || {};

  // Prototype pollution-immune allowlist
  const VALID_SFX_MAP = Object.freeze(
    Object.assign(Object.create(null), {
      hover: true,
      select: true,
      click: true,
      switch: true,
      special: true
    })
  );

  function playSfx(type) {
    if (typeof type !== 'string') return false;
    // Fail-closed against prototype pollution keys
    if (
      type === '__proto__' ||
      type === 'constructor' ||
      type === 'prototype' ||
      type === 'toString' ||
      type === 'valueOf'
    ) {
      return false;
    }
    if (!Object.prototype.hasOwnProperty.call(VALID_SFX_MAP, type) && !VALID_SFX_MAP[type]) {
      return false;
    }

    const S = CH.state;
    try {
      const ctx = CH.getAudioContext();
      if (ctx && typeof ctx.createOscillator === 'function' && typeof ctx.createGain === 'function') {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const now = ctx.currentTime;
        const sfxVolume = S.isMuted ? 0.0001 : Math.max(0.0001, Math.min(S.volume * 0.18, 0.25));
        const out = S.compressor || ctx.destination;

        if (type === 'hover') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(1400, now + 0.04);
          gain.gain.setValueAtTime(sfxVolume, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
          osc.connect(gain);
          gain.connect(out);
          osc.start(now);
          osc.stop(now + 0.042);
        } else {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          const gain2 = ctx.createGain();
          osc1.type = 'square';
          osc2.type = 'square';
          osc1.frequency.setValueAtTime(1200, now);
          gain1.gain.setValueAtTime(sfxVolume, now);
          gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
          osc2.frequency.setValueAtTime(1800, now + 0.045);
          gain2.gain.setValueAtTime(0.0001, now);
          gain2.gain.setValueAtTime(sfxVolume, now + 0.045);
          gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
          osc1.connect(gain1);
          gain1.connect(out);
          osc2.connect(gain2);
          gain2.connect(out);
          osc1.start(now);
          osc1.stop(now + 0.052);
          osc2.start(now + 0.045);
          osc2.stop(now + 0.125);
        }
      }
    } catch (_) {
      // AudioContext unavailable or mock environment
    }
    return true;
  }

  function isTypingContext(target) {
    if (!target) return false;
    const tag = target.tagName || '';
    if (
      target.isContentEditable ||
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT'
    ) {
      return true;
    }
    if (typeof document !== 'undefined') {
      const modal = document.getElementById('command-palette-modal');
      if (modal && !modal.classList.contains('hidden') && modal.contains(target)) {
        return true;
      }
    }
    return false;
  }

  function handleKeydown(e) {
    if (!e || e.defaultPrevented) return;
    if (e.target && e.target.classList && e.target.classList.contains('stage-card')) {
      return;
    }
    if (e.code === 'Space' || e.key === ' ') {
      if (!isTypingContext(e.target)) {
        e.preventDefault();
        CH.togglePlay();
      }
    }
  }

  CH.playSfx = playSfx;
  CH.isTypingContext = isTypingContext;
  CH.handleKeydown = handleKeydown;
}(typeof globalThis !== 'undefined' ? globalThis : this));
